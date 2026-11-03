/**
 * Signed-in AI mini-game submit / teacher manage.
 * Role comes from public.profiles, never from user_metadata.
 * The same year + class + student number updates one row.
 */
(function () {
  var page = window.AI_GAME_PAGE || {};
  var classCode = page.classCode === "2H" ? "2H" : page.classCode === "2D" ? "2D" : "";
  var schoolYear = Number(page.schoolYear);
  if (!Number.isInteger(schoolYear)) schoolYear = 2627;

  var state = {
    profile: null,
    assignment: null,
    rows: [],
    editingId: null,
    saving: false,
    ready: false,
  };

  function t(key) {
    if (window.TeacherLiI18n) return window.TeacherLiI18n.t(key);
    return key;
  }

  function tf(key, vars) {
    return t(key).replace(/\{(\w+)\}/g, function (_match, name) {
      return vars[name] == null ? "" : String(vars[name]);
    });
  }

  function $(id) {
    return document.getElementById(id);
  }

  function client() {
    return window.TeacherLiAuth && window.TeacherLiAuth.client;
  }

  function here() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  function loginUrl() {
    if (window.TeacherLiAuth) return window.TeacherLiAuth.loginUrl(here());
    return "portal.html?next=" + encodeURIComponent(here());
  }

  function goLogin() {
    window.location.replace(loginUrl());
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
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

  function isTeacher() {
    return !!(state.profile && state.profile.role === "teacher" && state.profile.status === "active");
  }

  function isStudent() {
    return !!(state.profile && state.profile.role === "student" && state.profile.status === "active");
  }

  function safeHttpUrl(value) {
    var text = String(value || "").trim();
    if (!/^https?:\/\//i.test(text) || /\s/.test(text)) return "";
    try {
      var url = new URL(text);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      if (url.href.length > 2000) return "";
      return url.href;
    } catch (_err) {
      return "";
    }
  }

  function cleanYear(value) {
    var n = Number(value);
    if (!Number.isInteger(n) || n < 2000 || n > 9999) return null;
    return n;
  }

  function cleanSeat(value) {
    var n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 99) return null;
    return n;
  }

  function cleanName(value) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 80 || /[\u0000-\u001F]/.test(text)) return null;
    return text;
  }

  function formatFactor(value) {
    var n = Number(value);
    if (!isFinite(n)) return "0.8";
    return String(Math.round(n * 1000) / 1000);
  }

  function formatTime(iso) {
    if (!iso) return "";
    var lang = window.TeacherLiI18n && window.TeacherLiI18n.getLang() === "en" ? "en-HK" : "zh-HK";
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

  function formatCsvTime(iso) {
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
    return parts.year + "-" + parts.month + "-" + parts.day + " " + parts.hour + ":" + parts.minute;
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
    var date = new Date(value + ":00+08:00");
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  function timing() {
    var assignment = state.assignment;
    if (!assignment || !assignment.due_at) return "none";
    if (Date.now() <= new Date(assignment.due_at).getTime()) return "open";
    return assignment.accept_late ? "late" : "closed";
  }

  function errorText(error) {
    var msg = "";
    if (error) msg = String(error.message || error.msg || error.details || error.code || "");
    if (/late_closed/.test(msg)) return t("aigame.closed");
    if (/bad_url/.test(msg)) return t("portal.error.badUrl");
    if (/bad_year/.test(msg)) return t("aigame.error.year");
    if (/bad_seat/.test(msg)) return t("aigame.error.seat");
    if (/bad_name/.test(msg)) return t("aigame.error.name");
    if (/assignment_missing/.test(msg)) return t("aigame.error.missing");
    if (/duplicate key|23505/.test(msg)) return t("aigame.error.taken");
    if (/teacher_only|not_student|row-level security/i.test(msg)) return t("portal.error.teacher_only");
    return t("portal.error.generic");
  }

  function csvField(value) {
    var clean = String(value == null ? "" : value).replace(/\r?\n/g, " ").trim();
    if (/^[=+\-@]/.test(clean)) clean = "'" + clean;
    return '"' + clean.replace(/"/g, '""') + '"';
  }

  function visibleRows() {
    var query = ($("aigame-search") ? $("aigame-search").value : "").trim().toLowerCase();
    var mode = $("aigame-sort") ? $("aigame-sort").value : "seat";
    var list = state.rows.filter(function (row) {
      if (!isTeacher() && row.submitted_by !== state.profile.id) return false;
      if (!query) return true;
      var name = String(row.student_name || "").toLowerCase();
      var seat = String(row.student_no);
      return name.indexOf(query) !== -1 || seat.indexOf(query) !== -1;
    });
    list.sort(function (a, b) {
      if (mode === "newest") return String(b.submitted_at || "").localeCompare(String(a.submitted_at || ""));
      if (a.student_no !== b.student_no) return a.student_no - b.student_no;
      if (a.school_year !== b.school_year) return a.school_year - b.school_year;
      return String(a.student_name || "").localeCompare(String(b.student_name || ""), "zh-Hant");
    });
    return list;
  }

  function renderCards() {
    var grid = $("aigame-grid");
    var empty = $("aigame-empty");
    if (!grid) return;
    clear(grid);
    var list = visibleRows();
    if (empty) empty.hidden = list.length !== 0;
    var counts = {};
    list.forEach(function (row) {
      counts[row.student_no] = (counts[row.student_no] || 0) + 1;
    });
    list.forEach(function (row) {
      var card = document.createElement("article");
      card.className = "exhibit-card";
      var meta = document.createElement("div");
      meta.className = "exhibit-meta";
      var seat = document.createElement("p");
      seat.className = "exhibit-seat";
      var seatLabel = t("aigame.field.studentNo") + " " + row.student_no;
      seat.textContent = counts[row.student_no] > 1 ? row.school_year + " · " + seatLabel : seatLabel;
      meta.appendChild(seat);
      if (row.is_late) {
        var late = document.createElement("span");
        late.className = "late-badge";
        late.textContent = t("aigame.late");
        meta.appendChild(late);
      }
      var name = document.createElement("h3");
      name.textContent = String(row.student_name || "");
      name.title = String(row.student_name || "");
      card.appendChild(meta);
      card.appendChild(name);
      if (isTeacher()) {
        var year = document.createElement("p");
        year.className = "exhibit-year";
        year.textContent = String(row.school_year) + " · " + formatTime(row.submitted_at);
        card.appendChild(year);
      }
      var href = safeHttpUrl(row.game_url);
      if (href) {
        var play = document.createElement("a");
        play.className = "btn-enter";
        play.href = href;
        play.target = "_blank";
        play.rel = "noopener noreferrer";
        play.textContent = t("gallery.play");
        card.appendChild(play);
      } else {
        var bad = document.createElement("span");
        bad.className = "exhibit-link-bad";
        bad.textContent = t("gallery.linkBad");
        card.appendChild(bad);
      }
      if (isTeacher()) {
        var edit = document.createElement("button");
        edit.type = "button";
        edit.className = "btn-small";
        edit.textContent = t("aigame.edit");
        edit.addEventListener("click", function () {
          startEdit(row);
        });
        card.appendChild(edit);
      }
      grid.appendChild(card);
    });
  }

  function renderChrome() {
    var teacher = isTeacher();
    var closed = isStudent() && timing() === "closed";
    var teacherBox = $("aigame-teacher");
    if (teacherBox) teacherBox.hidden = !teacher;
    var progress = $("aigame-progress");
    if (progress && teacher) progress.textContent = tf("aigame.progress", { n: state.rows.length });
    var submit = $("aigame-submit");
    if (submit) {
      submit.textContent = state.editingId ? t("aigame.saveEdit") : t("aigame.submit");
      submit.disabled = state.saving || closed || !state.assignment;
    }
    var cancel = $("aigame-cancel");
    if (cancel) cancel.hidden = !state.editingId;
    ["aigame-year", "aigame-no", "aigame-name", "aigame-url"].forEach(function (id) {
      var node = $(id);
      if (node) node.disabled = closed;
    });
    var settingsBtn = $("aigame-settings-save");
    if (settingsBtn) settingsBtn.disabled = state.saving;
    var status = $("aigame-timing");
    if (status && state.assignment) {
      status.hidden = false;
      clear(status);
      var due = document.createElement("span");
      if (!state.assignment.due_at) {
        due.textContent = t("portal.noDue");
      } else {
        due.textContent = t("portal.due") + " " + formatTime(state.assignment.due_at);
      }
      status.appendChild(due);
      if (timing() === "closed") {
        var badge = document.createElement("span");
        badge.className = "late-badge";
        badge.textContent = t("aigame.closed");
        status.appendChild(badge);
      } else if (timing() === "late") {
        var lateBadge = document.createElement("span");
        lateBadge.className = "late-badge";
        lateBadge.textContent = t("aigame.late");
        status.appendChild(lateBadge);
      }
    }
    renderCards();
  }

  function resetEntryForm() {
    state.editingId = null;
    if ($("aigame-year")) $("aigame-year").value = String(schoolYear);
    if ($("aigame-class")) $("aigame-class").value = classCode;
    if ($("aigame-no")) $("aigame-no").value = "";
    if ($("aigame-name")) $("aigame-name").value = "";
    if ($("aigame-url")) $("aigame-url").value = "";
    renderChrome();
  }

  function startEdit(row) {
    if (!isTeacher()) return;
    state.editingId = row.id;
    $("aigame-year").value = String(row.school_year);
    $("aigame-class").value = classCode;
    $("aigame-no").value = String(row.student_no);
    $("aigame-name").value = String(row.student_name || "");
    $("aigame-url").value = String(row.game_url || "");
    setMessage($("aigame-error"), "");
    setMessage($("aigame-ok"), "");
    renderChrome();
    var panel = $("aigame-form-panel");
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fillSettings() {
    if (!state.assignment) return;
    if ($("aigame-due")) $("aigame-due").value = toHkInput(state.assignment.due_at);
    if ($("aigame-late")) $("aigame-late").checked = !!state.assignment.accept_late;
    if ($("aigame-factor")) $("aigame-factor").value = formatFactor(state.assignment.late_score_factor);
  }

  async function loadAssignment() {
    var result = await client()
      .from("assignments")
      .select("id, class_code, title, due_at, accept_late, late_score_factor, kind")
      .eq("class_code", classCode)
      .eq("kind", "ai_game")
      .maybeSingle();
    if (result.error) throw result.error;
    state.assignment = result.data || null;
    if (!state.assignment) {
      var missing = new Error("assignment_missing");
      throw missing;
    }
    fillSettings();
  }

  async function loadRows() {
    var result = await client()
      .from("ai_game_entries")
      .select("id, school_year, class_code, student_no, student_name, game_url, submitted_at, is_late, submitted_by")
      .eq("class_code", classCode);
    if (result.error) throw result.error;
    state.rows = result.data || [];
  }

  async function saveEntry(event) {
    event.preventDefault();
    setMessage($("aigame-error"), "");
    setMessage($("aigame-ok"), "");
    if (state.saving || !state.profile) return;
    if (isStudent() && timing() === "closed") {
      setMessage($("aigame-error"), t("aigame.closed"));
      return;
    }
    var year = cleanYear($("aigame-year").value);
    var seat = cleanSeat($("aigame-no").value);
    var name = cleanName($("aigame-name").value);
    var url = safeHttpUrl($("aigame-url").value);
    if (year == null) {
      setMessage($("aigame-error"), t("aigame.error.year"));
      return;
    }
    if (seat == null) {
      setMessage($("aigame-error"), t("aigame.error.seat"));
      return;
    }
    if (!name) {
      setMessage($("aigame-error"), t("aigame.error.name"));
      return;
    }
    if (!url) {
      setMessage($("aigame-error"), t("portal.error.badUrl"));
      return;
    }
    var payload = {
      school_year: year,
      class_code: classCode,
      student_no: seat,
      student_name: name,
      game_url: url,
    };
    state.saving = true;
    renderChrome();
    var query = state.editingId && isTeacher()
      ? client().from("ai_game_entries").update(payload).eq("id", state.editingId).eq("class_code", classCode)
      : client().from("ai_game_entries").upsert(payload, { onConflict: "school_year,class_code,student_no" });
    var result = await query.select("id, school_year, class_code, student_no, student_name, game_url, submitted_at, is_late, submitted_by");
    state.saving = false;
    if (result.error || !result.data || !result.data.length) {
      setMessage($("aigame-error"), errorText(result.error));
      renderChrome();
      return;
    }
    setMessage($("aigame-ok"), t("portal.saved"));
    state.editingId = null;
    if ($("aigame-class")) $("aigame-class").value = classCode;
    if ($("aigame-no")) $("aigame-no").value = "";
    if ($("aigame-name")) $("aigame-name").value = "";
    if ($("aigame-url")) $("aigame-url").value = "";
    try {
      await loadRows();
    } catch (error) {
      setMessage($("aigame-error"), errorText(error));
    }
    renderChrome();
  }

  async function saveSettings(event) {
    event.preventDefault();
    setMessage($("aigame-error"), "");
    setMessage($("aigame-ok"), "");
    if (!isTeacher() || state.saving || !state.assignment) return;
    var factor = Number($("aigame-factor").value);
    if (!isFinite(factor) || factor < 0 || factor > 1) {
      setMessage($("aigame-error"), t("portal.error.generic"));
      return;
    }
    var dueRaw = $("aigame-due").value;
    var due = fromHkInput(dueRaw);
    if (dueRaw && !due) {
      setMessage($("aigame-error"), t("portal.error.generic"));
      return;
    }
    state.saving = true;
    renderChrome();
    var result = await client()
      .from("assignments")
      .update({
        due_at: due,
        accept_late: $("aigame-late").checked,
        late_score_factor: factor,
      })
      .eq("id", state.assignment.id)
      .eq("kind", "ai_game")
      .select("id, class_code, title, due_at, accept_late, late_score_factor, kind")
      .maybeSingle();
    state.saving = false;
    if (result.error || !result.data) {
      setMessage($("aigame-error"), errorText(result.error));
      renderChrome();
      return;
    }
    state.assignment = result.data;
    fillSettings();
    setMessage($("aigame-ok"), t("portal.saved"));
    renderChrome();
  }

  function exportCsv() {
    if (!isTeacher()) return;
    var headers = ["年份", "班級", "學號", "姓名", "AI遊戲網頁連結", "繳交時間", "是否遲交"];
    var list = state.rows.slice().sort(function (a, b) {
      if (a.school_year !== b.school_year) return a.school_year - b.school_year;
      if (a.student_no !== b.student_no) return a.student_no - b.student_no;
      return String(a.student_name || "").localeCompare(String(b.student_name || ""), "zh-Hant");
    });
    var lines = [headers.map(csvField).join(",")];
    list.forEach(function (row) {
      lines.push([
        row.school_year,
        row.class_code,
        row.student_no,
        row.student_name,
        row.game_url,
        formatCsvTime(row.submitted_at),
        row.is_late ? "是" : "否",
      ].map(csvField).join(","));
    });
    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    var url = URL.createObjectURL(blob);
    var day = formatCsvTime(new Date().toISOString()).slice(0, 10) || "export";
    link.href = url;
    link.download = "AI_Game_" + schoolYear + "_" + classCode + "_" + day + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function boot() {
    if (!classCode || !client()) {
      goLogin();
      return;
    }
    var sessionResult = await client().auth.getSession();
    var session = sessionResult.data ? sessionResult.data.session : null;
    if (!session || !session.user) {
      goLogin();
      return;
    }
    var profileResult = await client()
      .from("profiles")
      .select("id, role, status, class_code, seat_no")
      .eq("id", session.user.id)
      .maybeSingle();
    if (profileResult.error || !profileResult.data) {
      window.location.replace("portal.html");
      return;
    }
    if (profileResult.data.status !== "active" || (profileResult.data.role !== "student" && profileResult.data.role !== "teacher")) {
      window.location.replace("portal.html");
      return;
    }
    state.profile = profileResult.data;
    try {
      await loadAssignment();
      await loadRows();
    } catch (error) {
      setMessage($("aigame-error"), errorText(error));
    }
    if ($("aigame-loading")) $("aigame-loading").hidden = true;
    if ($("aigame-app")) $("aigame-app").hidden = false;
    resetEntryForm();
    state.ready = true;
    client().auth.onAuthStateChange(function (event) {
      if (!state.ready) return;
      if (event === "SIGNED_OUT") goLogin();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = $("aigame-form");
    if (form) form.addEventListener("submit", function (event) {
      saveEntry(event).catch(function (error) {
        state.saving = false;
        setMessage($("aigame-error"), errorText(error));
        renderChrome();
      });
    });
    var settings = $("aigame-settings");
    if (settings) settings.addEventListener("submit", function (event) {
      saveSettings(event).catch(function (error) {
        state.saving = false;
        setMessage($("aigame-error"), errorText(error));
        renderChrome();
      });
    });
    var cancel = $("aigame-cancel");
    if (cancel) cancel.addEventListener("click", function () {
      setMessage($("aigame-error"), "");
      setMessage($("aigame-ok"), "");
      resetEntryForm();
    });
    var exportBtn = $("aigame-export");
    if (exportBtn) exportBtn.addEventListener("click", exportCsv);
    var search = $("aigame-search");
    if (search) search.addEventListener("input", renderCards);
    var sort = $("aigame-sort");
    if (sort) sort.addEventListener("change", renderCards);
    document.addEventListener("langchange", function () {
      if (!state.profile) return;
      renderChrome();
    });
    boot().catch(function () {
      goLogin();
    });
  });
})();
