/**
 * Simple bilingual UI (zh / en) with localStorage persistence.
 * Elements with [data-i18n="key"] get textContent from STRINGS[lang][key].
 * Optional [data-i18n-html="key"] sets innerHTML (use sparingly).
 */
(function () {
  const STORAGE_KEY = "teacher-li-lang";

  const STRINGS = {
    zh: {
      "brand.cn": "李順華老師資源分享網頁",
      "brand.en": "Teacher Li Shun Wah Resources",
      "nav.home": "首頁 Home",
      "nav.homework": "交功課 Homework",
      "nav.resources": "資源分享 Resources",
      "nav.apps": "有用程式 Apps",
      "lang.zh": "中文",
      "lang.en": "EN",
      "hero.title": "李順華老師資源分享",
      "hero.sub": "Teacher Li's Resource Hub",
      "hero.tags": "ICT • DT • Science",
      "sec.homework.cn": "交功課區",
      "sec.homework.en": "Homework",
      "sec.resources.cn": "科資源分享區",
      "sec.resources.en": "Resources",
      "sec.apps.cn": "有用程式分享區",
      "sec.apps.en": "Apps",
      "card.ict.title": "ICT",
      "card.ict.hw.sub": "資訊與通訊科技／交功課",
      "card.dt.title": "DT",
      "card.dt.hw.sub": "設計與科技／交功課",
      "card.science.title": "Science",
      "card.science.hw.sub": "科學／交功課",
      "card.ict.res.sub": "資訊與通訊科技／學習資源",
      "card.dt.res.sub": "設計與科技／學習資源",
      "card.science.res.sub": "科學／學習資源",
      "card.tinkercad.title": "Tinkercad",
      "card.tinkercad.sub": "3D 設計與電路模擬",
      "card.python.title": "Python",
      "card.python.sub": "程式設計學習",
      "card.geogebra.title": "GeoGebra",
      "card.geogebra.sub": "數學與動態幾何",
      "btn.enter": "進入 Enter",
      "footer": "李順華老師資源分享網頁 · 僅供校內預覽 · 連結待補",
      "pending": "待補",
      "placeholder.hw": "待 Andrew 補交功課連結／說明",
      "placeholder.res": "待 Andrew 補科資源連結／說明",
      "placeholder.apps": "待 Andrew 確認外部連結與使用說明",
      "crumb.home": "首頁",
      "hub.homework.title": "交功課區",
      "hub.homework.lead": "選擇科目進入交功課頁面。ICT 已開放 2627 2D／2H AI 小遊戲作品展覽；其餘科目連結待補。",
      "hub.resources.title": "科資源分享區",
      "hub.resources.lead": "選擇科目瀏覽學習資源。正式資源連結待補。",
      "hub.apps.title": "有用程式分享區",
      "hub.apps.lead": "常用教學與學習程式介紹。",
      "page.hw.ict": "ICT 交功課",
      "page.hw.ict.banner": "功課繳交 · HW Submission",
      "page.hw.ict.lead": "2627 ICT／DT：請按班別進入 AI 小遊戲作品展覽館，填寫座號、姓名及遊戲網頁連結。",
      "page.hw.ict.classes": "班別作品展覽",
      "page.hw.ict.2d.title": "2627 2D",
      "page.hw.ict.2d.note": "AI 小遊戲作品展覽館。座號 1–40，可修改資料、篩選繳交狀況，並匯出清單。",
      "page.hw.ict.2h.title": "2627 2H",
      "page.hw.ict.2h.note": "AI 小遊戲作品展覽館。座號 1–40，可修改資料、篩選繳交狀況，並匯出清單。",
      "page.hw.ict.open": "進入展覽館",
      "page.hw.ict.links": "實用連結",
      "page.hw.ict.school": "大埔三育中學（Tai Po Sam Yuk Secondary School）",
      "page.hw.ict.storage": "作品名單只儲存在這部瀏覽器。換電腦、換瀏覽器或清除網站資料後便看不到，請在同一瀏覽器查看及匯出。2D 與 2H 分開儲存，不會互相覆蓋。",
      "page.hw.dt": "DT 交功課",
      "page.hw.science": "Science 交功課",
      "page.res.ict": "ICT 科資源",
      "page.res.dt": "DT 科資源",
      "page.res.science": "Science 科資源",
      "page.app.tinkercad": "Tinkercad",
      "page.app.python": "Python",
      "page.app.geogebra": "GeoGebra",
      "page.lead.hw": "本頁為交功課骨架。請稍後補上班級／作業系統或 Google Classroom／Sites 等正式連結。",
      "page.lead.res": "本頁為科資源骨架。請稍後補上筆記、教材或自學連結。",
      "page.lead.app": "以下為建議外部連結，正式採用前請確認。",
      "ext.official": "官方網站",
      "ext.suggest": "建議連結（待確認）",
      "back.hub": "返回本區目錄",
    },
    en: {
      "brand.cn": "李順華老師資源分享網頁",
      "brand.en": "Teacher Li Shun Wah Resources",
      "nav.home": "Home",
      "nav.homework": "Homework",
      "nav.resources": "Resources",
      "nav.apps": "Apps",
      "lang.zh": "中文",
      "lang.en": "EN",
      "hero.title": "Teacher Li's Resource Hub",
      "hero.sub": "李順華老師資源分享",
      "hero.tags": "ICT • DT • Science",
      "sec.homework.cn": "Homework",
      "sec.homework.en": "交功課區",
      "sec.resources.cn": "Resources",
      "sec.resources.en": "科資源分享區",
      "sec.apps.cn": "Apps",
      "sec.apps.en": "有用程式分享區",
      "card.ict.title": "ICT",
      "card.ict.hw.sub": "Information & Communication Technology — submit work",
      "card.dt.title": "DT",
      "card.dt.hw.sub": "Design & Technology — submit work",
      "card.science.title": "Science",
      "card.science.hw.sub": "Science — submit work",
      "card.ict.res.sub": "ICT learning resources",
      "card.dt.res.sub": "DT learning resources",
      "card.science.res.sub": "Science learning resources",
      "card.tinkercad.title": "Tinkercad",
      "card.tinkercad.sub": "3D design & circuit simulation",
      "card.python.title": "Python",
      "card.python.sub": "Learn to code with Python",
      "card.geogebra.title": "GeoGebra",
      "card.geogebra.sub": "Math & dynamic geometry",
      "btn.enter": "Enter",
      "footer": "Teacher Li Shun Wah Resources · Preview only · Links TBD",
      "pending": "TBD",
      "placeholder.hw": "Waiting for Andrew to add homework links / notes",
      "placeholder.res": "Waiting for Andrew to add resource links / notes",
      "placeholder.apps": "Waiting for Andrew to confirm external links & notes",
      "crumb.home": "Home",
      "hub.homework.title": "Homework Submission",
      "hub.homework.lead": "Choose a subject. ICT is open for the 2627 2D / 2H AI mini-game showcase; other subjects are still to be added.",
      "hub.resources.title": "Subject Resources",
      "hub.resources.lead": "Choose a subject. Official resource links are still TBD.",
      "hub.apps.title": "Useful Programs",
      "hub.apps.lead": "Introductions to tools used in class.",
      "page.hw.ict": "ICT Homework",
      "page.hw.ict.banner": "HW Submission · 功課繳交",
      "page.hw.ict.lead": "2627 ICT / DT: open your class AI mini-game showcase and enter your seat number, name, and game URL.",
      "page.hw.ict.classes": "Class showcases",
      "page.hw.ict.2d.title": "2627 2D",
      "page.hw.ict.2d.note": "AI mini-game showcase. Seats 1–40. Edit a card, filter by status, and export a list.",
      "page.hw.ict.2h.title": "2627 2H",
      "page.hw.ict.2h.note": "AI mini-game showcase. Seats 1–40. Edit a card, filter by status, and export a list.",
      "page.hw.ict.open": "Open showcase",
      "page.hw.ict.links": "Useful links",
      "page.hw.ict.school": "Tai Po Sam Yuk Secondary School (大埔三育中學)",
      "page.hw.ict.storage": "Submissions stay in this browser only. They are not visible on another device or browser, and they disappear if site data is cleared. Export the list from the same browser. 2D and 2H are stored separately.",
      "page.hw.dt": "DT Homework",
      "page.hw.science": "Science Homework",
      "page.res.ict": "ICT Resources",
      "page.res.dt": "DT Resources",
      "page.res.science": "Science Resources",
      "page.app.tinkercad": "Tinkercad",
      "page.app.python": "Python",
      "page.app.geogebra": "GeoGebra",
      "page.lead.hw": "Skeleton page for homework. Add class portals, Google Classroom, or Sites links later.",
      "page.lead.res": "Skeleton page for subject resources. Add notes, worksheets, or self-study links later.",
      "page.lead.app": "Suggested external links — confirm before treating as final.",
      "ext.official": "Official site",
      "ext.suggest": "Suggested (to confirm)",
      "back.hub": "Back to section hub",
    },
  };

  function getLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
    return "zh";
  }

  function setLang(lang) {
    if (lang !== "zh" && lang !== "en") return;
    localStorage.setItem(STORAGE_KEY, lang);
    applyLang(lang);
  }

  function t(key, lang) {
    const L = lang || getLang();
    return (STRINGS[L] && STRINGS[L][key]) || (STRINGS.zh[key] || key);
  }

  function applyLang(lang) {
    document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key, lang);
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      const key = el.getAttribute("data-i18n-html");
      if (key) el.innerHTML = t(key, lang);
    });
    document.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      const btnLang = btn.getAttribute("data-lang");
      btn.setAttribute("aria-pressed", btnLang === lang ? "true" : "false");
    });
    document.dispatchEvent(
      new CustomEvent("langchange", { detail: { lang: lang } })
    );
  }

  function initToggle() {
    document.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLang(btn.getAttribute("data-lang"));
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initToggle();
    applyLang(getLang());
  });

  window.TeacherLiI18n = { getLang: getLang, setLang: setLang, t: t, applyLang: applyLang };
})();
