/**
 * AI mini-game showcase (ported from the TPSY class embed).
 * Each page sets window.AI_GAME_CONFIG before this file loads.
 * Submissions are per browser, under that page's storageKey.
 * 2D and 2H must not share a key.
 */
(function () {
  const CONFIG = window.AI_GAME_CONFIG || {};
  const STORAGE_KEY = typeof CONFIG.storageKey === "string" ? CONFIG.storageKey : "";
  const LANG_KEY = "ai_game_lang";
  const SITE_LANG_KEY = "teacher-li-lang";
  const CSV_PREFIX = String(CONFIG.csvPrefix || "AI_Game_Submissions").replace(
    /[^A-Za-z0-9_-]/g,
    ""
  );
  const TOTAL_STUDENTS = 40;

  if (!/^ai_game_submissions_[a-z0-9_-]+$/.test(STORAGE_KEY)) {
    document.body.innerHTML =
      '<p style="font-family:sans-serif;padding:2rem;line-height:1.5">此頁缺少班別設定，暫時不能使用。<br>This page is missing its class configuration.</p>';
    return;
  }

  const i18n = {
    zh: {
      appTitle: "🎮 AI 小遊戲作品展覽館",
      appSubtitle:
        "請同學們輸入自己的座號、姓名及 AI 遊戲網頁連結。若需修改資料，只需點擊卡片上的「修改資料」或重新輸入該座號送出即可！",
      classLabel: CONFIG.labelZh || "",
      docTitle: (CONFIG.labelZh || "") + " · AI 小遊戲作品展覽館",
      storageNote:
        "資料只儲存在這部瀏覽器。換電腦、換瀏覽器或清除網站資料後便會消失，請使用同一瀏覽器查看及匯出。",
      backLink: "← 返回 ICT 交功課",
      progressLabel: "全班繳交進度",
      progressText: "{count} / {total} 人 ({percent}%)",
      formHeading: "📝 學生提交表單",
      editFormHeading: "✏️ 修改座號 {no} 的作品資料",
      editingBadge: "修改模式",
      cancelEditBtn: "✕ 取消修改",
      lblSeat: "座號 (1-40)",
      phSeat: "請輸入座號 (1-40)",
      lblName: "學生姓名",
      phName: "例如：張小明",
      lblUrl: "AI 遊戲網頁連結 (URL)",
      phUrl: "https://example.com/my-ai-game",
      btnSubmit: "提交",
      submitWork: "提交作品",
      btnSaveEdit: "儲存修改",
      phSearch: "🔍 搜尋座號或姓名...",
      optAll: "顯示全部 (40位)",
      optSubmitted: "僅顯示已繳交",
      optUnsubmitted: "僅顯示未繳交",
      btnExportText: "複製 / 匯出 Excel 清單",
      seatBadge: "座號",
      statusSubmitted: "已繳交",
      statusUnsubmitted: "未繳交",
      noSubmission: "尚無作品",
      clickToAdd: "+ 點此填寫",
      playGame: "進入遊戲 ↗",
      editData: "修改資料 ✏️",
      linkUnavailable: "連結無效",
      alertValidSeat: "座號必須介於 1 到 40 之間！",
      alertNameRequired: "請輸入學生姓名。",
      alertValidUrl: "請輸入以 http:// 或 https:// 開頭的網頁連結。",
      alertSaveFail: "無法寫入這部瀏覽器的儲存空間。請檢查是否停用了網站資料，然後再試一次。",
      alertSaveSuccess: "✅ 座號 {no} 號（{name}）的 AI 遊戲資料已順利儲存！",
      alertNoDataExport: "目前尚未有任何學生繳交作品！",
      alertExportSuccess:
        "成功複製 {count} 筆學生資料！可以直接貼上到 Excel 或 Google 表格中。",
      exportModalTitle: "📋 學生作品連結清單",
      exportModalDesc:
        "請點擊下方「下載 Excel CSV 檔」或直接全選下方文字複製到 Excel：",
      btnDownloadCsv: "⬇️ 下載 Excel CSV 檔",
      btnClose: "關閉",
      excelHeader: "座號\t姓名\tAI遊戲網頁連結\n",
      csvHeader: "座號,姓名,AI遊戲網頁連結",
    },
    en: {
      appTitle: "🎮 AI Mini-Game Showcase Platform",
      appSubtitle:
        "Students, please enter your seat number, name, and AI game web URL. To edit your submission, click 'Edit' on your card or submit again with the same seat number!",
      classLabel: CONFIG.labelEn || "",
      docTitle: (CONFIG.labelEn || "") + " · AI Mini-Game Showcase",
      storageNote:
        "Saved only in this browser. Switching devices or browsers, or clearing site data, removes it. View and export from the same browser.",
      backLink: "← Back to ICT homework",
      progressLabel: "Class Submission Progress",
      progressText: "{count} / {total} Students ({percent}%)",
      formHeading: "📝 Student Submission Form",
      editFormHeading: "✏️ Edit Submission for Seat #{no}",
      editingBadge: "Edit Mode",
      cancelEditBtn: "✕ Cancel Edit",
      lblSeat: "Seat No. (1-40)",
      phSeat: "Seat number (1-40)",
      lblName: "Student Name",
      phName: "e.g. John Doe",
      lblUrl: "AI Game Web URL",
      phUrl: "https://example.com/my-ai-game",
      btnSubmit: "Submit",
      submitWork: "Submit work",
      btnSaveEdit: "Save Changes",
      phSearch: "🔍 Search seat or name...",
      optAll: "Show All (40 Seats)",
      optSubmitted: "Submitted Only",
      optUnsubmitted: "Unsubmitted Only",
      btnExportText: "Copy / Export Excel List",
      seatBadge: "Seat",
      statusSubmitted: "Submitted",
      statusUnsubmitted: "Pending",
      noSubmission: "No Game Yet",
      clickToAdd: "+ Click to fill",
      playGame: "Play Game ↗",
      editData: "Edit Data ✏️",
      linkUnavailable: "Link unavailable",
      alertValidSeat: "Seat number must be between 1 and 40!",
      alertNameRequired: "Please enter the student name.",
      alertValidUrl: "Please enter a link that starts with http:// or https://.",
      alertSaveFail:
        "Could not save to this browser's storage. Check that site data is allowed, then try again.",
      alertSaveSuccess: "✅ Saved submission for Seat #{no} ({name}) successfully!",
      alertNoDataExport: "There are no student submissions to export yet!",
      alertExportSuccess:
        "Successfully copied {count} records! You can now paste directly into Excel or Google Sheets.",
      exportModalTitle: "📋 Student Submission List",
      exportModalDesc:
        "Please click 'Download Excel CSV File' below or select and copy the text directly into Excel:",
      btnDownloadCsv: "⬇️ Download Excel CSV",
      btnClose: "Close",
      excelHeader: "Seat\tName\tAI Game URL\n",
      csvHeader: "Seat,Name,AI Game URL",
    },
  };

  let currentLang = readLang();
  let submissions = loadSubmissions();
  let isEditing = false;
  let currentEditingNo = null;

  const form = document.getElementById("submitForm");
  const gridContainer = document.getElementById("gridContainer");
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");

  function readLang() {
    try {
      const own = localStorage.getItem(LANG_KEY);
      if (own === "zh" || own === "en") return own;
      const site = localStorage.getItem(SITE_LANG_KEY);
      if (site === "zh" || site === "en") return site;
    } catch (err) {
      /* private mode or blocked storage */
    }
    return "zh";
  }

  function loadSubmissions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed;
    } catch (err) {
      return {};
    }
  }

  function persistSubmissions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
      return true;
    } catch (err) {
      return false;
    }
  }

  function fill(template, map) {
    return String(template).replace(/\{(\w+)\}/g, function (_match, key) {
      if (Object.prototype.hasOwnProperty.call(map, key)) return String(map[key]);
      return "{" + key + "}";
    });
  }

  function setLanguage(lang) {
    if (lang !== "zh" && lang !== "en") return;
    currentLang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (err) {
      /* still switch the visible language */
    }
    updateStaticText();
    renderGrid();
  }

  function updateStaticText() {
    const t = i18n[currentLang];
    const zhBtn = document.getElementById("langZhBtn");
    const enBtn = document.getElementById("langEnBtn");

    if (currentLang === "zh") {
      zhBtn.className =
        "px-3 py-1 text-xs font-bold rounded-md transition-colors bg-indigo-600 text-white";
      enBtn.className =
        "px-3 py-1 text-xs font-bold rounded-md transition-colors text-slate-600 hover:text-indigo-600";
    } else {
      zhBtn.className =
        "px-3 py-1 text-xs font-bold rounded-md transition-colors text-slate-600 hover:text-indigo-600";
      enBtn.className =
        "px-3 py-1 text-xs font-bold rounded-md transition-colors bg-indigo-600 text-white";
    }
    zhBtn.setAttribute("aria-pressed", currentLang === "zh" ? "true" : "false");
    enBtn.setAttribute("aria-pressed", currentLang === "en" ? "true" : "false");

    document.documentElement.lang = currentLang === "en" ? "en" : "zh-HK";
    document.title = t.docTitle;
    document.getElementById("appTitle").textContent = t.appTitle;
    document.getElementById("appSubtitle").textContent = t.appSubtitle;
    document.getElementById("classLabel").textContent = t.classLabel;
    document.getElementById("storageNote").textContent = t.storageNote;
    document.getElementById("backLink").textContent = t.backLink;
    document.getElementById("progressLabel").textContent = t.progressLabel;

    if (!isEditing) {
      document.getElementById("formHeading").textContent = t.formHeading;
      document.getElementById("submitBtn").textContent = t.btnSubmit;
    } else {
      document.getElementById("formHeading").textContent = fill(t.editFormHeading, {
        no: currentEditingNo,
      });
      document.getElementById("submitBtn").textContent = t.btnSaveEdit;
    }

    document.getElementById("editingBadge").textContent = t.editingBadge;
    document.getElementById("cancelEditBtn").textContent = t.cancelEditBtn;
    document.getElementById("lblSeat").textContent = t.lblSeat;
    document.getElementById("studentNo").placeholder = t.phSeat;
    document.getElementById("lblName").textContent = t.lblName;
    document.getElementById("studentName").placeholder = t.phName;
    document.getElementById("lblUrl").textContent = t.lblUrl;
    document.getElementById("gameUrl").placeholder = t.phUrl;
    document.getElementById("searchInput").placeholder = t.phSearch;
    document.getElementById("optAll").textContent = t.optAll;
    document.getElementById("optSubmitted").textContent = t.optSubmitted;
    document.getElementById("optUnsubmitted").textContent = t.optUnsubmitted;
    document.getElementById("btnExportText").textContent = t.btnExportText;
    document.getElementById("exportModalTitle").textContent = t.exportModalTitle;
    document.getElementById("exportModalDesc").textContent = t.exportModalDesc;
    document.getElementById("btnDownloadCsv").textContent = t.btnDownloadCsv;
    document.getElementById("btnCloseExport").textContent = t.btnClose;
    var here = window.location.pathname + window.location.search + window.location.hash;
    document.querySelectorAll(".submit-work-cta").forEach(function (link) {
      link.textContent = t.submitWork;
      if (window.TeacherLiAuth) link.setAttribute("href", window.TeacherLiAuth.loginUrl(here));
    });
  }

  function redirectToLogin() {
    var here = window.location.pathname + window.location.search + window.location.hash;
    if (window.TeacherLiAuth) {
      window.location.href = window.TeacherLiAuth.loginUrl(here);
      return;
    }
    window.location.href = "portal.html?next=" + encodeURIComponent(here);
  }

  function withSession(action) {
    var auth = window.TeacherLiAuth;
    if (!auth || typeof auth.getSession !== "function") {
      redirectToLogin();
      return;
    }
    auth.getSession().then(function (session) {
      if (!session) {
        redirectToLogin();
        return;
      }
      action();
    }).catch(function () {
      redirectToLogin();
    });
  }

  function setFormLocked(locked) {
    ["studentNo", "studentName", "gameUrl"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.disabled = !!locked;
    });
    var submitBtn = document.getElementById("submitBtn");
    if (submitBtn) submitBtn.disabled = false;
  }

  function renderGrid() {
    const t = i18n[currentLang];
    gridContainer.innerHTML = "";
    const searchTerm = searchInput.value.trim().toLowerCase();
    const filterValue = statusFilter.value;
    let submittedCount = 0;

    for (let i = 1; i <= TOTAL_STUDENTS; i++) {
      const data = submissions[i];
      if (data) submittedCount++;

      const isSubmitted = !!data;
      if (filterValue === "submitted" && !isSubmitted) continue;
      if (filterValue === "unsubmitted" && isSubmitted) continue;

      const name = data ? String(data.name || "") : "";
      if (searchTerm) {
        const nameMatch = name.toLowerCase().includes(searchTerm);
        const seatMatch = String(i) === searchTerm;
        if (!nameMatch && !seatMatch) continue;
      }

      const card = document.createElement("div");

      if (data) {
        const href = safeHttpUrl(data.url);
        const playControl = href
          ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"
                class="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 rounded-xl transition shadow-sm">
                ${t.playGame}
             </a>`
          : `<span class="block w-full text-center bg-slate-200 text-slate-500 font-semibold text-xs py-2 rounded-xl">${t.linkUnavailable}</span>`;

        card.className =
          "bg-white p-4 rounded-2xl shadow-sm border-2 border-indigo-500 hover:shadow-md transition flex flex-col justify-between group";
        card.innerHTML = `
          <div>
            <div class="flex justify-between items-center mb-2">
              <span class="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-md">${t.seatBadge} ${i}</span>
              <span class="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>${t.statusSubmitted}
              </span>
            </div>
            <h3 class="font-bold text-slate-800 truncate mb-1 text-base">${escapeHtml(name)}</h3>
          </div>
          <div class="mt-4 space-y-2">
            ${playControl}
            <button type="button" onclick="editSubmission(${i})"
              class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs py-1.5 rounded-xl transition">
              ${t.editData}
            </button>
          </div>
        `;
      } else {
        card.className =
          "bg-slate-100/60 p-4 rounded-2xl border border-dashed border-slate-300 flex flex-col justify-between opacity-80 cursor-pointer hover:border-indigo-400 hover:bg-slate-100 transition";
        card.onclick = function () {
          prepareAdd(i);
        };
        card.innerHTML = `
          <div>
            <div class="flex justify-between items-center mb-2">
              <span class="bg-slate-200 text-slate-600 text-xs font-bold px-2.5 py-0.5 rounded-md">${t.seatBadge} ${i}</span>
              <span class="text-[10px] text-slate-400 font-semibold">${t.statusUnsubmitted}</span>
            </div>
            <h3 class="font-bold text-slate-400 text-sm">${t.noSubmission}</h3>
          </div>
          <div class="mt-4 text-center">
            <span class="text-xs text-indigo-600 font-bold py-1.5 inline-block">${t.clickToAdd}</span>
          </div>
        `;
      }
      gridContainer.appendChild(card);
    }

    const percent = Math.round((submittedCount / TOTAL_STUDENTS) * 100);
    document.getElementById("progressText").textContent = fill(t.progressText, {
      count: submittedCount,
      total: TOTAL_STUDENTS,
      percent: percent,
    });
    const bar = document.getElementById("progressBar");
    bar.style.width = percent + "%";
    bar.setAttribute("aria-valuenow", String(submittedCount));
    bar.setAttribute("aria-valuemax", String(TOTAL_STUDENTS));
    bar.setAttribute("aria-valuetext", document.getElementById("progressText").textContent);
  }

  function prepareAdd(no) {
    withSession(function () {
      prepareAddAuthed(no);
    });
  }

  function prepareAddAuthed(no) {
    setFormLocked(false);
    cancelEdit();
    document.getElementById("studentNo").value = String(no);
    document.getElementById("studentName").focus();
    window.scrollTo({
      top: document.getElementById("formSection").offsetTop - 20,
      behavior: "smooth",
    });
  }

  function editSubmission(no) {
    withSession(function () {
      editSubmissionAuthed(no);
    });
  }

  function editSubmissionAuthed(no) {
    setFormLocked(false);
    const data = submissions[no];
    const t = i18n[currentLang];
    if (!data) return;
    isEditing = true;
    currentEditingNo = no;
    document.getElementById("studentNo").value = String(no);
    document.getElementById("studentName").value = String(data.name || "");
    document.getElementById("gameUrl").value = String(data.url || "");
    document.getElementById("formHeading").textContent = fill(t.editFormHeading, { no: no });
    document.getElementById("editingBadge").classList.remove("hidden");
    document.getElementById("submitBtn").textContent = t.btnSaveEdit;
    document.getElementById("submitBtn").className =
      "bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-2 rounded-xl shadow-sm transition shrink-0";
    document.getElementById("cancelEditBtn").classList.remove("hidden");
    window.scrollTo({
      top: document.getElementById("formSection").offsetTop - 20,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    isEditing = false;
    currentEditingNo = null;
    form.reset();
    const t = i18n[currentLang];
    document.getElementById("formHeading").textContent = t.formHeading;
    document.getElementById("editingBadge").classList.add("hidden");
    document.getElementById("submitBtn").textContent = t.btnSubmit;
    document.getElementById("submitBtn").className =
      "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2 rounded-xl shadow-sm transition shrink-0";
    document.getElementById("cancelEditBtn").classList.add("hidden");
  }

  function safeHttpUrl(url) {
    const text = String(url || "").trim();
    if (!/^https?:\/\//i.test(text)) return "";
    try {
      const parsed = new URL(text);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.href;
    } catch (err) {
      return "";
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    withSession(saveSubmission);
  });

  function saveSubmission() {
    const t = i18n[currentLang];
    const no = Number(document.getElementById("studentNo").value);
    const name = document.getElementById("studentName").value.trim();
    const url = safeHttpUrl(document.getElementById("gameUrl").value);

    if (!Number.isInteger(no) || no < 1 || no > TOTAL_STUDENTS) {
      alert(t.alertValidSeat);
      return;
    }
    if (!name) {
      alert(t.alertNameRequired);
      return;
    }
    if (!url) {
      alert(t.alertValidUrl);
      return;
    }

    const previous = submissions[no];
    submissions[no] = { name: name, url: url };
    if (!persistSubmissions()) {
      if (previous) submissions[no] = previous;
      else delete submissions[no];
      alert(t.alertSaveFail);
      return;
    }

    cancelEdit();
    renderGrid();
    alert(fill(t.alertSaveSuccess, { no: no, name: name }));
  }

  function applyFilters() {
    renderGrid();
  }

  function exportData() {
    const t = i18n[currentLang];
    let text = t.excelHeader;
    let count = 0;
    for (let i = 1; i <= TOTAL_STUDENTS; i++) {
      if (submissions[i]) {
        text +=
          i +
          "\t" +
          oneLine(submissions[i].name) +
          "\t" +
          oneLine(submissions[i].url) +
          "\n";
        count++;
      }
    }

    if (count === 0) {
      alert(t.alertNoDataExport);
      return;
    }

    copyTextToClipboard(text).then(function (success) {
      if (success) {
        alert(fill(t.alertExportSuccess, { count: count }));
      } else {
        showExportModal(text);
      }
    });
  }

  function oneLine(value) {
    return String(value || "").replace(/\r?\n/g, " ").trim();
  }

  function copyTextToClipboard(text) {
    return new Promise(function (resolve) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(
          function () {
            resolve(true);
          },
          function () {
            resolve(execCommandFallback(text));
          }
        );
      } else {
        resolve(execCommandFallback(text));
      }
    });
  }

  function execCommandFallback(text) {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "-9999px";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      return false;
    }
  }

  function showExportModal(text) {
    document.getElementById("exportTextarea").value = text;
    const modal = document.getElementById("exportModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.getElementById("exportTextarea").select();
  }

  function closeExportModal() {
    const modal = document.getElementById("exportModal");
    modal.classList.remove("flex");
    modal.classList.add("hidden");
  }

  function downloadCsvFile() {
    const t = i18n[currentLang];
    let csvContent = "\uFEFF";
    csvContent += t.csvHeader + "\n";
    for (let i = 1; i <= TOTAL_STUDENTS; i++) {
      if (submissions[i]) {
        csvContent +=
          i +
          "," +
          csvField(submissions[i].name) +
          "," +
          csvField(submissions[i].url) +
          "\n";
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const day = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", CSV_PREFIX + "_" + day + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function csvField(value) {
    const clean = oneLine(value).replace(/"/g, '""');
    return '"' + clean + '"';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.setLanguage = setLanguage;
  window.cancelEdit = cancelEdit;
  window.applyFilters = applyFilters;
  window.exportData = exportData;
  window.closeExportModal = closeExportModal;
  window.downloadCsvFile = downloadCsvFile;
  window.editSubmission = editSubmission;

  updateStaticText();
  renderGrid();
  setFormLocked(true);
  if (window.TeacherLiAuth) {
    window.TeacherLiAuth.getSession().then(function (session) {
      setFormLocked(!session);
    }).catch(function () {
      setFormLocked(true);
    });
  }
})();
