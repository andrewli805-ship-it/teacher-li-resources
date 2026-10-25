/**
 * Authenticated homework portal for the static Pages site.
 * Username STUDENT -> student@homework.local, TEACHER -> teacher@homework.local.
 * Any other provisioned username uses lower(username)@homework.local.
 * The form asks for a username. Confirm email is disabled on the project,
 * so these addresses are only the Auth identity used by signInWithPassword.
 */
(function () {
  var cfg = window.HOMEWORK_SUPABASE;
  if (!cfg || !window.supabase || !window.TeacherLiI18n) return;

  var client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  var USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/;
  var CLASS_RE = /^[A-Za-z0-9_-]{1,16}$/;
  var SEAT_RE = /^[A-Za-z0-9_-]{1,8}$/;

  var state = {
    profile: null,
    assignments: [],
    versions: [],
    profiles: [],
    rosterVersions: [],
    studentCompare: [],
    rosterCompare: [],
    editingId: null,
  };

  function t(key) {
    return window.TeacherLiI18n.t(key);
  }

  function tf(key, vars) {
    return t(key).replace(/\{(\w+)\}/g, function (_, name) {
      return vars[name] == null ? "" : String(vars[name]);
    });
  }

  function $(id) {
    return document.getElementById(id);
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function show(node, on) {
    if (!node) return;
    node.hidden = !on;
  }

  function setMessage(node, text) {
    if (!node) return;
    if (!text) {
      node.hidden = true;
      node.textContent = "";
      return;
    }
    node.hidden = false;
    node.textContent = text;
  }

  function emailForUsername(username) {
    var normalized = String(username || "").trim().toLowerCase();
    if (!USERNAME_RE.test(normalized)) return null;
    return normalized + "@" + cfg.emailDomain;
  }

  function safeUrl(value) {
    try {
      var url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch (_err) {
      return null;
    }
    return null;
  }

  function formatFactor(value) {
    var n = Number(value);
    if (!isFinite(n)) return "0.8";
    return String(Math.round(n * 1000) / 1000);
  }

  function formatTime(iso) {
    if (!iso) return "—";
    var lang = window.TeacherLiI18n.getLang() === "en" ? "en-HK" : "zh-HK";
    return new Intl.DateTimeFormat(lang, {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  }

  function toHkInput(iso) {
    if (!iso) return "";
    var parts = {};
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .forEach(function (part) {
        parts[part.type] = part.value;
      });
    return parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute;
  }

  function fromHkInput(value) {
    if (!value) return null;
    return new Date(value + ":00+08:00").toISOString();
  }

  function errorText(error) {
    var msg = "";
    if (error) {
      msg = error.message || error.msg || error.error_description || error.error || "";
      if (error.code) msg += " " + error.code;
    }
    msg = String(msg);
    if (/invalid_credentials|Invalid login/i.test(msg)) return t("portal.error.login");
    if (/banned/i.test(msg)) return t("portal.error.disabled");
    var codes = [
      "late_closed",
      "wrong_class",
      "invalid_username",
      "invalid_password",
      "invalid_role",
      "invalid_class",
      "username_taken",
      "cannot_change_self",
      "teacher_only",
      "not_found",
      "soft_delete_only",
    ];
    for (var i = 0; i < codes.length; i += 1) {
      if (msg.indexOf(codes[i]) !== -1) return t("portal.error." + codes[i]);
    }
    return t("portal.error.generic");
  }

  function payloadOf(row) {
    var payload = row && row.payload;
    if (!payload || typeof payload !== "object") return { link: "", note: "" };
    return {
      link: payload.link ? String(payload.link) : "",
      note: payload.note ? String(payload.note) : "",
    };
  }

  function assignmentById(id) {
    for (var i = 0; i < state.assignments.length; i += 1) {
      if (state.assignments[i].id === id) return state.assignments[i];
    }
    return null;
  }

  function myAssignments() {
    if (!state.profile) return [];
    return state.assignments.filter(function (row) {
      return row.class_code === state.profile.class_code;
    });
  }

  function timing(assignment) {
    if (!assignment || !assignment.due_at) {
      return { kind: "none", text: t("portal.noDue") };
    }
    var due = new Date(assignment.due_at).getTime();
    var late = Date.now() > due;
    var factor = formatFactor(assignment.late_score_factor);
    var dueLine = t("portal.due") + "：" + formatTime(assignment.due_at);
    if (!late) return { kind: "ontime", text: dueLine + " " + t("portal.ontimeHint") };
    if (!assignment.accept_late) return { kind: "closed", text: dueLine + " " + t("portal.closedHint") };
    return { kind: "late", text: dueLine + " " + tf("portal.lateHint", { factor: factor }) };
  }

  function statusLabel(row) {
    if (row.is_late) {
      var assignment = assignmentById(row.assignment_id);
      var factor = formatFactor(assignment ? assignment.late_score_factor : 0.8);
      return tf("portal.factorLabel", { factor: factor });
    }
    return t("portal.onTime");
  }

  function linkNode(url) {
    if (!url) return el("span", "muted", t("portal.noLink"));
    var href = safeUrl(url);
    if (!href) return el("span", "", url);
    var a = el("a", "", href.replace(/^https?:\/\//, ""));
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  async function invokeProvision(body) {
    var result = await client.functions.invoke("provision-account", { body: body });
    if (!result.error) return result.data || { ok: true };
    var code = "";
    try {
      if (result.error.context && typeof result.error.context.json === "function") {
        var parsed = await result.error.context.json();
        code = parsed && parsed.error ? parsed.error : "";
      }
    } catch (_err) {
      code = "";
    }
    throw new Error(code || result.error.message || "create_failed");
  }

  function fillSelect(select, rows, getValue, getLabel, selected) {
    clear(select);
    rows.forEach(function (row) {
      var option = el("option", "", getLabel(row));
      option.value = getValue(row);
      if (selected && option.value === selected) option.selected = true;
      select.appendChild(option);
    });
  }

  function renderSession() {
    var profile = state.profile;
    $("session-name").textContent = profile.username;
    $("session-role").textContent = profile.role === "teacher" ? t("portal.role.teacher") : t("portal.role.student");
    var bits = [];
    if (profile.class_code) bits.push(profile.class_code);
    if (profile.seat_no) bits.push(profile.seat_no);
    $("session-meta").textContent = bits.join(" · ");
  }

  function renderStudentMeta() {
    var select = $("student-assignment");
    var assignment = assignmentById(select.value);
    var meta = $("student-meta");
    var button = $("submit-btn");
    if (!assignment) {
      meta.textContent = t("portal.emptyAssignments");
      button.disabled = true;
      return;
    }
    var info = timing(assignment);
    meta.textContent = info.text;
    button.disabled = info.kind === "closed";
  }

  function toggleCompare(list, id) {
    var next = list.filter(function (item) { return item !== id; });
    if (next.length === list.length) next.push(id);
    if (next.length > 2) next = next.slice(next.length - 2);
    return next;
  }

  function renderCompare(container, ids, rows) {
    clear(container);
    if (ids.length === 0) return;
    if (ids.length === 1) {
      container.appendChild(el("p", "muted", t("portal.compare.need")));
      return;
    }
    ids.forEach(function (id) {
      var row = null;
      for (var i = 0; i < rows.length; i += 1) {
        if (rows[i].id === id) row = rows[i];
      }
      if (!row) return;
      var payload = payloadOf(row);
      var card = el("article", "compare-card");
      card.appendChild(el("h4", "", t("portal.version") + " " + row.version_no));
      card.appendChild(el("p", "muted", formatTime(row.submitted_at) + " · " + statusLabel(row)));
      if (row.soft_deleted_at) card.appendChild(el("p", "deleted-badge", t("portal.roster.deleted")));
      card.appendChild(el("p", "", (payload.note || t("portal.noNote"))));
      var linkLine = el("p");
      linkLine.appendChild(document.createTextNode(t("portal.field.link") + "："));
      linkLine.appendChild(payload.link ? linkNode(payload.link) : el("span", "muted", t("portal.noLink")));
      card.appendChild(linkLine);
      container.appendChild(card);
    });
  }

  function renderHistory() {
    var wrap = $("history-table");
    clear(wrap);
    if (!state.versions.length) {
      wrap.appendChild(el("p", "muted", t("portal.emptyVersions")));
      renderCompare($("compare-panel"), [], []);
      return;
    }
    var table = el("table", "data-table");
    var head = el("tr");
    [t("portal.compare"), t("portal.version"), t("portal.submittedAt"), t("portal.field.link"), t("portal.field.note"), ""].forEach(function (label) {
      head.appendChild(el("th", "", label));
    });
    table.appendChild(head);
    state.versions.forEach(function (row) {
      var payload = payloadOf(row);
      var tr = el("tr");
      var checkCell = el("td");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.checked = state.studentCompare.indexOf(row.id) !== -1;
      box.addEventListener("change", function () {
        state.studentCompare = toggleCompare(state.studentCompare, row.id);
        renderHistory();
      });
      checkCell.appendChild(box);
      tr.appendChild(checkCell);
      tr.appendChild(el("td", "", String(row.version_no)));
      var when = el("td");
      when.appendChild(document.createTextNode(formatTime(row.submitted_at) + " "));
      when.appendChild(el("span", row.is_late ? "late-badge" : "ok-badge", statusLabel(row)));
      tr.appendChild(when);
      var linkCell = el("td");
      linkCell.appendChild(payload.link ? linkNode(payload.link) : el("span", "muted", t("portal.noLink")));
      tr.appendChild(linkCell);
      tr.appendChild(el("td", "", payload.note || t("portal.noNote")));
      tr.appendChild(el("td", "", ""));
      table.appendChild(tr);
    });
    wrap.appendChild(table);
    renderCompare($("compare-panel"), state.studentCompare, state.versions);
  }

  function renderStudentAssignments() {
    var rows = myAssignments();
    var select = $("student-assignment");
    var previous = select.value;
    fillSelect(select, rows, function (row) { return row.id; }, function (row) {
      return row.class_code + " · " + row.title;
    }, previous);
    show($("submit-form"), rows.length > 0);
    renderStudentMeta();
  }

  function renderAccounts() {
    var wrap = $("account-table");
    clear(wrap);
    var table = el("table", "data-table");
    var head = el("tr");
    [t("portal.accounts.username"), t("portal.accounts.role"), t("portal.accounts.class"), t("portal.accounts.seat"), t("portal.accounts.status"), t("portal.actions")].forEach(function (label) {
      head.appendChild(el("th", "", label));
    });
    table.appendChild(head);
    state.profiles.forEach(function (row) {
      var tr = el("tr");
      tr.appendChild(el("td", "", row.username));
      tr.appendChild(el("td", "", row.role === "teacher" ? t("portal.role.teacher") : t("portal.role.student")));
      tr.appendChild(el("td", "", row.class_code || "—"));
      tr.appendChild(el("td", "", row.seat_no || "—"));
      tr.appendChild(el("td", "", row.status === "disabled" ? t("portal.status.disabled") : t("portal.status.active")));
      var action = el("td");
      var button = el("button", "btn-small", t("portal.accounts.edit"));
      button.type = "button";
      button.addEventListener("click", function () { openEditor(row); });
      action.appendChild(button);
      tr.appendChild(action);
      table.appendChild(tr);
    });
    wrap.appendChild(table);
  }

  function openEditor(row) {
    state.editingId = row.id;
    $("edit-heading").textContent = row.username;
    $("edit-role").value = row.role;
    $("edit-status").value = row.status;
    $("edit-class").value = row.class_code || "";
    $("edit-seat").value = row.seat_no || "";
    $("edit-password").value = "";
    show($("edit-form"), true);
  }

  function renderAssignmentAdmin() {
    var wrap = $("assignment-table");
    clear(wrap);
    var table = el("table", "data-table");
    var head = el("tr");
    [t("portal.assign.class"), t("portal.assign.titleField"), t("portal.assign.due"), t("portal.assign.factor"), t("portal.actions")].forEach(function (label) {
      head.appendChild(el("th", "", label));
    });
    table.appendChild(head);
    state.assignments.forEach(function (row) {
      var tr = el("tr");
      tr.appendChild(el("td", "", row.class_code));
      tr.appendChild(el("td", "", row.title));
      tr.appendChild(el("td", "", row.due_at ? formatTime(row.due_at) : t("portal.noDue")));
      var factor = el("td", "", "×" + formatFactor(row.late_score_factor));
      if (!row.accept_late) factor.appendChild(el("div", "muted", t("portal.closedHint")));
      tr.appendChild(factor);
      var action = el("td");
      var button = el("button", "btn-small", t("portal.accounts.edit"));
      button.type = "button";
      button.addEventListener("click", function () {
        $("assignment-id").value = row.id;
        $("assignment-class").value = row.class_code;
        $("assignment-title").value = row.title;
        $("assignment-due").value = toHkInput(row.due_at);
        $("assignment-factor").value = formatFactor(row.late_score_factor);
        $("assignment-late").checked = !!row.accept_late;
      });
      action.appendChild(button);
      tr.appendChild(action);
      table.appendChild(tr);
    });
    wrap.appendChild(table);
    var roster = $("roster-assignment");
    var previous = roster.value;
    fillSelect(roster, state.assignments, function (row) { return row.id; }, function (row) {
      return row.class_code + " · " + row.title;
    }, previous);
  }

  function renderRoster() {
    var wrap = $("roster-table");
    clear(wrap);
    var assignment = assignmentById($("roster-assignment").value);
    if (!assignment) {
      wrap.appendChild(el("p", "muted", t("portal.emptyAssignments")));
      renderCompare($("roster-compare"), [], []);
      return;
    }
    var students = state.profiles.filter(function (row) {
      return row.role === "student" && row.class_code === assignment.class_code;
    });
    if (!students.length) {
      wrap.appendChild(el("p", "muted", t("portal.emptyAssignments")));
    }
    students.forEach(function (student) {
      var versions = state.rosterVersions.filter(function (row) {
        return row.student_id === student.id;
      });
      var active = versions.filter(function (row) { return !row.soft_deleted_at; });
      var latest = active[0] || null;
      var block = el("section");
      var title = student.username;
      if (student.seat_no) title = student.seat_no + " · " + title;
      if (student.status === "disabled") title += " (" + t("portal.status.disabled") + ")";
      block.appendChild(el("h3", "", title));
      var summary = latest
        ? t("portal.roster.versions") + " " + active.length + " · " + formatTime(latest.submitted_at) + " · " + statusLabel(latest)
        : t("portal.roster.none");
      block.appendChild(el("p", "muted", summary));
      if (versions.length) {
        var table = el("table", "data-table");
        versions.forEach(function (row) {
          var payload = payloadOf(row);
          var tr = el("tr", row.soft_deleted_at ? "is-deleted" : "");
          var checkCell = el("td");
          var box = document.createElement("input");
          box.type = "checkbox";
          box.checked = state.rosterCompare.indexOf(row.id) !== -1;
          box.addEventListener("change", function () {
            state.rosterCompare = toggleCompare(state.rosterCompare, row.id);
            renderRoster();
          });
          checkCell.appendChild(box);
          tr.appendChild(checkCell);
          tr.appendChild(el("td", "", t("portal.version") + " " + row.version_no));
          var when = el("td");
          when.appendChild(document.createTextNode(formatTime(row.submitted_at) + " "));
          when.appendChild(el("span", row.is_late ? "late-badge" : "ok-badge", statusLabel(row)));
          if (row.soft_deleted_at) when.appendChild(el("span", "deleted-badge", t("portal.roster.deleted")));
          tr.appendChild(when);
          var note = el("td", "", payload.note || t("portal.noNote"));
          tr.appendChild(note);
          var linkCell = el("td");
          linkCell.appendChild(payload.link ? linkNode(payload.link) : el("span", "muted", t("portal.noLink")));
          tr.appendChild(linkCell);
          var action = el("td");
          var button = el("button", "btn-warn", row.soft_deleted_at ? t("portal.roster.restore") : t("portal.roster.softDelete"));
          button.type = "button";
          button.addEventListener("click", function () { softDelete(row); });
          action.appendChild(button);
          tr.appendChild(action);
          table.appendChild(tr);
        });
        block.appendChild(table);
      }
      wrap.appendChild(block);
    });
    renderCompare($("roster-compare"), state.rosterCompare, state.rosterVersions);
  }

  async function loadAssignments() {
    var result = await client
      .from("assignments")
      .select("id, class_code, title, due_at, accept_late, late_score_factor, created_by, created_at")
      .order("class_code")
      .order("title");
    if (result.error) throw result.error;
    state.assignments = result.data || [];
  }

  async function loadMyVersions() {
    var select = $("student-assignment");
    if (!select.value) {
      state.versions = [];
      state.studentCompare = [];
      renderHistory();
      return;
    }
    var result = await client
      .from("submission_versions")
      .select("id, assignment_id, student_id, version_no, payload, submitted_at, is_late, soft_deleted_at")
      .eq("assignment_id", select.value)
      .eq("student_id", state.profile.id)
      .order("version_no", { ascending: false });
    if (result.error) throw result.error;
    state.versions = result.data || [];
    var ids = state.versions.map(function (row) { return row.id; });
    state.studentCompare = state.studentCompare.filter(function (id) { return ids.indexOf(id) !== -1; });
    renderHistory();
  }

  async function loadProfiles() {
    var result = await client
      .from("profiles")
      .select("id, username, role, class_code, seat_no, status, created_at")
      .order("role")
      .order("class_code")
      .order("username");
    if (result.error) throw result.error;
    state.profiles = result.data || [];
    renderAccounts();
  }

  async function loadRoster() {
    var id = $("roster-assignment").value;
    if (!id) {
      state.rosterVersions = [];
      renderRoster();
      return;
    }
    var result = await client
      .from("submission_versions")
      .select("id, assignment_id, student_id, version_no, payload, submitted_at, is_late, soft_deleted_at, soft_deleted_by")
      .eq("assignment_id", id)
      .order("version_no", { ascending: false });
    if (result.error) throw result.error;
    state.rosterVersions = result.data || [];
    var ids = state.rosterVersions.map(function (row) { return row.id; });
    state.rosterCompare = state.rosterCompare.filter(function (item) { return ids.indexOf(item) !== -1; });
    renderRoster();
  }

  async function refreshTeacher() {
    await loadProfiles();
    renderAssignmentAdmin();
    await loadRoster();
  }

  async function enterApp() {
    renderSession();
    show($("portal-login"), false);
    show($("portal-loading"), false);
    show($("portal-app"), true);
    await loadAssignments();
    if (state.profile.role === "teacher") {
      show($("teacher-view"), true);
      show($("student-view"), false);
      await refreshTeacher();
    } else {
      show($("student-view"), true);
      show($("teacher-view"), false);
      renderStudentAssignments();
      await loadMyVersions();
    }
  }

  async function signOut(messageKey) {
    state.profile = null;
    await client.auth.signOut();
    show($("portal-app"), false);
    show($("portal-loading"), false);
    show($("portal-login"), true);
    setMessage($("login-error"), messageKey ? t(messageKey) : "");
  }

  async function adoptSession(session) {
    if (!session) {
      show($("portal-loading"), false);
      show($("portal-login"), true);
      show($("portal-app"), false);
      return;
    }
    var result = await client
      .from("profiles")
      .select("id, username, role, class_code, seat_no, status")
      .eq("id", session.user.id)
      .maybeSingle();
    if (result.error || !result.data) {
      await signOut("portal.error.noprofile");
      return;
    }
    if (result.data.status !== "active" || (result.data.role !== "student" && result.data.role !== "teacher")) {
      await signOut("portal.error.disabled");
      return;
    }
    state.profile = result.data;
    setMessage($("login-error"), "");
    await enterApp();
  }

  async function softDelete(row) {
    if (!row.soft_deleted_at && !window.confirm(t("portal.confirmDelete"))) return;
    setMessage($("app-error"), "");
    var patch = row.soft_deleted_at
      ? { soft_deleted_at: null, soft_deleted_by: null }
      : { soft_deleted_at: new Date().toISOString() };
    var result = await client.from("submission_versions").update(patch).eq("id", row.id);
    if (result.error) {
      setMessage($("app-error"), errorText(result.error));
      return;
    }
    setMessage($("app-ok"), t("portal.saved"));
    await loadRoster();
  }

  function showTab(name) {
    ["accounts", "assignments", "roster"].forEach(function (tab) {
      var on = tab === name;
      show($("tab-" + tab), on);
      var button = document.querySelector('.portal-tab[data-tab="' + tab + '"]');
      if (button) button.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function cleanClass(value, required) {
    var text = String(value || "").trim();
    if (!text) return required ? null : "";
    return CLASS_RE.test(text) ? text : null;
  }

  function cleanSeat(value) {
    var text = String(value || "").trim();
    if (!text) return "";
    return SEAT_RE.test(text) ? text : null;
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("login-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      setMessage($("login-error"), "");
      var email = emailForUsername($("login-username").value);
      if (!email) {
        setMessage($("login-error"), t("portal.error.invalid_username"));
        return;
      }
      var result = await client.auth.signInWithPassword({
        email: email,
        password: $("login-password").value,
      });
      if (result.error) {
        setMessage($("login-error"), errorText(result.error));
        return;
      }
      $("login-password").value = "";
      await adoptSession(result.data.session);
    });

    $("logout-btn").addEventListener("click", function () {
      signOut("");
    });

    $("student-assignment").addEventListener("change", async function () {
      state.studentCompare = [];
      renderStudentMeta();
      try {
        await loadMyVersions();
      } catch (error) {
        setMessage($("app-error"), errorText(error));
      }
    });

    $("submit-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      setMessage($("app-error"), "");
      setMessage($("app-ok"), "");
      var assignment = assignmentById($("student-assignment").value);
      if (!assignment) return;
      var link = $("submit-link").value.trim();
      var note = $("submit-note").value.trim();
      if (!link && !note) {
        setMessage($("app-error"), t("portal.error.needContent"));
        return;
      }
      if (link && !safeUrl(link)) {
        setMessage($("app-error"), t("portal.error.badUrl"));
        return;
      }
      var info = timing(assignment);
      if (info.kind === "closed") {
        setMessage($("app-error"), t("portal.error.lateClosed"));
        return;
      }
      var result = await client.from("submission_versions").insert({
        assignment_id: assignment.id,
        student_id: state.profile.id,
        version_no: 1,
        payload: { link: link, note: note },
        is_late: false,
      }).select("id").single();
      if (result.error) {
        setMessage($("app-error"), errorText(result.error));
        return;
      }
      $("submit-link").value = "";
      $("submit-note").value = "";
      setMessage($("app-ok"), t("portal.saved"));
      await loadMyVersions();
    });

    document.querySelectorAll(".portal-tab").forEach(function (button) {
      button.addEventListener("click", function () {
        showTab(button.getAttribute("data-tab"));
      });
    });

    $("create-show-password").addEventListener("change", function () {
      $("create-password").type = $("create-show-password").checked ? "text" : "password";
    });

    $("create-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      setMessage($("app-error"), "");
      setMessage($("app-ok"), "");
      var username = $("create-username").value.trim();
      var classCode = cleanClass($("create-class").value, $("create-role").value === "student");
      var seat = cleanSeat($("create-seat").value);
      if (!USERNAME_RE.test(username)) {
        setMessage($("app-error"), t("portal.error.invalid_username"));
        return;
      }
      if (classCode == null || seat == null) {
        setMessage($("app-error"), t("portal.error.invalid_class"));
        return;
      }
      try {
        await invokeProvision({
          action: "create",
          username: username,
          password: $("create-password").value,
          role: $("create-role").value,
          class_code: classCode || null,
          seat_no: seat || null,
        });
      } catch (error) {
        setMessage($("app-error"), errorText(error));
        return;
      }
      $("create-form").reset();
      $("create-password").type = "password";
      setMessage($("app-ok"), t("portal.saved"));
      await loadProfiles();
    });

    $("edit-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!state.editingId) return;
      setMessage($("app-error"), "");
      setMessage($("app-ok"), "");
      var classCode = cleanClass($("edit-class").value, $("edit-role").value === "student");
      var seat = cleanSeat($("edit-seat").value);
      if (classCode == null || seat == null) {
        setMessage($("app-error"), t("portal.error.invalid_class"));
        return;
      }
      var current = null;
      state.profiles.forEach(function (row) {
        if (row.id === state.editingId) current = row;
      });
      var profileUpdate = await client.from("profiles").update({
        role: $("edit-role").value,
        class_code: classCode || null,
        seat_no: seat || null,
      }).eq("id", state.editingId);
      if (profileUpdate.error) {
        setMessage($("app-error"), errorText(profileUpdate.error));
        return;
      }
      try {
        if (current && current.status !== $("edit-status").value) {
          await invokeProvision({
            action: "set_status",
            user_id: state.editingId,
            status: $("edit-status").value,
          });
        }
        if ($("edit-password").value) {
          await invokeProvision({
            action: "set_password",
            user_id: state.editingId,
            password: $("edit-password").value,
          });
        }
      } catch (error) {
        setMessage($("app-error"), errorText(error));
        await loadProfiles();
        return;
      }
      $("edit-password").value = "";
      setMessage($("app-ok"), t("portal.saved"));
      await loadProfiles();
    });

    $("assignment-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      setMessage($("app-error"), "");
      setMessage($("app-ok"), "");
      var classCode = cleanClass($("assignment-class").value, true);
      var title = $("assignment-title").value.trim();
      var factor = Number($("assignment-factor").value);
      if (!classCode) {
        setMessage($("app-error"), t("portal.error.invalid_class"));
        return;
      }
      if (!title || title.length > 120 || !isFinite(factor) || factor < 0 || factor > 1) {
        setMessage($("app-error"), t("portal.error.generic"));
        return;
      }
      var payload = {
        class_code: classCode,
        title: title,
        due_at: fromHkInput($("assignment-due").value),
        accept_late: $("assignment-late").checked,
        late_score_factor: factor,
      };
      var id = $("assignment-id").value;
      var result = id
        ? await client.from("assignments").update(payload).eq("id", id)
        : await client.from("assignments").insert(Object.assign({ created_by: state.profile.id }, payload));
      if (result.error) {
        setMessage($("app-error"), errorText(result.error));
        return;
      }
      $("assignment-id").value = "";
      setMessage($("app-ok"), t("portal.saved"));
      await loadAssignments();
      renderAssignmentAdmin();
      await loadRoster();
    });

    $("assignment-reset").addEventListener("click", function () {
      $("assignment-form").reset();
      $("assignment-id").value = "";
      $("assignment-factor").value = "0.8";
      $("assignment-late").checked = true;
    });

    $("roster-assignment").addEventListener("change", async function () {
      state.rosterCompare = [];
      try {
        await loadRoster();
      } catch (error) {
        setMessage($("app-error"), errorText(error));
      }
    });

    document.addEventListener("langchange", function () {
      if (!state.profile) return;
      renderSession();
      if (state.profile.role === "teacher") {
        renderAccounts();
        renderAssignmentAdmin();
        renderRoster();
      } else {
        renderStudentAssignments();
        renderHistory();
      }
    });

    client.auth.getSession().then(function (result) {
      adoptSession(result.data.session).catch(function (error) {
        setMessage($("login-error"), errorText(error));
        show($("portal-loading"), false);
        show($("portal-login"), true);
      });
    });
  });
})();
