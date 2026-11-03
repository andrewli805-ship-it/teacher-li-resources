/**
 * Read-only class wall. Always uses the anon key, so a signed-in session
 * does not change what guests can see. Submissions are not stored here.
 */
(function () {
  var root = document.getElementById("gallery-wall");
  var classCode = root ? String(root.getAttribute("data-class-code") || "") : "";
  var rows = [];
  var failed = false;

  function t(key) {
    if (window.TeacherLiI18n) return window.TeacherLiI18n.t(key);
    return key;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
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

  function visibleRows() {
    var search = document.getElementById("exhibit-search");
    var sort = document.getElementById("exhibit-sort");
    var query = search ? search.value.trim().toLowerCase() : "";
    var mode = sort ? sort.value : "seat";
    var list = rows.filter(function (row) {
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

  function seatText(row, duplicate) {
    var label = t("aigame.field.studentNo") + " " + row.student_no;
    if (duplicate) return String(row.school_year) + " · " + label;
    return label;
  }

  function render() {
    var grid = document.getElementById("exhibit-grid");
    var empty = document.getElementById("exhibit-empty");
    var status = document.getElementById("exhibit-status");
    if (!grid) return;
    clear(grid);
    if (failed) {
      if (status) {
        status.hidden = false;
        status.textContent = t("gallery.loadError");
      }
      if (empty) empty.hidden = true;
      return;
    }
    if (status) status.hidden = true;
    var list = visibleRows();
    var counts = {};
    list.forEach(function (row) {
      counts[row.student_no] = (counts[row.student_no] || 0) + 1;
    });
    if (empty) empty.hidden = list.length !== 0;
    list.forEach(function (row) {
      var card = document.createElement("article");
      card.className = "exhibit-card";
      var meta = document.createElement("div");
      meta.className = "exhibit-meta";
      var seat = document.createElement("p");
      seat.className = "exhibit-seat";
      seat.textContent = seatText(row, counts[row.student_no] > 1);
      meta.appendChild(seat);
      var name = document.createElement("h3");
      name.textContent = String(row.student_name || "");
      name.title = String(row.student_name || "");
      var href = safeHttpUrl(row.game_url);
      var play;
      if (href) {
        play = document.createElement("a");
        play.className = "btn-enter";
        play.href = href;
        play.target = "_blank";
        play.rel = "noopener noreferrer";
        play.textContent = t("gallery.play");
      } else {
        play = document.createElement("span");
        play.className = "exhibit-link-bad";
        play.textContent = t("gallery.linkBad");
      }
      card.appendChild(meta);
      card.appendChild(name);
      card.appendChild(play);
      grid.appendChild(card);
    });
  }

  function anonClient() {
    var cfg = window.HOMEWORK_SUPABASE;
    if (!cfg || !window.supabase || !cfg.url || !cfg.publishableKey) return null;
    return window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  function load() {
    var client = anonClient();
    var status = document.getElementById("exhibit-status");
    if (!client || (classCode !== "2D" && classCode !== "2H")) {
      failed = true;
      render();
      return;
    }
    if (status) {
      status.hidden = false;
      status.textContent = t("portal.loading");
    }
    client
      .from("ai_game_entries")
      .select("school_year, class_code, student_no, student_name, game_url, submitted_at")
      .eq("class_code", classCode)
      .then(function (result) {
        if (result.error) {
          failed = true;
          rows = [];
        } else {
          failed = false;
          rows = result.data || [];
        }
        render();
      })
      .catch(function () {
        failed = true;
        rows = [];
        render();
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var search = document.getElementById("exhibit-search");
    var sort = document.getElementById("exhibit-sort");
    if (search) search.addEventListener("input", render);
    if (sort) sort.addEventListener("change", render);
    document.addEventListener("langchange", render);
    load();
  });
})();
