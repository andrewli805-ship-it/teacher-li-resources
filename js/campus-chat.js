/* Campus chat practice. In-memory only: no fetch, no storage, no scores. */
(function (root) {
  var DATA = root.CAMPUS_CHAT_DATA;

  var COPY = {
    introTitle: "校園傾偈練習",
    introBody: "呢度俾你同虛擬同學練習點樣喺校園識人、傾偈，同邀請人一齊做嘢。所有對答都用廣東話，好似日常同同學講嘢咁。",
    rulesTitle: "練習守則",
    rules: [
      "呢度練習嘅係認識朋友同校園傾偈，唔係拍拖，亦唔使交換電話或者社交帳戶。",
      "唔好填真電話、地址、屋企資料或者帳號。",
      "你打嘅嘢只留喺呢次練習，唔會存低，亦唔會送到其他網站。重新整理頁面就會重新開始。",
      "如果講題離咗譜或者唔合適，同學會溫柔咁帶你返去「識朋友」。"
    ],
    start: "開始練習",
    enNote: "This practice is in spoken Cantonese.",
    scenarioTitle: "先揀一個校園情境",
    scenarioLead: "揀完再揀一位同學一齊練習。",
    back: "返回",
    classmateTitle: "再揀一位同學",
    classmateLead: "而家揀咗「{title}」。每位同學興趣唔同，揀一位開始傾啦。",
    switchScenario: "轉第二個情境",
    leave: "離開",
    confirm: "你而家離開，呢次傾偈會清晒喎。確定離開？",
    confirmLeave: "確定離開",
    confirmStay: "繼續傾",
    hintBtn: "睇提示",
    hintLead: "唔知講乜可以參考呢幾句，撳一句會填入對話框，你都可以改完先傳送。",
    inputLabel: "你想講嘅話",
    placeholder: "打你想講嘅話…",
    send: "傳送",
    tooShort: "可以打多幾個字，或者撳「睇提示」睇下可以點講。",
    complete: "完成本次練習",
    endEarly: "結束呢次練習",
    systemBack: "我哋返去練習識朋友啦。",
    romance: "呢度係練習點樣同同學做朋友，我哋就傾返識朋友、一齊活動呢啲啦。你想唔想繼續頭先嗰個校園情境呀？",
    contact: "練習唔使交換電話、社交帳戶或者地址呀。我哋喺校園入面傾、約喺學校見面就得。",
    inappropriate1: "呢句唔太合適喎。我哋尊重對方，返去練習點樣友善咁識朋友啦。",
    inappropriate2: "我哋要保持禮貌同安全。如果你想繼續，就一齊用友善嘅語氣傾校園生活；你都可以先結束呢次練習。",
    goodbyeEarly: "我哋再傾多兩句都得，或者你撳上面完成本次練習都得。",
    rudeGuide: "可唔可以用温和啲嘅語氣再講一次？我哋繼續傾識朋友啦。",
    offFirst: "呢題有啲遠咗喎。我哋返返去而家呢個情境，再一齊練習識朋友啦。",
    offAgain: "如果你唔知點接，可以撳「睇提示」睇兩個例子。",
    feedbackTitle: "呢次練習嘅小建議",
    feedbackOpen: "多謝你完成「{title}」，同{short}練習咗一輪。",
    hintNote: "你今次有睇提示，係練習嘅一部分，完全得。",
    safetyNote: "中間如果講題岔咗，你都返返嚟識朋友呢邊，呢點好好。",
    again: "再練習",
    swap: "換一位同學再試",
    backApps: "返回程式區",
    labels: {
      respond: "回應對方",
      share: "分享自己",
      tone: "語氣",
      ask: "問返對方",
      invite: "發出邀請"
    },
    fb: {
      respondA: "你有回應到對方講嘅嘢，對方會覺得你有聽緊。",
      respondB: "可以試下先講返你聽到乜，例如「原來你都鍾意…」，再加自己嘅想法。",
      shareA: "你有講少少自己嘅事，咁先容易熟絡。",
      shareB: "除咗答「係呀」，可以分享一樣你鍾意或者最近做緊嘅嘢，對方會較易接住傾。",
      toneA: "你嘅語氣好友善，傾起上嚟會令對方舒服啲。",
      toneA2: "你有用「唔好意思」「多謝」呢類字眼，好貼心。",
      toneB: "之後用温和啲嘅語氣就得，例如先講「唔好意思」再講你想講嘅。",
      askA: "你有問返對方，對話就唔會變成單方面。",
      askB: "試下問一句關於對方嘅問題，例如「你平時放課後會做咩？」",
      inviteA: "你有清楚提出一齊做嘅事，對方較容易答你。",
      invitePlus: "你有講到想做咩，又提到大約幾時或者邊度，對方會更好安排。",
      inviteB: "邀請嘅時候可以講清楚想做咩、大概幾時同邊度，對方會較容易答應。"
    }
  };

  function data() {
    return root.CAMPUS_CHAT_DATA || DATA;
  }

  function normalize(raw) {
    var text = String(raw == null ? "" : raw).replace(/\u3000/g, " ");
    text = text.replace(/[\uFF01-\uFF5E]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    });
    return text.trim().toLowerCase().replace(/\s+/g, " ").trim();
  }

  function compactLen(text) {
    return text.replace(/\s/g, "").length;
  }

  function isPunctOnly(raw) {
    var trimmed = String(raw == null ? "" : raw).replace(/\u3000/g, " ").trim();
    if (!trimmed) return true;
    var norm = normalize(trimmed);
    if (!norm) return true;
    return norm.replace(/[\s\p{P}\p{S}]/gu, "").length === 0;
  }

  function escapeReg(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hasTerm(text, term) {
    var kw = String(term).toLowerCase();
    if (/^[a-z0-9]+(?: [a-z0-9]+)*$/.test(kw)) {
      return new RegExp("(?:^|[^a-z0-9])" + escapeReg(kw) + "(?:$|[^a-z0-9])").test(text);
    }
    return text.indexOf(kw) !== -1;
  }

  function matchesAny(text, terms) {
    var list = (terms || []).slice().sort(function (a, b) {
      return b.length - a.length;
    });
    for (var i = 0; i < list.length; i++) {
      if (hasTerm(text, list[i])) return true;
    }
    return false;
  }

  function endsWithNe(text) {
    var stripped = text.replace(/[\s.!?…,，。！？、~～]+$/g, "");
    return /呢$/.test(stripped);
  }

  function isRude(text, lex) {
    if (matchesAny(text, lex.rude)) return true;
    return text.replace(/麻煩/g, "").indexOf("煩") !== -1;
  }

  function classify(raw, interestKeywords) {
    var lex = data().lexicon;
    var text = normalize(raw);
    var empty = {
      intent: "too_short",
      interestHit: false,
      rude: false,
      polite: false,
      whenWhere: false
    };
    if (compactLen(text) < 2) return empty;

    var rude = isRude(text, lex);
    var polite = matchesAny(text, lex.thanks);
    var interestHit = matchesAny(text, interestKeywords || []);
    var whenWhere = matchesAny(text, lex.whenWhere);
    var intent = "off_topic";

    if (matchesAny(text, lex.inappropriate)) intent = "inappropriate";
    else if (matchesAny(text, lex.romance)) intent = "romance";
    else if (matchesAny(text, lex.contact)) intent = "contact";
    else if (matchesAny(text, lex.goodbye)) intent = "goodbye";
    else if (matchesAny(text, lex.invite) || (text.indexOf(lex.inviteLead) !== -1 && matchesAny(text, lex.inviteTails))) intent = "invite";
    else if (text.indexOf("?") !== -1 || matchesAny(text, lex.ask) || endsWithNe(text)) intent = "ask";
    else if (matchesAny(text, lex.share)) intent = "share";
    else if (matchesAny(text, lex.greet)) intent = "greet";
    else if (polite) intent = "thanks";
    else if (matchesAny(text, lex.respond)) intent = "respond";

    return {
      intent: intent,
      interestHit: interestHit,
      rude: rude,
      polite: polite,
      whenWhere: whenWhere
    };
  }

  function scenarioById(id) {
    var list = data().scenarios;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function classmateById(id) {
    var list = data().classmates;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function pickReply(scenario, classmateId, beatIndex, intent) {
    var beats = scenario.beats;
    var index = Math.max(0, Math.min(beatIndex, beats.length - 1));
    var beat = beats[index];
    var byChar = beat.repliesByChar && beat.repliesByChar[classmateId];
    if (byChar && byChar[intent]) return byChar[intent];
    if (beat.replies && beat.replies[intent]) return beat.replies[intent];
    return (beat.replies && beat.replies.fallback) || "";
  }

  function buildFeedback(session) {
    var scenario = scenarioById(session.scenarioId);
    var classmate = classmateById(session.classmateId);
    var title = scenario ? scenario.title : "";
    var shortName = classmate ? classmate.short : "";
    if (session.safetyOnly) {
      return {
        safetyOnly: true,
        title: COPY.feedbackTitle,
        opening: "",
        items: [],
        notes: [COPY.safetyNote],
        scenarioTitle: title
      };
    }

    var intents = session.intents || [];
    var productive = 0;
    var off = 0;
    var i;
    for (i = 0; i < intents.length; i++) {
      if (intents[i] === "off_topic") off += 1;
      if (intents[i] === "respond" || intents[i] === "ask" || intents[i] === "share" || intents[i] === "invite" || intents[i] === "thanks") {
        productive += 1;
      }
    }
    var respondTry = intents.length >= 4 && productive === 0 && off * 2 > intents.length;
    var shared = intents.indexOf("share") !== -1 || session.interestHit;
    var asked = intents.indexOf("ask") !== -1;
    var toneKey = "A";
    if (session.inappropriateCount > 0 || session.rudeAny) {
      toneKey = session.politeAny && session.inappropriateCount === 0 ? "A2" : "B";
    } else if (session.politeAny) {
      toneKey = "A2";
    }

    var items = [
      {
        label: COPY.labels.respond,
        ok: !respondTry,
        text: respondTry ? COPY.fb.respondB : COPY.fb.respondA
      },
      {
        label: COPY.labels.share,
        ok: !!shared,
        text: shared ? COPY.fb.shareA : COPY.fb.shareB
      },
      {
        label: COPY.labels.tone,
        ok: toneKey !== "B",
        text: toneKey === "B" ? COPY.fb.toneB : toneKey === "A2" ? COPY.fb.toneA2 : COPY.fb.toneA
      },
      {
        label: COPY.labels.ask,
        ok: asked,
        text: asked ? COPY.fb.askA : COPY.fb.askB
      }
    ];

    var showInvite = (scenario && scenario.id === "invite") || session.invited;
    if (showInvite) {
      var inviteText = COPY.fb.inviteB;
      var inviteOk = false;
      if (session.invited && session.inviteWithWhen) {
        inviteText = COPY.fb.invitePlus;
        inviteOk = true;
      } else if (session.invited) {
        inviteText = COPY.fb.inviteA;
        inviteOk = true;
      }
      items.push({ label: COPY.labels.invite, ok: inviteOk, text: inviteText });
    }

    var notes = [];
    if (session.usedHint) notes.push(COPY.hintNote);
    if (session.safetyAny) notes.push(COPY.safetyNote);

    return {
      safetyOnly: false,
      title: COPY.feedbackTitle,
      opening: COPY.feedbackOpen.replace("{title}", title).replace("{short}", shortName),
      items: items,
      notes: notes,
      scenarioTitle: title
    };
  }

  root.CampusChat = {
    classify: classify,
    normalize: normalize,
    buildFeedback: buildFeedback,
    pickReply: pickReply,
    isPunctOnly: isPunctOnly
  };

  if (typeof document === "undefined") return;

  var state = blankState();

  function blankState() {
    return {
      screen: "intro",
      scenarioId: null,
      classmateId: null,
      beat: 0,
      intents: [],
      interestHit: false,
      interestReplyUsed: false,
      rudeAny: false,
      inappropriateCount: 0,
      politeAny: false,
      invited: false,
      inviteWithWhen: false,
      safetyAny: false,
      usedHint: false,
      hintsOpen: false,
      offStreak: 0,
      safetyOnlyFeedback: false,
      shortTries: 0,
      messages: [],
      wrapSaid: false,
      busy: false
    };
  }

  function clearConversation() {
    var screen = state.screen;
    var scenarioId = state.scenarioId;
    var classmateId = state.classmateId;
    state = blankState();
    state.screen = screen;
    state.scenarioId = scenarioId;
    state.classmateId = classmateId;
  }

  function isEn() {
    return !!(root.TeacherLiI18n && root.TeacherLiI18n.getLang() === "en");
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value == null || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "hidden") node.hidden = true;
        else node.setAttribute(key, value === true ? "" : value);
      });
    }
    function appendOne(child) {
      if (child == null || child === false) return;
      if (Array.isArray(child)) {
        child.forEach(appendOne);
        return;
      }
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    children.forEach(appendOne);
    return node;
  }

  function render() {
    var mount = document.getElementById("cc-root");
    if (!mount) return;
    mount.textContent = "";
    if (state.screen === "intro") renderIntro(mount);
    else if (state.screen === "scenario") renderScenario(mount);
    else if (state.screen === "classmate") renderClassmate(mount);
    else if (state.screen === "chat") renderChat(mount);
    else if (state.screen === "feedback") renderFeedback(mount);
  }

  function renderIntro(mount) {
    var note = el("p", { class: "cc-en-note", id: "cc-en-note", lang: "en", text: COPY.enNote });
    note.hidden = !isEn();
    var rules = el("div", { class: "cc-rules" }, el("h3", { text: COPY.rulesTitle }));
    var list = el("ul");
    COPY.rules.forEach(function (line) {
      list.appendChild(el("li", { text: line }));
    });
    rules.appendChild(list);
    var start = el("button", { type: "button", class: "btn-enter", text: COPY.start });
    start.addEventListener("click", function () {
      state.screen = "scenario";
      render();
    });
    mount.appendChild(el("div", { class: "cc-read" },
      el("h2", { text: COPY.introTitle }),
      el("p", { class: "cc-lead", text: COPY.introBody }),
      note,
      rules,
      el("div", { class: "cc-actions" }, start)
    ));
  }

  function moveFocus(buttons, key) {
    var index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    var next = key === "ArrowLeft" || key === "ArrowUp" ? index - 1 : index + 1;
    if (next < 0) next = buttons.length - 1;
    if (next >= buttons.length) next = 0;
    buttons[next].focus();
  }

  function bindArrows(grid) {
    grid.addEventListener("keydown", function (event) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(event.key) === -1) return;
      var buttons = Array.prototype.slice.call(grid.querySelectorAll("button"));
      if (buttons.indexOf(document.activeElement) === -1) return;
      event.preventDefault();
      moveFocus(buttons, event.key);
    });
  }

  function renderScenario(mount) {
    var grid = el("div", { class: "cc-scenario-grid", role: "group", "aria-label": COPY.scenarioTitle });
    data().scenarios.forEach(function (scenario) {
      var pressed = state.scenarioId === scenario.id;
      var card = el("button", {
        type: "button",
        class: "cc-pick-card",
        "aria-pressed": pressed ? "true" : "false"
      }, el("span", { class: "cc-card-title", text: scenario.title }), el("span", { class: "cc-card-blurb", text: scenario.blurb }));
      card.addEventListener("click", function () {
        state.scenarioId = scenario.id;
        state.classmateId = null;
        state.screen = "classmate";
        render();
      });
      grid.appendChild(card);
    });
    bindArrows(grid);
    var back = el("button", { type: "button", class: "cc-btn", text: COPY.back });
    back.addEventListener("click", function () {
      state.screen = "intro";
      render();
    });
    mount.appendChild(el("div", {},
      el("h2", { text: COPY.scenarioTitle }),
      el("p", { class: "cc-lead", text: COPY.scenarioLead }),
      grid,
      el("div", { class: "cc-actions" }, back)
    ));
  }

  function renderClassmate(mount) {
    var scenario = scenarioById(state.scenarioId);
    var grid = el("div", { class: "cc-classmate-grid", role: "group", "aria-label": COPY.classmateTitle });
    data().classmates.forEach(function (person) {
      var card = el("button", {
        type: "button",
        class: "cc-person-card",
        "aria-pressed": state.classmateId === person.id ? "true" : "false"
      }, avatar(person, false), el("span", { class: "cc-person-body" },
        el("span", { class: "cc-person-name", text: person.name }),
        el("span", { class: "cc-person-interest", text: person.interest }),
        el("span", { class: "cc-person-intro", text: person.intro })
      ));
      card.addEventListener("click", function () {
        startChat(person.id);
      });
      grid.appendChild(card);
    });
    bindArrows(grid);
    var back = el("button", { type: "button", class: "cc-btn", text: COPY.switchScenario });
    back.addEventListener("click", function () {
      state.classmateId = null;
      state.screen = "scenario";
      render();
    });
    mount.appendChild(el("div", {},
      el("h2", { text: COPY.classmateTitle }),
      el("p", { class: "cc-lead", text: COPY.classmateLead.replace("{title}", scenario ? scenario.title : "") }),
      el("div", { class: "cc-actions cc-actions-tight" }, back),
      grid
    ));
  }

  function avatar(person, small) {
    return el("span", {
      class: "cc-avatar cc-avatar-" + person.id + (small ? " cc-avatar-sm" : ""),
      "aria-hidden": "true",
      text: person.initial
    });
  }

  function startChat(classmateId) {
    var scenario = scenarioById(state.scenarioId);
    clearConversation();
    state.screen = "chat";
    state.classmateId = classmateId;
    state.scenarioId = scenario.id;
    state.messages.push({ role: "mate", text: scenario.openings[classmateId] });
    render();
    announce(scenario.openings[classmateId]);
  }

  function renderChat(mount) {
    var scenario = scenarioById(state.scenarioId);
    var person = classmateById(state.classmateId);
    var leave = el("button", { type: "button", class: "cc-btn cc-leave", id: "cc-leave", text: COPY.leave });
    var title = el("div", { class: "cc-top-title", text: person.short + " · " + scenario.title });
    var top = el("div", { class: "cc-top" }, el("div", { class: "cc-top-who" }, avatar(person, true), title), leave);

    var thread = el("div", { class: "cc-thread", id: "cc-thread" });
    state.messages.forEach(function (msg) {
      thread.appendChild(messageNode(msg, person));
    });

    var live = el("div", { class: "sr-only", id: "cc-live", "aria-live": "polite" });
    var hintBtn = el("button", {
      type: "button",
      class: "cc-btn",
      id: "cc-hint-btn",
      "aria-expanded": state.hintsOpen ? "true" : "false",
      "aria-controls": "cc-hint-panel",
      text: COPY.hintBtn
    });
    var chips = el("div", { class: "cc-hint-chips", id: "cc-hint-chips" });
    var panel = el("div", { class: "cc-hint-panel", id: "cc-hint-panel" },
      el("p", { text: COPY.hintLead }),
      chips
    );
    panel.hidden = !state.hintsOpen;
    hintBtn.addEventListener("click", function () {
      state.hintsOpen = !state.hintsOpen;
      panel.hidden = !state.hintsOpen;
      hintBtn.setAttribute("aria-expanded", state.hintsOpen ? "true" : "false");
      if (state.hintsOpen) fillHints(chips);
    });

    var label = el("label", { class: "sr-only", for: "cc-input", text: COPY.inputLabel });
    var input = el("textarea", {
      id: "cc-input",
      rows: "2",
      maxlength: "160",
      placeholder: COPY.placeholder,
      autocomplete: "off",
      autocorrect: "off",
      autocapitalize: "off",
      spellcheck: "false"
    });
    var send = el("button", { type: "button", class: "btn-enter cc-send", id: "cc-send", text: COPY.send });
    send.disabled = true;
    var shortHint = el("p", { class: "cc-short-hint", id: "cc-short-hint", "aria-live": "polite", text: COPY.tooShort, hidden: true });
    var complete = el("button", {
      type: "button",
      id: "cc-complete",
      class: state.intents.length >= 6 ? "btn-enter" : "cc-btn",
      text: COPY.complete,
      hidden: state.intents.length < 4
    });
    var endEarly = el("button", {
      type: "button",
      class: "cc-btn",
      id: "cc-end-early",
      text: COPY.endEarly,
      hidden: state.inappropriateCount < 2
    });
    complete.addEventListener("click", function () {
      if (state.intents.length >= 4) goFeedback(false);
    });
    endEarly.addEventListener("click", function () {
      if (state.intents.length < 4) {
        state = blankState();
        render();
      } else {
        goFeedback(true);
      }
    });
    send.addEventListener("click", trySend);
    input.addEventListener("input", function () {
      growInput(input);
      syncSendButton();
      if (compactLen(normalize(input.value)) >= 2 && !isPunctOnly(input.value)) showShort(false);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      var touch = window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(hover: none)").matches;
      if (touch) return;
      event.preventDefault();
      trySend();
    });

    var confirm = buildConfirm(leave);
    var chat = el("div", { class: "cc-chat" },
      top,
      thread,
      live,
      el("div", { class: "cc-hints" }, hintBtn, panel),
      el("div", { class: "cc-composer" },
        el("div", { class: "cc-finish-row" }, complete, endEarly),
        label,
        el("div", { class: "cc-input-row" }, input, send),
        shortHint
      ),
      confirm
    );
    mount.appendChild(chat);
    fillHints(chips);
    window.requestAnimationFrame(function () {
      thread.scrollTop = thread.scrollHeight;
    });
  }

  function fillHints(box) {
    var scenario = scenarioById(state.scenarioId);
    if (!scenario) return;
    var index = Math.max(0, Math.min(state.beat, scenario.beats.length - 1));
    var hints = scenario.beats[index].hints || [];
    box.textContent = "";
    hints.forEach(function (hint) {
      var chip = el("button", { type: "button", class: "cc-chip", text: hint });
      chip.addEventListener("click", function () {
        var input = document.getElementById("cc-input");
        if (!input) return;
        input.value = hint.slice(0, 160);
        state.usedHint = true;
        growInput(input);
        syncSendButton();
        input.focus();
      });
      box.appendChild(chip);
    });
  }

  function messageNode(msg, person) {
    if (msg.role === "system") return el("div", { class: "cc-system", text: msg.text });
    var mine = msg.role === "me";
    var wrap = el("div", { class: mine ? "cc-msg cc-msg-me" : "cc-msg cc-msg-mate" });
    if (!mine) wrap.appendChild(el("div", { class: "cc-msg-name", text: person.short }));
    wrap.appendChild(el("div", { class: "cc-bubble", text: msg.text }));
    return wrap;
  }

  function buildConfirm(leaveBtn) {
    var stay = el("button", { type: "button", class: "btn-enter", id: "cc-stay", text: COPY.confirmStay });
    var go = el("button", { type: "button", class: "cc-btn", id: "cc-do-leave", text: COPY.confirmLeave });
    var card = el("div", { class: "cc-confirm-card", tabindex: "-1" },
      el("p", { id: "cc-confirm-text", text: COPY.confirm }),
      el("div", { class: "cc-actions" }, go, stay)
    );
    var dialog = el("div", {
      class: "cc-confirm",
      id: "cc-confirm",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "cc-confirm-text",
      hidden: true
    }, card);
    function close(leave) {
      dialog.hidden = true;
      document.removeEventListener("keydown", onKey);
      if (leave) {
        state = blankState();
        render();
        return;
      }
      leaveBtn.focus();
    }
    function onKey(event) {
      if (dialog.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
        return;
      }
      if (event.key !== "Tab") return;
      var buttons = [go, stay];
      var first = buttons[0];
      var last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    go.addEventListener("click", function () { close(true); });
    stay.addEventListener("click", function () { close(false); });
    dialog.addEventListener("keydown", onKey);
    leaveBtn.addEventListener("click", function () {
      dialog.hidden = false;
      card.focus();
    });
    return dialog;
  }

  function growInput(input) {
    input.style.height = "auto";
    var max = 8.2 * 16;
    input.style.height = Math.min(input.scrollHeight, max) + "px";
  }

  function syncSendButton() {
    var input = document.getElementById("cc-input");
    var send = document.getElementById("cc-send");
    if (!input || !send) return;
    send.disabled = state.busy || isPunctOnly(input.value);
  }

  function showShort(on) {
    var hint = document.getElementById("cc-short-hint");
    if (hint) hint.hidden = !on;
  }

  function trySend() {
    if (state.busy || state.screen !== "chat") return;
    var input = document.getElementById("cc-input");
    var send = document.getElementById("cc-send");
    if (!input || !send) return;
    var shown = input.value.replace(/\u3000/g, " ").trim().slice(0, 160);
    var norm = normalize(shown);
    if (send.disabled || isPunctOnly(shown) || compactLen(norm) < 2) {
      state.shortTries += 1;
      if (state.shortTries >= 2) showShort(true);
      return;
    }
    state.shortTries = 0;
    showShort(false);
    state.busy = true;
    input.disabled = true;
    send.disabled = true;
    input.value = "";
    growInput(input);
    handleUtterance(shown, norm);
    state.busy = false;
    if (state.screen !== "chat") return;
    var next = document.getElementById("cc-input");
    if (!next) return;
    next.disabled = false;
    syncSendButton();
    syncChrome();
    if (!window.matchMedia("(pointer: coarse)").matches) next.focus();
  }

  function handleUtterance(shown, norm) {
    var scenario = scenarioById(state.scenarioId);
    var person = classmateById(state.classmateId);
    var result = classify(norm, person.keywords);
    pushMessage("me", shown);

    if (result.intent === "inappropriate" || result.intent === "romance" || result.intent === "contact") {
      state.safetyAny = true;
      if (result.intent === "inappropriate") state.inappropriateCount += 1;
      pushMessage("system", COPY.systemBack);
      if (result.intent === "inappropriate" && state.inappropriateCount >= 2) pushMessage("mate", COPY.inappropriate2);
      else if (result.intent === "inappropriate") pushMessage("mate", COPY.inappropriate1);
      else if (result.intent === "romance") pushMessage("mate", COPY.romance);
      else pushMessage("mate", COPY.contact);
      syncChrome();
      return;
    }

    if (result.interestHit) state.interestHit = true;
    if (result.rude) state.rudeAny = true;
    if (result.polite) state.politeAny = true;
    if (result.intent === "invite") {
      state.invited = true;
      if (result.whenWhere) state.inviteWithWhen = true;
    }
    state.intents.push(result.intent);

    if (result.intent === "goodbye") {
      if (state.intents.length < 4) {
        pushMessage("mate", COPY.goodbyeEarly);
        return;
      }
      pushMessage("mate", scenario.wrap);
      state.wrapSaid = true;
      goFeedback(false);
      return;
    }

    var useRude = result.rude && (result.intent === "respond" || result.intent === "off_topic");
    var useInterest = result.interestHit && !state.interestReplyUsed && !useRude;
    if (useRude) {
      pushMessage("mate", COPY.rudeGuide);
      if (result.intent === "off_topic") state.offStreak += 1;
      else state.offStreak = 0;
    } else if (useInterest) {
      state.interestReplyUsed = true;
      state.offStreak = 0;
      pushMessage("mate", person.interestReply);
    } else if (result.intent === "off_topic") {
      state.offStreak += 1;
      pushMessage("mate", state.offStreak >= 2 ? COPY.offAgain : COPY.offFirst);
      var fallback = pickReply(scenario, state.classmateId, state.beat, "fallback");
      if (fallback) pushMessage("mate", fallback);
    } else {
      state.offStreak = 0;
      pushMessage("mate", pickReply(scenario, state.classmateId, state.beat, result.intent));
    }

    state.beat = Math.min(state.beat + 1, scenario.beats.length - 1);
    var chipBox = document.getElementById("cc-hint-chips");
    if (chipBox) fillHints(chipBox);
    if (state.intents.length === 6 && !state.wrapSaid) {
      pushMessage("mate", scenario.wrap);
      state.wrapSaid = true;
    }
    syncChrome();
    if (state.intents.length >= 8) goFeedback(false);
  }

  function pushMessage(role, text) {
    if (!text) return;
    var msg = { role: role, text: text };
    state.messages.push(msg);
    var thread = document.getElementById("cc-thread");
    var person = classmateById(state.classmateId);
    if (thread && person) {
      thread.appendChild(messageNode(msg, person));
      thread.scrollTop = thread.scrollHeight;
    }
    if (role === "mate") announce(text);
  }

  var announceTimer = 0;
  var announceBuf = "";
  function announce(text) {
    announceBuf = announceBuf ? announceBuf + " " + text : text;
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(function () {
      var live = document.getElementById("cc-live");
      var said = announceBuf;
      announceBuf = "";
      if (!live) return;
      live.textContent = "";
      window.setTimeout(function () {
        if (live) live.textContent = said;
      }, 20);
    }, 30);
  }

  function syncChrome() {
    var complete = document.getElementById("cc-complete");
    var endEarly = document.getElementById("cc-end-early");
    if (complete) {
      complete.hidden = state.intents.length < 4;
      complete.className = state.intents.length >= 6 ? "btn-enter" : "cc-btn";
    }
    if (endEarly) endEarly.hidden = state.inappropriateCount < 2;
  }

  function goFeedback(safetyOnly) {
    state.safetyOnlyFeedback = !!safetyOnly;
    state.screen = "feedback";
    render();
  }

  function sessionSnapshot() {
    return {
      scenarioId: state.scenarioId,
      classmateId: state.classmateId,
      intents: state.intents.slice(),
      interestHit: state.interestHit,
      rudeAny: state.rudeAny,
      inappropriateCount: state.inappropriateCount,
      politeAny: state.politeAny,
      invited: state.invited,
      inviteWithWhen: state.inviteWithWhen,
      usedHint: state.usedHint,
      safetyAny: state.safetyAny,
      safetyOnly: state.safetyOnlyFeedback
    };
  }

  function renderFeedback(mount) {
    var view = buildFeedback(sessionSnapshot());
    var blocks = [el("h2", { text: view.title })];
    if (view.opening) blocks.push(el("p", { class: "cc-lead", text: view.opening }));
    view.items.forEach(function (item) {
      blocks.push(el("div", { class: "cc-fb-item" },
        el("span", { class: item.ok ? "cc-dot cc-dot-yes" : "cc-dot cc-dot-try", "aria-hidden": "true" }),
        el("div", {},
          el("div", { class: "cc-fb-label", text: item.label }),
          el("p", { class: "cc-fb-text", text: item.text })
        )
      ));
    });
    view.notes.forEach(function (note) {
      var noteClass = note === COPY.hintNote ? "cc-hint-note" : "cc-safety-note";
      blocks.push(el("p", { class: noteClass, text: note }));
    });
    var again = el("button", { type: "button", class: "btn-enter", text: COPY.again });
    var swap = el("button", { type: "button", class: "cc-btn", text: COPY.swap });
    var back = el("a", { class: "cc-btn", href: "index.html", text: COPY.backApps });
    again.addEventListener("click", function () {
      state = blankState();
      state.screen = "scenario";
      render();
    });
    swap.addEventListener("click", function () {
      var keep = state.scenarioId;
      state = blankState();
      state.scenarioId = keep;
      state.screen = "classmate";
      render();
    });
    blocks.push(el("div", { class: "cc-actions" }, again, swap, back));
    mount.appendChild(el("div", { class: "cc-read" }, blocks));
  }

  function boot() {
    render();
    document.addEventListener("langchange", function () {
      var note = document.getElementById("cc-en-note");
      if (note) note.hidden = !isEn();
      else if (state.screen === "intro") render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
