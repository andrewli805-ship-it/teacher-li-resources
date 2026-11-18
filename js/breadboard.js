/**
 * Breadboard wiring planner. Original classroom tool for this site.
 * Plans connections only: it does not simulate power, current, or logic.
 */
(function () {
  var D = window.BreadboardData;
  if (!D) return;

  var FONT = "Segoe UI, PingFang TC, Microsoft JhengHei, Noto Sans TC, Arial, sans-serif";
  var P = 20;
  var BOARD = { x: 16, y: 24, w: 312, h: 700 };
  var BBX = 360;
  var BBY = 150;
  var MODX = 1048;
  var MODY = 150;
  var MODW = 220;
  var MODH = 128;
  var MODG = 12;
  var SCENE_W = 1300;
  var SCENE_H = 780;
  var PIN_STEP = 36;
  var K_INTRO = "teacher-li-bb-intro-dismissed";
  var K_PROJECTS = "teacher-li-bb-projects";
  var K_DRAFT = "teacher-li-bb-draft";

  var WIRE_HEX = {
    red: "#C4392B",
    black: "#0D1B2A",
    orange: "#C67A12",
    yellow: "#E8A838",
    teal: "#0D9488",
    white: "#FFFFFF",
    gray: "#64748B"
  };
  var LED_HEX = {
    red: "#C4392B",
    yellow: "#E8A838",
    green: "#1F8A4C",
    blue: "#2563EB",
    white: "#FFFFFF"
  };
  var BAND = {
    black: "#0D1B2A",
    brown: "#8A5A2B",
    red: "#C4392B",
    orange: "#C67A12",
    yellow: "#E8A838",
    green: "#1F8A4C",
    blue: "#2563EB",
    gold: "#D4A017"
  };
  var RES_BANDS = {
    "220": ["red", "red", "brown", "gold"],
    "330": ["orange", "orange", "brown", "gold"],
    "1000": ["brown", "black", "red", "gold"],
    "10000": ["brown", "black", "orange", "gold"]
  };

  var state = {
    project: null,
    analysis: null,
    mode: "select",
    placeType: null,
    legal: {},
    wireStart: null,
    selected: null,
    sheetOpen: false,
    menuOpen: false,
    modalOpen: false,
    undo: [],
    redo: [],
    savedCanonical: "",
    forceDirty: false,
    holdDraft: false,
    pendingDraft: null,
    switchNote: "",
    note: "",
    noteTimer: null,
    draftTimer: null,
    quotaTold: false,
    allowLeave: false,
    nameSnap: null,
    pointers: {},
    gesture: null
  };

  function t(key, vars) {
    var s = window.TeacherLiI18n ? TeacherLiI18n.t(key) : key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  function lang() {
    return window.TeacherLiI18n ? TeacherLiI18n.getLang() : "zh";
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      if (k === "class") node.className = a[k];
      else if (k === "text") node.textContent = a[k];
      else node.setAttribute(k, a[k]);
    });
    return node;
  }

  function s(tag, attrs, parent) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      if (k === "text") node.textContent = a[k];
      else node.setAttribute(k, a[k]);
    });
    if (parent) parent.appendChild(node);
    return node;
  }

  function svgText(parent, x, y, str, opts) {
    var o = opts || {};
    return s("text", {
      x: x,
      y: y,
      fill: o.fill || "#0D1B2A",
      "font-size": o.size || 11,
      "font-family": FONT,
      "text-anchor": o.anchor || "middle",
      "dominant-baseline": o.base || "middle",
      "font-weight": o.weight || 700,
      text: str
    }, parent);
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function canonical(p) {
    return JSON.stringify({
      name: p.name || "",
      board: p.board,
      components: (p.components || []).map(function (c) {
        return { id: c.id, type: c.type, anchor: c.anchor, rotation: c.rotation || 0, props: c.props || {}, name: c.name || "" };
      }),
      modules: (p.modules || []).map(function (m) {
        return { id: m.id, type: m.type, slot: m.slot, props: m.props || {}, name: m.name || "" };
      }),
      wires: (p.wires || []).map(function (w) {
        return { id: w.id, from: { kind: w.from.kind, ref: w.from.ref }, to: { kind: w.to.kind, ref: w.to.ref }, color: w.color };
      })
    });
  }

  function normalizeName(name) {
    var trimmed = String(name || "").trim();
    var zh = TeacherLiI18n.t("bb.project.untitled", "zh");
    var en = TeacherLiI18n.t("bb.project.untitled", "en");
    if (!trimmed || trimmed === zh || trimmed === en) return "";
    return trimmed.slice(0, 60);
  }

  function displayProjectName() {
    return state.project && state.project.name ? state.project.name : t("bb.project.untitled");
  }

  function blankProject() {
    return {
      version: 1,
      id: "",
      name: "",
      board: "uno",
      updatedAt: "",
      components: [],
      modules: [],
      wires: [],
      view: { zoom: 1, panX: 16, panY: 12 }
    };
  }

  function isDirty() {
    if (!state.project) return false;
    if (state.forceDirty) return true;
    return canonical(state.project) !== state.savedCanonical;
  }

  function itemLabel(item, list) {
    if (item.name) return item.name;
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].type !== item.type) continue;
      n += 1;
      if (list[i].id === item.id) break;
    }
    return t("bb.parts." + item.type) + " " + n;
  }

  function currentSelection() {
    if (!state.selected || !state.project) return null;
    if (state.selected.kind === "component") {
      var c = findById(state.project.components, state.selected.id);
      return c ? { kind: "component", item: c } : null;
    }
    if (state.selected.kind === "module") {
      var m = findById(state.project.modules, state.selected.id);
      return m ? { kind: "module", item: m } : null;
    }
    if (state.selected.kind === "wire") {
      var w = findById(state.project.wires, state.selected.id);
      return w ? { kind: "wire", item: w } : null;
    }
    return null;
  }

  function narrow() {
    return window.matchMedia("(max-width: 1099px)").matches;
  }

  function colX(n) {
    return BBX + 28 + n * P;
  }

  function rowY(row) {
    var i = "abcdefghij".indexOf(row);
    var y = BBY + 86 + i * P;
    if (i >= 5) y += 22;
    return y;
  }

  function railY(which) {
    if (which === "+top") return BBY + 20;
    if (which === "-top") return BBY + 20 + P + 6;
    var base = rowY("j") + 38;
    if (which === "+bottom") return base;
    return base + P + 6;
  }

  function holePoint(ref) {
    var h = D.parseHole(ref);
    if (!h) return null;
    return { x: colX(h.col), y: rowY(h.row) };
  }

  function railPoint(ref) {
    var m = /^rail:([+-]):(top|bottom):(\d+)$/.exec(ref || "");
    if (!m) return null;
    return { x: colX(parseInt(m[3], 10)), y: railY(m[1] + m[2]) };
  }

  function headerPoint(side, index) {
    return {
      x: side === "left" ? BOARD.x + 24 : BOARD.x + BOARD.w - 24,
      y: BOARD.y + 50 + index * PIN_STEP
    };
  }

  function icspPoint(col, row) {
    return { x: BOARD.x + 108 + col * 78, y: BOARD.y + 292 + row * 46 };
  }

  function pinMap() {
    var map = {};
    D.pinLayout(state.project.board).forEach(function (p) {
      map[p.ref] = headerPoint(p.side, p.index);
    });
    D.icspLayout(state.project.board).forEach(function (p) {
      if (!p.alias) map[p.ref] = icspPoint(p.col, p.row);
    });
    return map;
  }

  function modulePinPoint(mod, termId) {
    var terms = D.moduleTerminals(mod.type) || [];
    var idx = 0;
    for (var i = 0; i < terms.length; i++) if (terms[i].id === termId) idx = i;
    var box = slotBox(mod.slot);
    var gap = box.w / (terms.length + 1);
    return { x: box.x + gap * (idx + 1), y: box.y + box.h - 22 };
  }

  function slotBox(i) {
    return { x: MODX, y: MODY + 28 + i * (MODH + MODG), w: MODW, h: MODH };
  }

  function pointFor(end, pins) {
    if (!end) return null;
    if (end.kind === "hole") return holePoint(end.ref);
    if (end.kind === "rail") return railPoint(end.ref);
    if (end.kind === "pin") return pins[end.ref] || null;
    if (end.kind === "module") {
      var bits = end.ref.split(":");
      var mod = findById(state.project.modules, bits[0]);
      if (!mod) return null;
      return modulePinPoint(mod, bits[1]);
    }
    return null;
  }

  function nextId(prefix) {
    var ids = {};
    state.project.components.forEach(function (c) { ids[c.id] = true; });
    state.project.modules.forEach(function (m) { ids[m.id] = true; });
    state.project.wires.forEach(function (w) { ids[w.id] = true; });
    var n = 1;
    while (ids[prefix + n]) n += 1;
    return prefix + n;
  }

  function changed() {
    if (state.holdDraft) {
      state.holdDraft = false;
      state.pendingDraft = null;
      var banner = document.getElementById("bb-draft");
      if (banner) banner.hidden = true;
    }
    state.analysis = D.analyze(state.project);
    scheduleDraft();
    render();
  }

  function commit(fn) {
    var snap = JSON.stringify(state.project);
    fn();
    state.undo.push(snap);
    if (state.undo.length > 60) state.undo.shift();
    state.redo = [];
    changed();
  }

  function undo() {
    if (!state.undo.length) return;
    state.redo.push(JSON.stringify(state.project));
    state.project = JSON.parse(state.undo.pop());
    state.selected = null;
    state.wireStart = null;
    state.switchNote = "";
    changed();
  }

  function redo() {
    if (!state.redo.length) return;
    state.undo.push(JSON.stringify(state.project));
    state.project = JSON.parse(state.redo.pop());
    state.selected = null;
    state.wireStart = null;
    changed();
  }

  function scheduleDraft() {
    if (state.holdDraft) return;
    clearTimeout(state.draftTimer);
    state.draftTimer = setTimeout(writeDraft, 500);
  }

  function writeDraft() {
    try {
      localStorage.setItem(K_DRAFT, JSON.stringify(state.project));
    } catch (e) {
      if (!state.quotaTold) {
        state.quotaTold = true;
        flash(t("bb.file.quota"));
      }
    }
  }

  function loadProjects() {
    try {
      var raw = JSON.parse(localStorage.getItem(K_PROJECTS) || "[]");
      if (!Array.isArray(raw)) return [];
      var out = [];
      raw.forEach(function (item) {
        var v = D.validateProject(item);
        if (!v.ok) return;
        v.project.name = normalizeName(v.project.name);
        out.push(v.project);
      });
      return out;
    } catch (e) {
      return [];
    }
  }

  function writeProjects(list) {
    try {
      localStorage.setItem(K_PROJECTS, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  function readDraft() {
    try {
      var raw = JSON.parse(localStorage.getItem(K_DRAFT) || "null");
      if (!raw) return null;
      var v = D.validateProject(raw);
      if (!v.ok) return null;
      v.project.name = normalizeName(v.project.name);
      if (raw.id && !v.project.id) v.project.id = raw.id;
      return v.project;
    } catch (e) {
      return null;
    }
  }

  function stamp() {
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    var g = {};
    fmt.formatToParts(new Date()).forEach(function (p) { g[p.type] = p.value; });
    if (g.hour === "24") g.hour = "00";
    var ms = String(new Date().getMilliseconds());
    while (ms.length < 3) ms = "0" + ms;
    return g.year + "-" + g.month + "-" + g.day + "T" + g.hour + ":" + g.minute + ":" + g.second + "." + ms + "+08:00";
  }

  function flash(msg) {
    state.note = msg || "";
    var note = document.getElementById("bb-note");
    if (note) note.textContent = state.note;
    clearTimeout(state.noteTimer);
    if (!msg) return;
    state.noteTimer = setTimeout(function () {
      state.note = "";
      renderStatus();
    }, 2600);
  }

  function adopt(project, dirty) {
    state.project = project;
    if (!state.project.view) state.project.view = { zoom: 1, panX: -280, panY: 20 };
    state.forceDirty = !!dirty;
    state.savedCanonical = canonical(state.project);
    state.selected = null;
    state.mode = "select";
    state.placeType = null;
    state.legal = {};
    state.wireStart = null;
    state.undo = [];
    state.redo = [];
    state.switchNote = "";
    state.sheetOpen = false;
    state.holdDraft = false;
    state.pendingDraft = null;
    var draftBanner = document.getElementById("bb-draft");
    if (draftBanner) draftBanner.hidden = true;
    changed();
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode !== "place") {
      state.placeType = null;
      state.legal = {};
    }
    if (mode !== "wire") state.wireStart = null;
    render();
  }

  function setBoard(board) {
    if (state.project.board === board) return;
    state.switchNote = board;
    commit(function () { state.project.board = board; });
  }

  function legalAnchors(type) {
    var set = {};
    var part = D.partById(type);
    if (!part) return set;
    if (D.countType(state.project, type) >= part.limit) return set;
    if (part.place === "module") {
      for (var i = 0; i < D.MAX_SLOTS; i++) {
        if (!D.slotTaken(state.project, i)) set["slot:" + i] = true;
      }
      return set;
    }
    D.ROWS.forEach(function (row) {
      for (var c = 1; c <= D.COLS; c++) {
        var anchor = row + c;
        var fp = D.footprint(type, anchor, 0);
        if (fp.ok && !D.collides(state.project.components, fp, null)) set[anchor] = true;
      }
    });
    return set;
  }

  function beginPlace(type) {
    var part = D.partById(type);
    if (!part) return;
    if (D.countType(state.project, type) >= part.limit) {
      flash(t("bb.parts.capped"));
      return;
    }
    if (state.mode === "place" && state.placeType === type) {
      setMode("select");
      return;
    }
    state.mode = "place";
    state.placeType = type;
    state.wireStart = null;
    state.legal = legalAnchors(type);
    render();
  }

  function placeComponent(type, anchor) {
    var part = D.partById(type);
    if (!part || D.countType(state.project, type) >= part.limit) {
      flash(t("bb.parts.capped"));
      return;
    }
    var fp = D.footprint(type, anchor, 0);
    if (!fp.ok || D.collides(state.project.components, fp, null)) return;
    var id = nextId("c");
    state.mode = "select";
    state.placeType = null;
    state.legal = {};
    state.sheetOpen = true;
    commit(function () {
      state.project.components.push({
        id: id,
        type: type,
        anchor: anchor,
        rotation: 0,
        props: D.defaultProps(type),
        name: ""
      });
      state.selected = { kind: "component", id: id };
    });
  }

  function placeModule(type, slot) {
    var part = D.partById(type);
    if (!part || D.countType(state.project, type) >= part.limit) {
      flash(t("bb.parts.capped"));
      return;
    }
    if (D.slotTaken(state.project, slot)) return;
    var id = nextId("m");
    state.mode = "select";
    state.placeType = null;
    state.legal = {};
    state.sheetOpen = true;
    commit(function () {
      state.project.modules.push({ id: id, type: type, slot: slot, props: {}, name: "" });
      state.selected = { kind: "module", id: id };
    });
  }

  function hasWire(a, b) {
    var key = D.wireKey({ from: a, to: b });
    for (var i = 0; i < state.project.wires.length; i++) {
      if (D.wireKey(state.project.wires[i]) === key) return true;
    }
    return false;
  }

  function addWire(from, to) {
    if (D.sameEnd(from, to) || hasWire(from, to)) {
      flash(t("bb.status.wireDup"));
      if (!D.sameEnd(from, to)) state.wireStart = null;
      render();
      return;
    }
    var color = D.autoWireColor(to);
    state.wireStart = null;
    commit(function () {
      state.project.wires.push({ id: nextId("w"), from: from, to: to, color: color });
    });
  }

  function rotateSelected() {
    var sel = currentSelection();
    if (!sel || sel.kind !== "component") return;
    var rot = sel.item.rotation || 0;
    var next = null;
    for (var i = 0; i < 4; i++) {
      rot = (rot + 90) % 360;
      var fp = D.footprint(sel.item.type, sel.item.anchor, rot);
      if (fp.ok && !D.collides(state.project.components, fp, sel.item.id)) {
        next = rot;
        break;
      }
    }
    if (next == null) return;
    commit(function () { sel.item.rotation = next; });
  }

  function deleteSelection() {
    var sel = currentSelection();
    if (!sel) return;
    commit(function () {
      if (sel.kind === "component") {
        state.project.components = state.project.components.filter(function (c) { return c.id !== sel.item.id; });
      } else if (sel.kind === "module") {
        var id = sel.item.id;
        state.project.modules = state.project.modules.filter(function (m) { return m.id !== id; });
        state.project.wires = state.project.wires.filter(function (w) {
          var a = w.from.kind === "module" && w.from.ref.indexOf(id + ":") === 0;
          var b = w.to.kind === "module" && w.to.ref.indexOf(id + ":") === 0;
          return !a && !b;
        });
      } else {
        state.project.wires = state.project.wires.filter(function (w) { return w.id !== sel.item.id; });
      }
      state.selected = null;
      state.sheetOpen = false;
    });
  }

  function nudge(dc, dr) {
    var sel = currentSelection();
    if (!sel || sel.kind !== "component") return;
    var h = D.parseHole(sel.item.anchor);
    if (!h) return;
    var ri = D.ROWS.indexOf(h.row) + dr;
    var col = h.col + dc;
    if (ri < 0 || ri >= D.ROWS.length || col < 1 || col > D.COLS) return;
    var anchor = D.ROWS[ri] + String(col);
    var fp = D.footprint(sel.item.type, anchor, sel.item.rotation || 0);
    if (!fp.ok || D.collides(state.project.components, fp, sel.item.id)) return;
    commit(function () { sel.item.anchor = anchor; });
  }

  function tryMove(comp, dc, dr) {
    if (!dc && !dr) {
      render();
      return;
    }
    var h = D.parseHole(comp.anchor);
    if (!h) return;
    var ri = D.ROWS.indexOf(h.row) + dr;
    var col = h.col + dc;
    if (ri < 0 || ri >= D.ROWS.length || col < 1 || col > D.COLS) {
      render();
      return;
    }
    var anchor = D.ROWS[ri] + String(col);
    var fp = D.footprint(comp.type, anchor, comp.rotation || 0);
    if (!fp.ok || D.collides(state.project.components, fp, comp.id)) {
      render();
      return;
    }
    commit(function () { comp.anchor = anchor; });
  }

  function termsOf(sel) {
    if (sel.kind === "module") {
      return (D.moduleTerminals(sel.item.type) || []).map(function (term) {
        return { id: term.id, labelKey: term.labelKey, end: { kind: "module", ref: sel.item.id + ":" + term.id } };
      });
    }
    var fp = D.footprint(sel.item.type, sel.item.anchor, sel.item.rotation || 0);
    if (!fp.ok) return [];
    return fp.terminals.map(function (term) {
      return { id: term.id, labelKey: term.labelKey, end: { kind: "hole", ref: term.hole } };
    });
  }

  function connectedPins(sel, termId) {
    var key = sel.item.id + ":" + termId;
    return (state.analysis && state.analysis.connections && state.analysis.connections[key]) || [];
  }

  function connectedText(sel, termId) {
    var pins = connectedPins(sel, termId);
    if (!pins.length) return t("bb.insp.unconnected");
    return t("bb.insp.connectedTo", { pin: pins.join(lang() === "en" ? ", " : "、") });
  }

  function endLabel(end) {
    if (!end) return "";
    if (end.kind === "pin") return D.displayPin(end.ref, state.project.board);
    if (end.kind === "hole") return end.ref;
    if (end.kind === "rail") {
      var m = /^rail:([+-]):(top|bottom):(\d+)$/.exec(end.ref);
      if (!m) return end.ref;
      var key = "bb.rail." + m[2] + (m[1] === "+" ? "Plus" : "Minus");
      return t(key, { n: m[3] });
    }
    if (end.kind === "module") {
      var bits = end.ref.split(":");
      var mod = findById(state.project.modules, bits[0]);
      var terms = mod ? D.moduleTerminals(mod.type) || [] : [];
      var term = null;
      for (var i = 0; i < terms.length; i++) if (terms[i].id === bits[1]) term = terms[i];
      var name = mod ? itemLabel(mod, state.project.modules) : bits[0];
      return name + " · " + (term ? t(term.labelKey) : bits[1]);
    }
    return end.ref || "";
  }

  function connectTerminal(sel, term, pinRef) {
    var attach = term.end;
    var target = { kind: "pin", ref: pinRef };
    commit(function () {
      state.project.wires = state.project.wires.filter(function (w) {
        var pinEnd = w.from.kind === "pin" ? w.from : w.to.kind === "pin" ? w.to : null;
        var other = w.from.kind === "pin" ? w.to : w.to.kind === "pin" ? w.from : null;
        if (!pinEnd || !other) return true;
        return !D.sameEnd(other, attach);
      });
      if (!hasWire(attach, target)) {
        state.project.wires.push({
          id: nextId("w"),
          from: attach,
          to: target,
          color: D.autoWireColor(target)
        });
      }
    });
  }

  function drawScene(parent, exporting) {
    var pins = pinMap();
    var board = state.project.board;
    s("rect", {
      x: -600, y: -400, width: 2600, height: 1800,
      fill: exporting ? "#FFFFFF" : "transparent",
      "data-hit": "bg"
    }, parent);

    drawBoard(parent, board, pins, exporting);
    drawBreadboard(parent, exporting);
    drawModuleArea(parent, exporting);
    drawWires(parent, pins, exporting);
    state.project.modules.forEach(function (mod) { drawModule(parent, mod, exporting); });
    drawModulePins(parent, exporting);
    state.project.components.forEach(function (comp) { drawPlacedComponent(parent, comp, exporting); });

    if (!exporting && state.wireStart) {
      var p = pointFor(state.wireStart, pins);
      if (p) {
        s("circle", {
          cx: p.x, cy: p.y, r: 12, fill: "none", stroke: "#0D9488", "stroke-width": 3, "pointer-events": "none"
        }, parent);
      }
    }
    if (!exporting) s("g", { id: "bb-ghost", "pointer-events": "none" }, parent);
  }

  function drawBoard(parent, board, pins, exporting) {
    var g = s("g", {}, parent);
    s("rect", {
      x: BOARD.x, y: BOARD.y, width: BOARD.w, height: BOARD.h, rx: 16,
      fill: "#0D1B2A"
    }, g);
    s("rect", {
      x: BOARD.x - 10, y: BOARD.y + 250, width: 16, height: 56, rx: 3, fill: "#64748B"
    }, g);
    s("rect", {
      x: BOARD.x + BOARD.w - 6, y: BOARD.y + 80, width: 14, height: 42, rx: 3, fill: "#94A3B8"
    }, g);
    svgText(g, BOARD.x + BOARD.w / 2, BOARD.y + 26, t(board === "leonardo" ? "bb.board.leonardo" : "bb.board.uno"), {
      fill: "#FFFFFF", size: 14
    });

    D.pinLayout(board).forEach(function (pin) {
      var pt = pins[pin.ref];
      var hitX = pin.side === "left" ? BOARD.x : BOARD.x + BOARD.w - 84;
      s("rect", {
        x: hitX, y: pt.y - 18, width: 84, height: 36, rx: 6,
        fill: "transparent", stroke: "transparent",
        "data-hit": "pin", "data-kind": "pin", "data-ref": pin.ref
      }, g);
      var power = pin.ref === "5V" || pin.ref === "3V3" || pin.ref.indexOf("GND") === 0;
      var pad = power ? (pin.ref === "5V" ? "#C4392B" : pin.ref === "3V3" ? "#E8A838" : "#F8FAFC") : "#F8FAFC";
      s("circle", { cx: pt.x, cy: pt.y, r: 5, fill: pad, stroke: "#E2E8F0", "stroke-width": 1 }, g);
      var labelX = pin.side === "left" ? pt.x + 12 : pt.x - 12;
      var anchor = pin.side === "left" ? "start" : "end";
      var labelFill = pin.ref === "5V" ? "#FF8A7A" : pin.ref === "3V3" ? "#E8A838" : "#FFFFFF";
      svgText(g, labelX, pt.y, pin.label, { fill: labelFill, size: 11, anchor: anchor });
      var badges = pin.badges || [];
      badges.forEach(function (badge, i) {
        var bw = Math.max(28, badge.length * 7 + 8);
        var bx = pin.side === "left" ? labelX + 28 + i * (bw + 3) : labelX - 36 - i * (bw + 3) - bw;
        var by = pt.y - 7;
        var i2c = badge === "SDA" || badge === "SCL";
        s("rect", {
          x: bx, y: by, width: bw, height: 14, rx: 3,
          fill: i2c ? "#E8A838" : "#E8F4F3"
        }, g);
        svgText(g, bx + bw / 2, by + 7, badge, { size: 8, fill: "#0D1B2A" });
      });
      if (pin.note) {
        var nx = pin.side === "left" ? labelX + 26 : labelX - 26;
        svgText(g, nx, pt.y + 12, pin.note, { size: 8, fill: "#E8A838", anchor: anchor });
      }
    });

    var icsp = D.icspLayout(board);
    svgText(g, BOARD.x + BOARD.w / 2, BOARD.y + 268, board === "leonardo" ? "ICSP · SPI" : "ICSP", {
      fill: "#FFFFFF", size: 11
    });
    icsp.forEach(function (pin) {
      var pt = icspPoint(pin.col, pin.row);
      s("circle", { cx: pt.x, cy: pt.y, r: 5, fill: "#F8FAFC" }, g);
      svgText(g, pt.x + (pin.col === 0 ? -8 : 8), pt.y, pin.label, {
        fill: "#FFFFFF",
        size: 8,
        anchor: pin.col === 0 ? "end" : "start"
      });
      if (!pin.alias) {
        s("rect", {
          x: pt.x - 22, y: pt.y - 16, width: 44, height: 32, rx: 6,
          fill: "transparent",
          "data-hit": "pin", "data-kind": "pin", "data-ref": pin.ref
        }, g);
      }
    });
  }

  function drawBreadboard(parent, exporting) {
    var g = s("g", {}, parent);
    var left = colX(1) - 22;
    var right = colX(30) + 22;
    var top = railY("+top") - 16;
    var bottom = railY("-bottom") + 16;
    s("rect", {
      x: left, y: top, width: right - left, height: bottom - top, rx: 12,
      fill: "#FFFFFF", stroke: "#0D1B2A", "stroke-width": 2
    }, g);
    var gy = (rowY("e") + rowY("f")) / 2 - 7;
    s("rect", {
      x: left + 10, y: gy, width: right - left - 20, height: 14, rx: 4, fill: "#E2E8F0"
    }, g);

    drawRail(g, "+top", "#C4392B", "+");
    drawRail(g, "-top", "#0D1B2A", "−");
    drawRail(g, "+bottom", "#C4392B", "+");
    drawRail(g, "-bottom", "#0D1B2A", "−");

    D.ROWS.forEach(function (row) {
      svgText(g, left + 10, rowY(row), row, { size: 9, fill: "#64748B", anchor: "middle" });
    });
    for (var n = 1; n <= 30; n++) {
      svgText(g, colX(n), gy + 7, String(n), { size: 8, fill: "#64748B" });
    }
    for (n = 1; n <= 30; n++) {
      D.ROWS.forEach(function (row) {
        var ref = row + n;
        var legal = !exporting && state.legal && state.legal[ref];
        s("circle", {
          class: "bb-hole",
          cx: colX(n), cy: rowY(row), r: 6.5,
          stroke: legal ? "#0D9488" : "none",
          "stroke-width": legal ? 2 : 0,
          "data-hit": "hole",
          "data-kind": "hole",
          "data-ref": ref
        }, g);
      });
    }
  }

  function drawRail(g, which, color, symbol) {
    var y = railY(which);
    var sign = which.charAt(0);
    var side = which.indexOf("top") !== -1 ? "top" : "bottom";
    s("line", {
      x1: colX(1), y1: y, x2: colX(30), y2: y,
      stroke: color, "stroke-width": 3, "stroke-linecap": "round"
    }, g);
    svgText(g, colX(1) - 14, y, symbol, { size: 14, fill: "#0D1B2A" });
    svgText(g, colX(30) + 14, y, symbol, { size: 14, fill: "#0D1B2A" });
    for (var n = 1; n <= 30; n++) {
      var ref = "rail:" + sign + ":" + side + ":" + n;
      s("circle", {
        class: "bb-hole",
        cx: colX(n), cy: y, r: 5,
        "data-hit": "rail",
        "data-kind": "rail",
        "data-ref": ref
      }, g);
    }
  }

  function drawModuleArea(parent, exporting) {
    var g = s("g", {}, parent);
    svgText(g, MODX + MODW / 2, MODY + 8, t("bb.modules.title"), { size: 13 });
    for (var i = 0; i < D.MAX_SLOTS; i++) {
      var box = slotBox(i);
      var legal = !exporting && state.legal && state.legal["slot:" + i];
      var slot = s("g", { "data-hit": "slot", "data-slot": String(i) }, g);
      s("rect", {
        x: box.x, y: box.y, width: box.w, height: box.h, rx: 10,
        fill: legal ? "rgba(13,148,136,0.12)" : "rgba(232,244,243,0.7)",
        stroke: legal ? "#0D9488" : "#64748B",
        "stroke-width": legal ? 2.5 : 1.5,
        "stroke-dasharray": "6 4"
      }, slot);
      if (!D.slotTaken(state.project, i)) {
        svgText(slot, box.x + box.w / 2, box.y + box.h / 2, t("bb.modules.empty"), {
          size: 11, fill: "#64748B"
        });
      }
    }
  }

  function drawModule(parent, mod, exporting) {
    var box = slotBox(mod.slot);
    var g = s("g", { class: "bb-mod", "data-hit": "mod", "data-id": mod.id }, parent);
    var selected = !exporting && state.selected && state.selected.kind === "module" && state.selected.id === mod.id;
    s("rect", {
      x: box.x + 8, y: box.y + 8, width: box.w - 16, height: box.h - 36, rx: 8,
      fill: "#F8FAFC", stroke: selected ? "#0D9488" : "#0D1B2A", "stroke-width": selected ? 3 : 1.5
    }, g);
    svgText(g, box.x + box.w / 2, box.y + 28, itemLabel(mod, state.project.modules), { size: 12 });
    if (mod.type === "ultrasonic") {
      s("circle", { cx: box.x + 70, cy: box.y + 62, r: 16, fill: "#E8F4F3", stroke: "#0D1B2A", "stroke-width": 2 }, g);
      s("circle", { cx: box.x + box.w - 70, cy: box.y + 62, r: 16, fill: "#0D9488", stroke: "#0D1B2A", "stroke-width": 2 }, g);
    } else {
      s("rect", { x: box.x + 36, y: box.y + 44, width: box.w - 72, height: 28, rx: 4, fill: "#0D1B2A" }, g);
      svgText(g, box.x + box.w / 2, box.y + 58, "SERVO", { fill: "#FFFFFF", size: 10 });
    }
  }

  function drawModulePins(parent, exporting) {
    state.project.modules.forEach(function (mod) {
      var terms = D.moduleTerminals(mod.type) || [];
      terms.forEach(function (term) {
        var pt = modulePinPoint(mod, term.id);
        var color = "#0D1B2A";
        if (mod.type === "servo" && term.id === "signal") color = "#E8A838";
        if (mod.type === "servo" && term.id === "vcc") color = "#C4392B";
        if (term.id === "gnd" || term.id === "minus") color = "#0D1B2A";
        if (term.id === "vcc") color = "#C4392B";
        s("circle", { cx: pt.x, cy: pt.y, r: 6, fill: color, stroke: "#FFFFFF", "stroke-width": 1 }, parent);
        svgText(parent, pt.x, pt.y - 14, t(term.labelKey), { size: 9 });
        s("rect", {
          x: pt.x - 22, y: pt.y - 22, width: 44, height: 44, rx: 8,
          fill: "transparent",
          "data-hit": "modpin",
          "data-kind": "module",
          "data-ref": mod.id + ":" + term.id
        }, parent);
      });
    });
  }

  function drawPlacedComponent(parent, comp, exporting) {
    var g = s("g", { class: "bb-comp", "data-hit": "comp", "data-id": comp.id, id: "bb-comp-" + comp.id }, parent);
    if (!exporting && state.selected && state.selected.kind === "component" && state.selected.id === comp.id) {
      var fp = D.footprint(comp.type, comp.anchor, comp.rotation || 0);
      if (fp.ok) {
        var box = holeBounds(fp.holes);
        if (box) {
          s("rect", {
            x: box.x, y: box.y, width: box.w, height: box.h, rx: 8,
            fill: "none", stroke: "rgba(13,148,136,0.35)", "stroke-width": 6
          }, g);
          s("rect", {
            x: box.x, y: box.y, width: box.w, height: box.h, rx: 8,
            fill: "none", stroke: "#0D9488", "stroke-width": 2
          }, g);
        }
      }
    }
    drawComponentGraphic(g, comp);
  }

  function holeBounds(holes) {
    var xs = [];
    var ys = [];
    Object.keys(holes).forEach(function (k) {
      var p = holePoint(holes[k]);
      if (!p) return;
      xs.push(p.x);
      ys.push(p.y);
    });
    if (!xs.length) return null;
    var minX = Math.min.apply(null, xs) - 14;
    var minY = Math.min.apply(null, ys) - 14;
    var maxX = Math.max.apply(null, xs) + 14;
    var maxY = Math.max.apply(null, ys) + 14;
    return { x: minX, y: minY, w: Math.max(36, maxX - minX), h: Math.max(28, maxY - minY) };
  }

  function drawComponentGraphic(g, comp) {
    var fp = D.footprint(comp.type, comp.anchor, comp.rotation || 0);
    if (!fp.ok) return;
    if (comp.type === "led") drawLed(g, holePoint(fp.holes.anode), holePoint(fp.holes.cathode), (comp.props && comp.props.color) || "red");
    else if (comp.type === "resistor") drawResistor(g, holePoint(fp.holes.a), holePoint(fp.holes.b), (comp.props && comp.props.value) || "220");
    else if (comp.type === "ldr") drawLdr(g, holePoint(fp.holes.a), holePoint(fp.holes.b));
    else if (comp.type === "buzzer") drawBuzzer(g, holePoint(fp.holes.plus), holePoint(fp.holes.minus));
    else if (comp.type === "pot") drawPot(g, holePoint(fp.holes.pin1), holePoint(fp.holes.wiper), holePoint(fp.holes.pin3));
    else if (comp.type === "button") {
      drawButton(g, holePoint(fp.holes.end1), holePoint(fp.holes.end1b), holePoint(fp.holes.end2), holePoint(fp.holes.end2b));
    }
  }

  function drawLed(g, anode, cathode, color) {
    if (!anode || !cathode) return;
    s("line", { x1: cathode.x, y1: cathode.y, x2: anode.x, y2: anode.y, stroke: "#0D1B2A", "stroke-width": 2 }, g);
    var mx = (anode.x + cathode.x) / 2;
    var my = (anode.y + cathode.y) / 2;
    s("circle", {
      cx: mx, cy: my, r: 8,
      fill: LED_HEX[color] || LED_HEX.red,
      stroke: "#0D1B2A", "stroke-width": 1.5
    }, g);
    var dx = cathode.x - anode.x;
    var dy = cathode.y - anode.y;
    var len = Math.hypot(dx, dy) || 1;
    var ux = dx / len;
    var uy = dy / len;
    var fx = mx + ux * 5;
    var fy = my + uy * 5;
    s("line", {
      x1: fx - uy * 7, y1: fy + ux * 7, x2: fx + uy * 7, y2: fy - ux * 7,
      stroke: "#0D1B2A", "stroke-width": 2
    }, g);
  }

  function drawResistor(g, a, b, value) {
    if (!a || !b) return;
    var mx = (a.x + b.x) / 2;
    var my = (a.y + b.y) / 2;
    var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    s("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#0D1B2A", "stroke-width": 2 }, g);
    var body = s("g", { transform: "translate(" + mx + " " + my + ") rotate(" + ang + ")" }, g);
    s("rect", { x: -20, y: -7, width: 40, height: 14, rx: 2, fill: "#F8FAFC", stroke: "#0D1B2A", "stroke-width": 1.4 }, body);
    var bands = RES_BANDS[value] || RES_BANDS["220"];
    bands.forEach(function (band, i) {
      s("rect", { x: -12 + i * 6, y: -7, width: 3, height: 14, fill: BAND[band] || "#0D1B2A" }, body);
    });
    svgText(g, mx, my - 16, value + "Ω", { size: 9 });
  }

  function drawLdr(g, a, b) {
    if (!a || !b) return;
    var mx = (a.x + b.x) / 2;
    var my = (a.y + b.y) / 2;
    s("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#0D1B2A", "stroke-width": 2 }, g);
    s("circle", { cx: mx, cy: my, r: 8, fill: "#E8F4F3", stroke: "#0D9488", "stroke-width": 2 }, g);
    s("path", { d: "M" + (mx + 6) + " " + (my - 10) + " l4 -4 M" + (mx + 4) + " " + (my - 6) + " l5 -1", stroke: "#E8A838", "stroke-width": 1.5, fill: "none" }, g);
  }

  function drawBuzzer(g, plus, minus) {
    if (!plus || !minus) return;
    var mx = (plus.x + minus.x) / 2;
    var my = (plus.y + minus.y) / 2;
    s("line", { x1: plus.x, y1: plus.y, x2: minus.x, y2: minus.y, stroke: "#0D1B2A", "stroke-width": 2 }, g);
    s("circle", { cx: mx, cy: my, r: 12, fill: "#0D1B2A" }, g);
    svgText(g, mx - 4, my, "+", { fill: "#E8A838", size: 11 });
    svgText(g, mx + 6, my, "−", { fill: "#FFFFFF", size: 11 });
  }

  function drawPot(g, p1, wiper, p3) {
    if (!p1 || !wiper || !p3) return;
    s("line", { x1: p1.x, y1: p1.y, x2: p3.x, y2: p3.y, stroke: "#0D1B2A", "stroke-width": 2 }, g);
    var dx = p3.x - p1.x;
    var dy = p3.y - p1.y;
    var len = Math.hypot(dx, dy) || 1;
    var ox = -dy / len * 16;
    var oy = dx / len * 16;
    s("rect", {
      x: wiper.x + ox - 16, y: wiper.y + oy - 10, width: 32, height: 20, rx: 4,
      fill: "#E8F4F3", stroke: "#0D1B2A", "stroke-width": 1.5
    }, g);
    s("circle", { cx: wiper.x + ox, cy: wiper.y + oy, r: 5, fill: "#E8A838", stroke: "#0D1B2A" }, g);
  }

  function drawButton(g, e1, f1, e2, f2) {
    if (!e1 || !f1 || !e2 || !f2) return;
    var x = Math.min(e1.x, e2.x) - 8;
    var y = Math.min(e1.y, f1.y) - 8;
    var w = Math.abs(e2.x - e1.x) + 16;
    var h = Math.abs(f1.y - e1.y) + 16;
    s("rect", { x: x, y: y, width: w, height: h, rx: 6, fill: "#E8F4F3", stroke: "#0D1B2A", "stroke-width": 2 }, g);
    s("circle", { cx: (e1.x + e2.x) / 2, cy: (e1.y + f1.y) / 2, r: 7, fill: "#0D1B2A" }, g);
  }

  function wirePath(x1, y1, x2, y2) {
    var gapX = BOARD.x + BOARD.w + 18;
    var onBoard = function (x) { return x < BOARD.x + BOARD.w - 8; };
    if (onBoard(x1) !== onBoard(x2)) {
      var lane = gapX;
      return "M " + x1 + " " + y1 + " L " + lane + " " + y1 + " L " + lane + " " + y2 + " L " + x2 + " " + y2;
    }
    var channel = Math.min(y1, y2) - 26;
    return "M " + x1 + " " + y1 + " L " + x1 + " " + channel + " L " + x2 + " " + channel + " L " + x2 + " " + y2;
  }

  function drawWires(parent, pins, exporting) {
    state.project.wires.forEach(function (wire) {
      var a = pointFor(wire.from, pins);
      var b = pointFor(wire.to, pins);
      if (!a || !b) return;
      var g = s("g", { class: "bb-wire", "data-hit": "wire", "data-id": wire.id }, parent);
      var d = wirePath(a.x, a.y, b.x, b.y);
      var selected = !exporting && state.selected && state.selected.kind === "wire" && state.selected.id === wire.id;
      var color = WIRE_HEX[wire.color] || WIRE_HEX.yellow;
      if (!exporting) {
        s("path", {
          d: d, fill: "none", stroke: "#000000", "stroke-opacity": "0",
          "stroke-width": 16, "pointer-events": "stroke"
        }, g);
      }
      if (wire.color === "white") {
        s("path", {
          d: d, fill: "none", stroke: "#94A3B8", "stroke-width": selected ? 7 : 5,
          "stroke-linejoin": "round", "stroke-linecap": "round", "pointer-events": "none"
        }, g);
      }
      s("path", {
        d: d, fill: "none", stroke: color, "stroke-width": selected ? 5 : 3,
        "stroke-linejoin": "round", "stroke-linecap": "round", "pointer-events": "none"
      }, g);
    });
  }

  function renderScene() {
    var scene = document.getElementById("bb-scene");
    if (!scene) return;
    while (scene.firstChild) scene.removeChild(scene.firstChild);
    drawScene(scene, false);
    applyView();
    var svg = document.getElementById("bb-svg");
    if (svg) svg.setAttribute("data-mode", state.mode);
  }

  function applyView() {
    var scene = document.getElementById("bb-scene");
    if (!scene || !state.project) return;
    var v = state.project.view;
    scene.setAttribute("transform", "translate(" + v.panX + " " + v.panY + ") scale(" + v.zoom + ")");
  }

  function clientToSvg(x, y) {
    var svg = document.getElementById("bb-svg");
    var pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    var ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    var p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function clientToScene(x, y) {
    var scene = document.getElementById("bb-scene");
    var svg = document.getElementById("bb-svg");
    var pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    var ctm = scene.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    var p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function zoomAt(clientX, clientY, z) {
    var before = clientToScene(clientX, clientY);
    state.project.view.zoom = clamp(z, 0.5, 2);
    var parent = clientToSvg(clientX, clientY);
    state.project.view.panX = parent.x - before.x * state.project.view.zoom;
    state.project.view.panY = parent.y - before.y * state.project.view.zoom;
    applyView();
    syncChrome();
    scheduleDraft();
  }

  function fitView() {
    var svg = document.getElementById("bb-svg");
    var rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var z = clamp(Math.min(rect.width / SCENE_W, rect.height / SCENE_H), 0.5, 2);
    state.project.view.zoom = z;
    state.project.view.panX = (rect.width - SCENE_W * z) / 2;
    state.project.view.panY = (rect.height - SCENE_H * z) / 2;
    applyView();
    syncChrome();
    scheduleDraft();
  }

  function icon(type) {
    var svg = s("svg", { viewBox: "0 0 40 40", "aria-hidden": "true" });
    if (type === "led") {
      s("circle", { cx: 20, cy: 18, r: 8, fill: "#C4392B", stroke: "#0D1B2A", "stroke-width": 1.5 }, svg);
      s("line", { x1: 14, y1: 18, x2: 26, y2: 18, stroke: "#0D1B2A", "stroke-width": 2 }, svg);
      s("line", { x1: 20, y1: 26, x2: 20, y2: 34, stroke: "#0D1B2A", "stroke-width": 2 }, svg);
    } else if (type === "resistor") {
      s("rect", { x: 6, y: 14, width: 28, height: 12, rx: 2, fill: "#F8FAFC", stroke: "#0D1B2A" }, svg);
      s("rect", { x: 10, y: 14, width: 3, height: 12, fill: "#C4392B" }, svg);
      s("rect", { x: 16, y: 14, width: 3, height: 12, fill: "#C4392B" }, svg);
      s("rect", { x: 22, y: 14, width: 3, height: 12, fill: "#8A5A2B" }, svg);
      s("rect", { x: 28, y: 14, width: 3, height: 12, fill: "#D4A017" }, svg);
    } else if (type === "button") {
      s("rect", { x: 8, y: 8, width: 24, height: 24, rx: 4, fill: "#E8F4F3", stroke: "#0D1B2A", "stroke-width": 1.5 }, svg);
      s("circle", { cx: 20, cy: 20, r: 6, fill: "#0D1B2A" }, svg);
    } else if (type === "ldr") {
      s("circle", { cx: 18, cy: 22, r: 8, fill: "#E8F4F3", stroke: "#0D9488", "stroke-width": 2 }, svg);
      s("path", { d: "M24 12 l5 -4 M22 14 l6 0", stroke: "#E8A838", "stroke-width": 1.5, fill: "none" }, svg);
    } else if (type === "pot") {
      s("rect", { x: 8, y: 14, width: 24, height: 14, rx: 3, fill: "#E8F4F3", stroke: "#0D1B2A" }, svg);
      s("circle", { cx: 20, cy: 21, r: 4, fill: "#E8A838", stroke: "#0D1B2A" }, svg);
    } else if (type === "buzzer") {
      s("circle", { cx: 20, cy: 20, r: 12, fill: "#0D1B2A" }, svg);
      svgText(svg, 16, 20, "+", { fill: "#E8A838", size: 10 });
      svgText(svg, 25, 20, "−", { fill: "#FFFFFF", size: 10 });
    } else if (type === "servo") {
      s("rect", { x: 6, y: 10, width: 28, height: 18, rx: 3, fill: "#0D1B2A" }, svg);
      s("line", { x1: 12, y1: 28, x2: 12, y2: 36, stroke: "#E8A838", "stroke-width": 2 }, svg);
      s("line", { x1: 20, y1: 28, x2: 20, y2: 36, stroke: "#C4392B", "stroke-width": 2 }, svg);
      s("line", { x1: 28, y1: 28, x2: 28, y2: 36, stroke: "#64748B", "stroke-width": 2 }, svg);
    } else {
      s("rect", { x: 4, y: 12, width: 32, height: 16, rx: 3, fill: "#F8FAFC", stroke: "#0D1B2A" }, svg);
      s("circle", { cx: 14, cy: 20, r: 5, fill: "#E8F4F3", stroke: "#0D1B2A" }, svg);
      s("circle", { cx: 26, cy: 20, r: 5, fill: "#0D9488", stroke: "#0D1B2A" }, svg);
    }
    return svg;
  }

  function renderParts() {
    var host = document.getElementById("bb-parts");
    if (!host) return;
    host.innerHTML = "";
    D.PARTS.forEach(function (part) {
      var count = D.countType(state.project, part.id);
      var capped = count >= part.limit;
      var btn = el("button", { type: "button", class: "bb-part" + (capped ? " is-capped" : "") });
      btn.setAttribute("data-part", part.id);
      var name = t("bb.parts." + part.id);
      btn.setAttribute("aria-label", name);
      btn.title = name;
      if (state.mode === "place" && state.placeType === part.id) btn.setAttribute("aria-pressed", "true");
      if (capped) btn.setAttribute("aria-disabled", "true");
      var iconWrap = el("span", { class: "bb-part-icon" });
      iconWrap.setAttribute("aria-hidden", "true");
      iconWrap.appendChild(icon(part.id));
      btn.appendChild(iconWrap);
      var nameSpan = el("span", { class: "bb-part-name", text: name });
      nameSpan.setAttribute("aria-hidden", "true");
      btn.appendChild(nameSpan);
      host.appendChild(btn);
    });
  }

  function renderInspector() {
    fillInspector(document.getElementById("bb-inspector"), true);
    fillInspector(document.getElementById("bb-sheet-body"), false);
  }

  function fillInspector(host, idleOk) {
    if (!host) return;
    host.innerHTML = "";
    var sel = currentSelection();
    if (!sel) {
      if (!idleOk) return;
      host.appendChild(el("h2", { text: displayProjectName() }));
      host.appendChild(el("p", { class: "bb-quiet", text: t(state.project.board === "leonardo" ? "bb.board.leonardo" : "bb.board.uno") }));
      host.appendChild(el("p", { class: "bb-quiet", text: t("bb.insp.parts", { count: state.project.components.length + state.project.modules.length }) }));
      host.appendChild(el("p", { class: "bb-quiet", text: t("bb.insp.wires", { count: state.project.wires.length }) }));
      host.appendChild(el("p", { class: "bb-privacy", text: t("bb.intro.privacy") }));
      return;
    }
    if (sel.kind === "wire") {
      host.appendChild(el("h2", { text: t("bb.insp.wireColor") }));
      host.appendChild(el("p", { class: "bb-quiet", text: t("bb.insp.wireEnds", { from: endLabel(sel.item.from), to: endLabel(sel.item.to) }) }));
      host.appendChild(colorSelect(t("bb.insp.wireColor"), "wire-color", D.WIRE_COLORS, sel.item.color, "bb.wire."));
      host.appendChild(deleteButton());
      return;
    }
    var list = sel.kind === "module" ? state.project.modules : state.project.components;
    host.appendChild(el("h2", { text: itemLabel(sel.item, list) }));
    var nameField = el("div", { class: "bb-field" });
    nameField.appendChild(el("label", { text: t("bb.insp.rename") }));
    var input = el("input", { type: "text", maxlength: "20", value: sel.item.name || "" });
    input.value = sel.item.name || "";
    input.addEventListener("focus", function () { state.nameSnap = JSON.stringify(state.project); });
    input.addEventListener("input", function () { sel.item.name = input.value.slice(0, 20); });
    input.addEventListener("blur", function () {
      sel.item.name = String(input.value || "").trim().slice(0, 20);
      if (state.nameSnap && state.nameSnap !== JSON.stringify(state.project)) {
        state.undo.push(state.nameSnap);
        state.redo = [];
      }
      state.nameSnap = null;
      changed();
    });
    nameField.appendChild(input);
    host.appendChild(nameField);

    if (sel.item.type === "led") {
      host.appendChild(colorSelect(t("bb.insp.color"), "color", D.LED_COLORS, (sel.item.props && sel.item.props.color) || "red", "bb.led.color."));
    }
    if (sel.item.type === "resistor") {
      host.appendChild(colorSelect(t("bb.resistor.value"), "value", D.RESISTOR_VALUES, (sel.item.props && sel.item.props.value) || "220", "", function (v) { return v + "Ω"; }));
    }
    if (sel.item.type === "pot") {
      host.appendChild(el("p", { class: "bb-note-copy", text: t("bb.pot.valueFixed") }));
    }
    var noteKey = {
      button: "bb.button.note",
      ldr: "bb.ldr.note",
      buzzer: "bb.buzzer.note",
      servo: "bb.servo.note",
      ultrasonic: "bb.ultra.note"
    }[sel.item.type];
    if (noteKey) host.appendChild(el("p", { class: "bb-note-copy", text: t(noteKey) }));

    termsOf(sel).forEach(function (term) {
      var block = el("div", { class: "bb-term" });
      block.appendChild(el("span", { class: "bb-term-name", text: t(term.labelKey) }));
      block.appendChild(el("span", { class: "bb-quiet", text: connectedText(sel, term.id) }));
      var btn = el("button", { type: "button", class: "bb-btn", text: t("bb.insp.connect") });
      btn.setAttribute("data-action", "connect");
      btn.setAttribute("data-term", term.id);
      block.appendChild(btn);
      host.appendChild(block);
    });
    var actions = el("div", { class: "bb-actions" });
    if (sel.kind === "component") {
      var rot = el("button", { type: "button", class: "bb-btn", text: t("bb.insp.rotate") });
      rot.setAttribute("data-action", "rotate");
      actions.appendChild(rot);
    }
    actions.appendChild(deleteButton());
    host.appendChild(actions);
  }

  function deleteButton() {
    var btn = el("button", { type: "button", class: "bb-btn bb-btn-danger", text: t("bb.insp.delete") });
    btn.setAttribute("data-action", "delete");
    return btn;
  }

  function colorSelect(label, prop, values, current, prefix, format) {
    var field = el("div", { class: "bb-field" });
    field.appendChild(el("label", { text: label }));
    var select = el("select", { class: "bb-select" });
    select.setAttribute("data-prop", prop);
    values.forEach(function (value) {
      var opt = el("option", { value: value, text: format ? format(value) : t(prefix + value) });
      if (value === current) opt.setAttribute("selected", "selected");
      select.appendChild(opt);
    });
    field.appendChild(select);
    return field;
  }

  function alertText(alert) {
    var board = state.project.board;
    if (alert.id === "pin-conflict") return t("bb.alert.pinConflict", { pin: alert.pin });
    if (alert.id === "rail-short") return t("bb.alert.railShort");
    if (alert.id === "3v3-5v-short") return t("bb.alert.3v5v");
    if (alert.id === "led-no-resistor") {
      return alert.count > 1 ? t("bb.alert.ledNoRMany", { count: alert.count }) : t("bb.alert.ledNoR");
    }
    if (alert.id === "serial-pins") return t(board === "leonardo" ? "bb.alert.serial.leonardo" : "bb.alert.serial.uno");
    if (alert.id === "pin13-led") return t("bb.alert.pin13");
    if (alert.id === "i2c-occupied") return t(board === "leonardo" ? "bb.alert.i2c.leonardo" : "bb.alert.i2c.uno");
    return "";
  }

  function renderStatus() {
    var i2c = document.getElementById("bb-i2c");
    if (i2c) i2c.textContent = t(state.project.board === "leonardo" ? "bb.board.i2c.leonardo" : "bb.board.i2c.uno");
    var sw = document.getElementById("bb-switch");
    var swText = document.getElementById("bb-switch-text");
    if (sw && swText) {
      if (state.switchNote) {
        sw.hidden = false;
        swText.textContent = t(state.switchNote === "leonardo" ? "bb.board.switched.leonardo" : "bb.board.switched.uno");
      } else sw.hidden = true;
    }
    var note = document.getElementById("bb-note");
    if (note) {
      if (state.note) note.textContent = state.note;
      else if (state.mode === "wire") note.textContent = t("bb.status.wireStart");
      else note.textContent = "";
    }
    fillAlerts(document.getElementById("bb-alerts-danger"), "danger");
    fillAlerts(document.getElementById("bb-alerts-hint"), "hint");
  }

  function fillAlerts(host, level) {
    if (!host) return;
    host.innerHTML = "";
    (state.analysis ? state.analysis.alerts : []).forEach(function (alert) {
      if (alert.level !== level) return;
      var row = el("div", { class: "bb-alert " + (level === "danger" ? "bb-alert-danger" : "bb-alert-hint") });
      row.appendChild(el("span", { class: "bb-alert-icon", text: level === "danger" ? "!" : "i" }));
      row.lastChild.setAttribute("aria-hidden", "true");
      row.appendChild(el("span", { text: alertText(alert) }));
      host.appendChild(row);
    });
  }

  function syncChrome() {
    var uno = document.getElementById("bb-board-uno");
    var leo = document.getElementById("bb-board-leo");
    if (uno) uno.setAttribute("aria-pressed", state.project.board === "uno" ? "true" : "false");
    if (leo) leo.setAttribute("aria-pressed", state.project.board === "leonardo" ? "true" : "false");
    var nameBtn = document.getElementById("bb-name");
    var nameInput = document.getElementById("bb-name-input");
    if (nameBtn && document.activeElement !== nameInput) nameBtn.textContent = displayProjectName();
    if (nameBtn) nameBtn.setAttribute("aria-label", t("bb.project.nameLabel") + " " + displayProjectName());
    var wire = document.getElementById("bb-wire");
    var wiring = state.mode === "wire";
    if (wire) {
      wire.setAttribute("aria-pressed", wiring ? "true" : "false");
      wire.textContent = t(wiring ? "bb.toolbar.wireDone" : "bb.toolbar.wire");
    }
    var cancel = document.getElementById("bb-wire-cancel");
    if (cancel) cancel.hidden = !wiring;
    var selectBtn = document.getElementById("bb-select");
    if (selectBtn) selectBtn.setAttribute("aria-pressed", state.mode === "select" ? "true" : "false");
    var undoBtn = document.getElementById("bb-undo");
    var redoBtn = document.getElementById("bb-redo");
    var undoM = document.getElementById("bb-undo-m");
    var redoM = document.getElementById("bb-redo-m");
    if (undoBtn) undoBtn.disabled = !state.undo.length;
    if (redoBtn) redoBtn.disabled = !state.redo.length;
    if (undoM) undoM.disabled = !state.undo.length;
    if (redoM) redoM.disabled = !state.redo.length;
    var zoomIn = document.getElementById("bb-zoom-in");
    var zoomOut = document.getElementById("bb-zoom-out");
    if (zoomIn) {
      zoomIn.disabled = state.project.view.zoom >= 1.999;
      zoomIn.setAttribute("aria-label", t("bb.toolbar.zoomIn"));
    }
    if (zoomOut) {
      zoomOut.disabled = state.project.view.zoom <= 0.501;
      zoomOut.setAttribute("aria-label", t("bb.toolbar.zoomOut"));
    }
    var fit = document.getElementById("bb-zoom-fit");
    if (fit) fit.setAttribute("aria-label", t("bb.toolbar.fit"));
    var download = document.getElementById("bb-download");
    if (download) download.title = t("bb.intro.privacy");
    var svg = document.getElementById("bb-svg");
    if (svg) svg.setAttribute("aria-label", t("bb.canvas.label"));
    var handle = document.getElementById("bb-sheet-handle");
    if (handle) handle.setAttribute("aria-label", t("bb.common.close"));
    var menu = document.getElementById("bb-menu");
    var menuBtn = document.getElementById("bb-menu-btn");
    if (menu) menu.hidden = !state.menuOpen;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", state.menuOpen ? "true" : "false");
    var sel = currentSelection();
    var bar = document.getElementById("bb-actionbar");
    var sheet = document.getElementById("bb-sheet");
    if (bar) bar.hidden = !(narrow() && sel);
    if (sheet) sheet.hidden = !(narrow() && state.sheetOpen && sel);
    var actConnect = document.getElementById("bb-act-connect");
    var actRotate = document.getElementById("bb-act-rotate");
    if (actConnect) actConnect.hidden = !sel || sel.kind === "wire";
    if (actRotate) actRotate.hidden = !sel || sel.kind !== "component";
    updateSR();
  }

  function updateSR() {
    var sr = document.getElementById("bb-sr");
    if (!sr) return;
    var sel = currentSelection();
    if (!sel) {
      sr.textContent = "";
      return;
    }
    if (sel.kind === "wire") {
      sr.textContent = t("bb.sr.wire", { from: endLabel(sel.item.from), to: endLabel(sel.item.to) });
      return;
    }
    var list = sel.kind === "module" ? state.project.modules : state.project.components;
    var bits = termsOf(sel).map(function (term) {
      return t(term.labelKey) + " " + connectedText(sel, term.id);
    });
    sr.textContent = t("bb.sr.selected", { name: itemLabel(sel.item, list), pins: bits.join(lang() === "en" ? "; " : "；") });
  }

  function render() {
    if (!state.project) return;
    if (!state.analysis) state.analysis = D.analyze(state.project);
    renderScene();
    renderParts();
    renderInspector();
    renderStatus();
    syncChrome();
  }

  function closeMenu() {
    state.menuOpen = false;
    var menu = document.getElementById("bb-menu");
    var menuBtn = document.getElementById("bb-menu-btn");
    if (menu) menu.hidden = true;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }

  function runAction(action) {
    if (action === "board-uno") setBoard("uno");
    else if (action === "board-leo") setBoard("leonardo");
    else if (action === "select") setMode("select");
    else if (action === "wire") {
      if (state.mode === "wire") setMode("select");
      else setMode("wire");
    } else if (action === "wire-cancel") setMode("select");
    else if (action === "new") requestNew();
    else if (action === "open") openProjects();
    else if (action === "save") saveNow();
    else if (action === "download") downloadProject();
    else if (action === "export") requestExport();
    else if (action === "undo") undo();
    else if (action === "redo") redo();
    else if (action === "help") showIntro();
    else if (action === "menu") {
      state.menuOpen = !state.menuOpen;
      syncChrome();
    } else if (action === "zoom-in") {
      var rect = document.getElementById("bb-svg").getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, state.project.view.zoom + 0.1);
    } else if (action === "zoom-out") {
      var rect2 = document.getElementById("bb-svg").getBoundingClientRect();
      zoomAt(rect2.left + rect2.width / 2, rect2.top + rect2.height / 2, state.project.view.zoom - 0.1);
    } else if (action === "fit") fitView();
    else if (action === "connect") openPicker(null);
    else if (action === "rotate") rotateSelected();
    else if (action === "delete") deleteSelection();
    else if (action === "done") {
      state.selected = null;
      state.sheetOpen = false;
      render();
    }
  }

  function saveNow() {
    if (!state.project.id) state.project.id = "p" + Date.now().toString(36);
    var list = loadProjects();
    var existed = false;
    var stored = clone(state.project);
    stored.name = displayProjectName();
    stored.updatedAt = stamp();
    stored.version = 1;
    state.project.updatedAt = stored.updatedAt;
    var next = [];
    list.forEach(function (item) {
      if (item.id === stored.id) {
        existed = true;
        next.push(stored);
      } else next.push(item);
    });
    if (!existed) next.push(stored);
    if (!writeProjects(next)) {
      flash(t("bb.file.quota"));
      return;
    }
    state.savedCanonical = canonical(state.project);
    state.forceDirty = false;
    writeDraft();
    flash(t("bb.status.saved"));
    if (!existed) document.getElementById("bb-save-banner").hidden = false;
  }

  function sanitize(name) {
    return String(name || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().replace(/\s+/g, "-");
  }

  function downloadProject() {
    var data = clone(state.project);
    data.name = displayProjectName();
    data.version = 1;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var url = URL.createObjectURL(blob);
    a.href = url;
    a.download = (sanitize(data.name) || "breadboard-plan") + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function requestNew() {
    var go = function () { adopt(blankProject(), false); };
    if (!isDirty()) go();
    else ask({ text: t("bb.unsaved.open"), okKey: "bb.common.continue", cancelKey: "bb.common.cancel" }).then(function (yes) {
      if (yes) go();
    });
  }

  function openProjects() {
    var list = loadProjects().slice().sort(function (a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
    var card = el("div", { class: "bb-modal-card" });
    card.appendChild(el("h2", { text: t("bb.file.openTitle") }));
    card.appendChild(el("p", { class: "bb-privacy", text: t("bb.intro.privacy") }));
    var fileLabel = el("label", { class: "bb-btn bb-file-label" });
    fileLabel.appendChild(el("span", { text: t("bb.file.openFromFile") }));
    var input = el("input", { type: "file", class: "bb-file-input", accept: ".json,application/json" });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      readProjectFile(file);
    });
    fileLabel.appendChild(input);
    var actions = el("div", { class: "bb-modal-actions" });
    actions.appendChild(fileLabel);
    card.appendChild(actions);
    if (!list.length) card.appendChild(el("p", { text: t("bb.file.empty") }));
    list.forEach(function (project) {
      var row = el("div", { class: "bb-project-row" });
      var open = el("button", { type: "button", class: "bb-project-open" });
      var boardName = t(project.board === "leonardo" ? "bb.board.leonardo" : "bb.board.uno");
      open.appendChild(el("strong", { text: project.name || t("bb.project.untitled") }));
      open.appendChild(el("span", { text: boardName + " · " + formatTime(project.updatedAt) }));
      open.addEventListener("click", function () { confirmLoad(clone(project), false); });
      var del = el("button", { type: "button", class: "bb-btn bb-btn-danger", text: t("bb.file.delete") });
      del.addEventListener("click", function () { confirmDeleteProject(project.id); });
      row.appendChild(open);
      row.appendChild(del);
      card.appendChild(row);
    });
    var close = el("button", { type: "button", class: "bb-btn", text: t("bb.common.close") });
    close.addEventListener("click", closeModal);
    var footer = el("div", { class: "bb-modal-actions" });
    footer.appendChild(close);
    card.appendChild(footer);
    showModal(card, { onCancel: closeModal, label: t("bb.file.openTitle") });
  }

  function formatTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try { return d.toLocaleString(lang() === "en" ? "en-GB" : "zh-Hant"); }
    catch (e) { return ""; }
  }

  function confirmLoad(project, fromFile) {
    var go = function () {
      closeModal();
      project.name = normalizeName(project.name);
      if (fromFile && !project.id) project.id = "p" + Date.now().toString(36);
      adopt(project, fromFile);
    };
    if (!isDirty()) go();
    else ask({ text: t("bb.unsaved.open"), okKey: "bb.common.continue", cancelKey: "bb.common.cancel" }).then(function (yes) {
      if (yes) go();
      else if (!fromFile) openProjects();
    });
  }

  function confirmDeleteProject(id) {
    ask({
      text: t("bb.file.deleteConfirm"),
      okKey: "bb.file.delete",
      cancelKey: "bb.common.cancel",
      danger: true
    }).then(function (yes) {
      if (!yes) {
        openProjects();
        return;
      }
      var list = loadProjects().filter(function (p) { return p.id !== id; });
      if (!writeProjects(list)) {
        inform(t("bb.file.quota"));
        return;
      }
      if (state.project.id === id) state.forceDirty = true;
      openProjects();
    });
  }

  function readProjectFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); }
      catch (e) { inform(t("bb.file.bad")); return; }
      var v = D.validateProject(data);
      if (!v.ok) { inform(t("bb.file.bad")); return; }
      if (data.id && typeof data.id === "string") v.project.id = data.id;
      confirmLoad(v.project, true);
    };
    reader.onerror = function () { inform(t("bb.file.bad")); };
    reader.readAsText(file);
  }

  function hasSevere() {
    return (state.analysis.alerts || []).some(function (a) { return a.level === "danger"; });
  }

  function requestExport() {
    var go = function () { exportPng(); };
    if (!hasSevere()) go();
    else ask({
      text: t("bb.export.confirmConflict"),
      okKey: "bb.export.confirm",
      cancelKey: "bb.export.cancel"
    }).then(function (yes) { if (yes) go(); });
  }

  function exportPng() {
    buildPng().then(function (png) {
      var url = URL.createObjectURL(png);
      var card = el("div", { class: "bb-modal-card" });
      card.appendChild(el("h2", { text: t("bb.export.preview") }));
      var img = el("img", { class: "bb-preview-img", alt: t("bb.export.preview") });
      img.src = url;
      card.appendChild(img);
      var actions = el("div", { class: "bb-modal-actions" });
      var link = el("a", { class: "bb-btn bb-btn-primary", text: t("bb.export.download") });
      link.href = url;
      var base = sanitize(displayProjectName());
      link.setAttribute("download", base ? base + "-breadboard.png" : "breadboard-plan.png");
      var close = el("button", { type: "button", class: "bb-btn", text: t("bb.common.close") });
      close.addEventListener("click", function () {
        URL.revokeObjectURL(url);
        closeModal();
      });
      actions.appendChild(link);
      actions.appendChild(close);
      card.appendChild(actions);
      showModal(card, {
        label: t("bb.export.preview"),
        onCancel: function () { URL.revokeObjectURL(url); closeModal(); }
      });
    }).catch(function () { inform(t("bb.export.fail")); });
  }

  function buildPng() {
    return new Promise(function (resolve, reject) {
      var header = 48;
      var footer = 42;
      var expW = SCENE_W;
      var expH = SCENE_H + header + footer;
      var svg = s("svg", { width: String(expW), height: String(expH), viewBox: "0 0 " + expW + " " + expH });
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      s("rect", { width: expW, height: expH, fill: "#FFFFFF" }, svg);
      var title = displayProjectName() + "  ·  " + t(state.project.board === "leonardo" ? "bb.board.leonardo" : "bb.board.uno");
      svgText(svg, 18, 28, title, { anchor: "start", size: 18, weight: 700 });
      var g = s("g", { transform: "translate(0 " + header + ")" }, svg);
      drawScene(g, true);
      svgText(svg, expW / 2, expH - 16, t("bb.export.caption"), { size: 13 });
      var xml = new XMLSerializer().serializeToString(svg);
      if (xml.indexOf("xmlns=") === -1) xml = xml.replace("<svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"");
      var blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        try {
          var scale = 2;
          if (Math.max(expW, expH) * scale < 1600) scale = 1600 / Math.max(expW, expH);
          var cw = Math.round(expW * scale);
          var ch = Math.round(expH * scale);
          if (cw > 8000 || ch > 8000 || !cw || !ch) throw new Error("size");
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          canvas.toBlob(function (png) {
            URL.revokeObjectURL(url);
            if (!png) reject(new Error("png"));
            else resolve(png);
          }, "image/png");
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("image"));
      };
      img.src = url;
    });
  }

  function openPicker(termId) {
    var sel = currentSelection();
    if (!sel || sel.kind === "wire") return;
    var terms = termsOf(sel);
    if (!terms.length) return;
    state.sheetOpen = true;
    syncChrome();
    if (!termId) {
      showLegPicker(sel, terms);
      return;
    }
    var term = null;
    for (var i = 0; i < terms.length; i++) if (terms[i].id === termId) term = terms[i];
    if (term) showPinPicker(sel, term);
  }

  function showLegPicker(sel, terms) {
    var card = el("div", { class: "bb-modal-card" });
    card.appendChild(el("h2", { text: t("bb.insp.pickLeg") }));
    var list = el("div", { class: "bb-picker-list" });
    terms.forEach(function (term) {
      var btn = el("button", { type: "button", class: "bb-btn", text: t(term.labelKey) + " · " + connectedText(sel, term.id) });
      btn.addEventListener("click", function () { showPinPicker(sel, term); });
      list.appendChild(btn);
    });
    card.appendChild(list);
    var close = el("button", { type: "button", class: "bb-btn", text: t("bb.common.cancel") });
    close.addEventListener("click", closeModal);
    var actions = el("div", { class: "bb-modal-actions" });
    actions.appendChild(close);
    card.appendChild(actions);
    showModal(card, { onCancel: closeModal, label: t("bb.insp.pickLeg") });
  }

  function showPinPicker(sel, term) {
    var card = el("div", { class: "bb-modal-card" });
    card.appendChild(el("h2", { text: t("bb.insp.pickPin") }));
    card.appendChild(el("p", { class: "bb-quiet", text: t(term.labelKey) }));
    var list = el("div", { class: "bb-picker-list" });
    function group(title, refs) {
      list.appendChild(el("h3", { text: title }));
      refs.forEach(function (ref) {
        var label = ref === "3V3" ? "3.3V" : ref === "GND" ? "GND" : ref;
        var btn = el("button", { type: "button", class: "bb-btn", text: label });
        btn.addEventListener("click", function () {
          closeModal();
          connectTerminal(sel, term, ref);
        });
        list.appendChild(btn);
      });
    }
    var digital = [];
    for (var d = 0; d <= 13; d++) digital.push("D" + d);
    var analog = [];
    for (var a = 0; a <= 5; a++) analog.push("A" + a);
    group(t("bb.insp.group.digital"), digital);
    group(t("bb.insp.group.analog"), analog);
    group(t("bb.insp.group.power"), ["5V", "3V3", "GND"]);
    card.appendChild(list);
    var close = el("button", { type: "button", class: "bb-btn", text: t("bb.common.cancel") });
    close.setAttribute("data-primary", "1");
    close.addEventListener("click", closeModal);
    var actions = el("div", { class: "bb-modal-actions" });
    actions.appendChild(close);
    card.appendChild(actions);
    showModal(card, { onCancel: closeModal, label: t("bb.insp.pickPin") });
  }

  function closeModal() {
    var root = document.getElementById("bb-modals");
    if (root) root.innerHTML = "";
    state.modalOpen = false;
    if (state.modalReturn && state.modalReturn.focus) {
      try { state.modalReturn.focus(); } catch (e) { /* ignore */ }
    }
    state.modalReturn = null;
  }

  function showModal(card, opts) {
    closeModal();
    var root = document.getElementById("bb-modals");
    var overlay = el("div", { class: "bb-modal", role: "dialog", "aria-modal": "true" });
    if (opts && opts.label) overlay.setAttribute("aria-label", opts.label);
    overlay.appendChild(card);
    root.appendChild(overlay);
    state.modalOpen = true;
    state.modalReturn = document.activeElement;
    var primary = card.querySelector("[data-primary], button, a");
    if (primary && primary.focus) primary.focus();
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (opts && opts.onCancel) opts.onCancel();
        else closeModal();
      } else if (e.key === "Enter" && e.target && e.target.tagName !== "BUTTON" && e.target.tagName !== "A") {
        var p = card.querySelector("[data-primary]");
        if (p) { e.preventDefault(); p.click(); }
      } else if (e.key === "Tab") trapFocus(card, e);
    });
  }

  function ask(opts) {
    return new Promise(function (resolve) {
      var card = el("div", { class: "bb-modal-card" });
      card.appendChild(el("p", { text: opts.text }));
      var actions = el("div", { class: "bb-modal-actions" });
      var ok = el("button", {
        type: "button",
        class: "bb-btn " + (opts.danger ? "bb-btn-danger" : "bb-btn-primary"),
        text: t(opts.okKey)
      });
      ok.setAttribute("data-primary", "1");
      var cancel = el("button", { type: "button", class: "bb-btn", text: t(opts.cancelKey) });
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        closeModal();
        resolve(value);
      }
      ok.addEventListener("click", function () { finish(true); });
      cancel.addEventListener("click", function () { finish(false); });
      actions.appendChild(ok);
      actions.appendChild(cancel);
      card.appendChild(actions);
      showModal(card, { onCancel: function () { finish(false); } });
    });
  }

  function inform(text) {
    var card = el("div", { class: "bb-modal-card" });
    card.appendChild(el("p", { text: text }));
    var actions = el("div", { class: "bb-modal-actions" });
    var ok = el("button", { type: "button", class: "bb-btn bb-btn-primary", text: t("bb.common.ok") });
    ok.setAttribute("data-primary", "1");
    ok.addEventListener("click", closeModal);
    actions.appendChild(ok);
    card.appendChild(actions);
    showModal(card, { onCancel: closeModal });
  }

  function trapFocus(container, e) {
    var nodes = container.querySelectorAll("button, a[href], input, select, textarea");
    var list = [];
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].disabled) list.push(nodes[i]);
    }
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function introOpen() {
    var intro = document.getElementById("bb-intro");
    return intro && !intro.hidden;
  }

  function showIntro() {
    var openBtn = document.getElementById("bb-intro-open");
    if (openBtn) openBtn.hidden = loadProjects().length === 0;
    var intro = document.getElementById("bb-intro");
    intro.hidden = false;
    var start = document.getElementById("bb-intro-start");
    if (start) start.focus();
  }

  function dismissIntro() {
    try { localStorage.setItem(K_INTRO, "1"); } catch (e) { /* ignore */ }
    document.getElementById("bb-intro").hidden = true;
    var svg = document.getElementById("bb-svg");
    if (svg) svg.focus();
  }

  function hitFromEvent(e) {
    var node = e.target && e.target.closest ? e.target.closest("[data-hit]") : null;
    var svg = document.getElementById("bb-svg");
    if (!node || !svg || !svg.contains(node)) return null;
    return {
      hit: node.getAttribute("data-hit"),
      id: node.getAttribute("data-id"),
      kind: node.getAttribute("data-kind"),
      ref: node.getAttribute("data-ref"),
      slot: node.getAttribute("data-slot")
    };
  }

  function endpointFromHit(hit) {
    if (!hit) return null;
    if (hit.hit === "hole" || hit.hit === "rail" || hit.hit === "pin") return { kind: hit.kind, ref: hit.ref };
    if (hit.hit === "modpin") return { kind: "module", ref: hit.ref };
    return null;
  }

  function selectHit(hit) {
    if (!hit) return;
    if (hit.hit === "comp") state.selected = { kind: "component", id: hit.id };
    else if (hit.hit === "mod") state.selected = { kind: "module", id: hit.id };
    else if (hit.hit === "modpin") state.selected = { kind: "module", id: hit.ref.split(":")[0] };
    else if (hit.hit === "wire") state.selected = { kind: "wire", id: hit.id };
    else state.selected = null;
    state.sheetOpen = !!(narrow() && state.selected);
  }

  function pickEndpoint(x, y) {
    var best = null;
    var bestD = Infinity;
    function consider(d, end, limit) {
      if (d <= limit && d < bestD) {
        bestD = d;
        best = end;
      }
    }
    var row;
    var c;
    for (row = 0; row < D.ROWS.length; row++) {
      for (c = 1; c <= D.COLS; c++) {
        var ref = D.ROWS[row] + c;
        var p = holePoint(ref);
        consider(Math.hypot(p.x - x, p.y - y), { kind: "hole", ref: ref }, 14);
      }
    }
    ["+top", "-top", "+bottom", "-bottom"].forEach(function (which) {
      var sign = which.charAt(0);
      var side = which.indexOf("top") !== -1 ? "top" : "bottom";
      for (var n = 1; n <= D.COLS; n++) {
        var rp = { x: colX(n), y: railY(which) };
        consider(Math.hypot(rp.x - x, rp.y - y), { kind: "rail", ref: "rail:" + sign + ":" + side + ":" + n }, 14);
      }
    });
    var pins = pinMap();
    Object.keys(pins).forEach(function (ref) {
      var pp = pins[ref];
      consider(Math.hypot(pp.x - x, pp.y - y), { kind: "pin", ref: ref }, 28);
    });
    state.project.modules.forEach(function (mod) {
      (D.moduleTerminals(mod.type) || []).forEach(function (term) {
        var mp = modulePinPoint(mod, term.id);
        consider(Math.hypot(mp.x - x, mp.y - y), { kind: "module", ref: mod.id + ":" + term.id }, 24);
      });
    });
    return best;
  }

  function nearestHole(x, y) {
    var best = null;
    var bestD = 16;
    D.ROWS.forEach(function (row) {
      for (var c = 1; c <= D.COLS; c++) {
        var p = holePoint(row + c);
        var d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) {
          bestD = d;
          best = row + c;
        }
      }
    });
    return best;
  }

  function updateGhost(clientX, clientY) {
    var g = document.getElementById("bb-ghost");
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    if (state.mode !== "place" || !state.placeType) return;
    var pt = clientToScene(clientX, clientY);
    var part = D.partById(state.placeType);
    if (!part) return;
    if (part.place === "module") {
      var slot = null;
      var best = 80;
      for (var i = 0; i < D.MAX_SLOTS; i++) {
        var box = slotBox(i);
        var cx = box.x + box.w / 2;
        var cy = box.y + box.h / 2;
        var dist = Math.hypot(pt.x - cx, pt.y - cy);
        if (dist < best) { best = dist; slot = i; }
      }
      var legal = slot != null && state.legal["slot:" + slot];
      g.setAttribute("opacity", legal ? "0.9" : "0.45");
      if (legal) {
        drawModule(g, {
          id: "ghost",
          type: state.placeType,
          slot: slot,
          props: {},
          name: t("bb.parts." + state.placeType)
        }, true);
      }
      return;
    }
    var anchor = nearestHole(pt.x, pt.y);
    var ok = anchor && state.legal[anchor];
    g.setAttribute("opacity", ok ? "0.92" : "0.45");
    if (ok) {
      drawComponentGraphic(g, {
        id: "ghost",
        type: state.placeType,
        anchor: anchor,
        rotation: 0,
        props: D.defaultProps(state.placeType),
        name: ""
      });
    } else {
      s("circle", { cx: pt.x, cy: pt.y, r: 8, fill: "#0D9488" }, g);
    }
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    var svg = document.getElementById("bb-svg");
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    state.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(state.pointers);
    if (ids.length >= 2) {
      if (state.gesture && state.gesture.timer) clearTimeout(state.gesture.timer);
      state.gesture = { type: "pinch", pid: e.pointerId };
      return;
    }
    var hit = hitFromEvent(e);
    state.gesture = {
      type: "pending",
      pid: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      hit: hit,
      moved: false,
      accX: 0,
      accY: 0
    };
    if (hit && hit.hit === "comp" && state.mode === "select") state.gesture.dragId = hit.id;
    state.gesture.timer = setTimeout(function () {
      if (!state.gesture || state.gesture.moved) return;
      if (state.gesture.hit && (state.gesture.hit.hit === "comp" || state.gesture.hit.hit === "mod" || state.gesture.hit.hit === "wire" || state.gesture.hit.hit === "modpin")) {
        selectHit(state.gesture.hit);
        renderInspector();
        renderStatus();
        syncChrome();
      }
    }, 500);
  }

  function onPointerMove(e) {
    if (!state.pointers[e.pointerId] && state.mode === "place") {
      updateGhost(e.clientX, e.clientY);
      return;
    }
    if (!state.pointers[e.pointerId]) return;
    state.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(state.pointers).length >= 2) {
      pinchMove();
      return;
    }
    var g = state.gesture;
    if (!g || g.pid !== e.pointerId) {
      if (state.mode === "place") updateGhost(e.clientX, e.clientY);
      return;
    }
    var dx = e.clientX - g.x;
    var dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) > 8) {
      g.moved = true;
      clearTimeout(g.timer);
    }
    if (state.mode === "place") {
      updateGhost(e.clientX, e.clientY);
      if (g.moved) panBy(e.clientX - g.lastX, e.clientY - g.lastY);
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      return;
    }
    if (g.dragId && g.moved && state.mode === "select") {
      var delta = clientDelta(e.clientX - g.lastX, e.clientY - g.lastY);
      g.accX += delta.x / state.project.view.zoom;
      g.accY += delta.y / state.project.view.zoom;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      var node = document.getElementById("bb-comp-" + g.dragId);
      if (node) node.setAttribute("transform", "translate(" + g.accX + " " + g.accY + ")");
      return;
    }
    if (g.moved) {
      panBy(e.clientX - g.lastX, e.clientY - g.lastY);
      g.lastX = e.clientX;
      g.lastY = e.clientY;
    }
  }

  function clientDelta(dx, dy) {
    var a = clientToSvg(0, 0);
    var b = clientToSvg(dx, dy);
    return { x: b.x - a.x, y: b.y - a.y };
  }

  function panBy(dx, dy) {
    var d = clientDelta(dx, dy);
    state.project.view.panX += d.x;
    state.project.view.panY += d.y;
    applyView();
  }

  function pinchMove() {
    var ids = Object.keys(state.pointers);
    if (ids.length < 2) return;
    var a = state.pointers[ids[0]];
    var b = state.pointers[ids[1]];
    var dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    var mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    var g = state.gesture || {};
    if (!g.pinch) {
      g.pinch = { dist: dist, zoom: state.project.view.zoom, scene: clientToScene(mid.x, mid.y) };
      state.gesture = g;
      return;
    }
    var z = clamp(g.pinch.zoom * (dist / g.pinch.dist), 0.5, 2);
    var parent = clientToSvg(mid.x, mid.y);
    state.project.view.zoom = z;
    state.project.view.panX = parent.x - g.pinch.scene.x * z;
    state.project.view.panY = parent.y - g.pinch.scene.y * z;
    applyView();
    syncChrome();
  }

  function onPointerUp(e) {
    var g = state.gesture;
    delete state.pointers[e.pointerId];
    if (g && g.timer) clearTimeout(g.timer);
    if (Object.keys(state.pointers).length) return;
    state.gesture = null;
    if (!g || g.type === "pinch" || g.pinch) {
      scheduleDraft();
      return;
    }
    if (g.dragId && g.moved) {
      var comp = findById(state.project.components, g.dragId);
      if (comp) tryMove(comp, Math.round(g.accX / P), Math.round(g.accY / P));
      else render();
      return;
    }
    if (g.moved) {
      scheduleDraft();
      return;
    }
    var hit = g.hit;
    var scenePt = clientToScene(e.clientX, e.clientY);
    if (state.mode === "place") {
      var part = D.partById(state.placeType);
      if (part && part.place === "module") {
        var slotHit = hit && hit.hit === "slot" ? parseInt(hit.slot, 10) : null;
        if (slotHit == null || !state.legal["slot:" + slotHit]) {
          var bestSlot = null;
          var bestSlotD = 70;
          for (var si = 0; si < D.MAX_SLOTS; si++) {
            var box = slotBox(si);
            var dist = Math.hypot(scenePt.x - (box.x + box.w / 2), scenePt.y - (box.y + box.h / 2));
            if (dist < bestSlotD) { bestSlotD = dist; bestSlot = si; }
          }
          slotHit = bestSlot;
        }
        if (slotHit != null && state.legal["slot:" + slotHit]) {
          placeModule(state.placeType, slotHit);
          return;
        }
        if (!hit || hit.hit === "bg") setMode("select");
        return;
      }
      var anchor = hit && hit.hit === "hole" && state.legal[hit.ref] ? hit.ref : nearestHole(scenePt.x, scenePt.y);
      if (anchor && state.legal[anchor]) {
        placeComponent(state.placeType, anchor);
        return;
      }
      if (!hit || hit.hit === "bg") setMode("select");
      return;
    }
    if (state.mode === "wire") {
      var end = pickEndpoint(scenePt.x, scenePt.y) || endpointFromHit(hit);
      if (!end) return;
      if (!state.wireStart) {
        state.wireStart = end;
        render();
        return;
      }
      addWire(state.wireStart, end);
      return;
    }
    selectHit(hit);
    render();
  }

  function onInspectorClick(e) {
    var btn = e.target.closest ? e.target.closest("[data-action]") : null;
    if (!btn) return;
    var action = btn.getAttribute("data-action");
    if (action === "connect") openPicker(btn.getAttribute("data-term"));
    else if (action === "rotate") rotateSelected();
    else if (action === "delete") deleteSelection();
  }

  function onInspectorChange(e) {
    var prop = e.target.getAttribute("data-prop");
    if (!prop) return;
    var sel = currentSelection();
    if (!sel) return;
    var value = e.target.value;
    commit(function () {
      if (prop === "wire-color" && sel.kind === "wire") sel.item.color = value;
      if (prop === "color") {
        sel.item.props = sel.item.props || {};
        sel.item.props.color = value;
      }
      if (prop === "value") {
        sel.item.props = sel.item.props || {};
        sel.item.props.value = value;
      }
    });
  }

  function boot() {
    var draft = readDraft();
    var savedList = loadProjects();
    var saved = null;
    if (draft && draft.id) {
      for (var i = 0; i < savedList.length; i++) if (savedList[i].id === draft.id) saved = savedList[i];
    }
    if (draft && saved && canonical(draft) !== canonical(saved)) {
      state.project = clone(saved);
      state.savedCanonical = canonical(state.project);
      state.pendingDraft = draft;
      state.holdDraft = true;
      document.getElementById("bb-draft").hidden = false;
    } else if (draft) {
      state.project = draft;
      if (saved) state.savedCanonical = canonical(saved);
      else state.savedCanonical = canonical(blankProject());
      state.forceDirty = canonical(state.project) !== state.savedCanonical;
    } else {
      state.project = blankProject();
      state.savedCanonical = canonical(state.project);
      state.project.view.panX = 16;
      state.project.view.panY = 12;
    }
    state.analysis = D.analyze(state.project);
    render();
    var dismissed = false;
    try { dismissed = localStorage.getItem(K_INTRO) === "1"; } catch (e) { dismissed = true; }
    if (!dismissed) showIntro();
  }

  function init() {
    document.getElementById("bb-app").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-bb-action]") : null;
      if (!btn) return;
      var action = btn.getAttribute("data-bb-action");
      if (action !== "menu") closeMenu();
      runAction(action);
    });
    document.addEventListener("click", function (e) {
      var wrap = document.querySelector(".bb-menu-wrap");
      if (state.menuOpen && wrap && !wrap.contains(e.target)) closeMenu();
    });
    document.getElementById("bb-parts").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-part]") : null;
      if (!btn) return;
      beginPlace(btn.getAttribute("data-part"));
    });
    ["bb-inspector", "bb-sheet-body"].forEach(function (id) {
      var node = document.getElementById(id);
      node.addEventListener("click", onInspectorClick);
      node.addEventListener("change", onInspectorChange);
    });
    var svg = document.getElementById("bb-svg");
    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", onPointerUp);
    svg.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    svg.addEventListener("wheel", function (e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(e.clientX, e.clientY, state.project.view.zoom * factor);
    }, { passive: false });

    document.getElementById("bb-name").addEventListener("click", function () {
      var input = document.getElementById("bb-name-input");
      document.getElementById("bb-name").hidden = true;
      input.hidden = false;
      input.value = state.project.name || "";
      state.nameSnap = JSON.stringify(state.project);
      input.focus();
      input.select();
    });
    document.getElementById("bb-name-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") e.currentTarget.blur();
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (state.nameSnap) state.project = JSON.parse(state.nameSnap);
        state.nameSnap = null;
        e.currentTarget.blur();
      }
    });
    document.getElementById("bb-name-input").addEventListener("blur", function (e) {
      var input = e.currentTarget;
      state.project.name = normalizeName(input.value);
      input.hidden = true;
      document.getElementById("bb-name").hidden = false;
      if (state.nameSnap && state.nameSnap !== JSON.stringify(state.project)) {
        state.undo.push(state.nameSnap);
        state.redo = [];
        state.nameSnap = null;
        changed();
      } else {
        state.nameSnap = null;
        syncChrome();
      }
    });

    document.getElementById("bb-intro-start").addEventListener("click", dismissIntro);
    document.getElementById("bb-intro-open").addEventListener("click", function () {
      dismissIntro();
      openProjects();
    });
    document.getElementById("bb-switch-close").addEventListener("click", function () {
      state.switchNote = "";
      renderStatus();
    });
    document.getElementById("bb-save-dismiss").addEventListener("click", function () {
      document.getElementById("bb-save-banner").hidden = true;
    });
    document.getElementById("bb-draft-restore").addEventListener("click", function () {
      if (!state.pendingDraft) return;
      var draft = state.pendingDraft;
      state.pendingDraft = null;
      state.holdDraft = false;
      adopt(draft, true);
    });
    document.getElementById("bb-draft-discard").addEventListener("click", function () {
      state.pendingDraft = null;
      state.holdDraft = false;
      document.getElementById("bb-draft").hidden = true;
      try { localStorage.removeItem(K_DRAFT); } catch (e) { /* ignore */ }
      scheduleDraft();
    });

    var sheetDrag = null;
    var handle = document.getElementById("bb-sheet-handle");
    handle.addEventListener("pointerdown", function (e) {
      sheetDrag = e.clientY;
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    handle.addEventListener("pointerup", function (e) {
      if (sheetDrag != null && e.clientY - sheetDrag > 36) {
        state.sheetOpen = false;
        syncChrome();
      }
      sheetDrag = null;
    });

    document.addEventListener("keydown", function (e) {
      if (introOpen()) {
        if (e.key === "Escape") {
          e.preventDefault();
          dismissIntro();
        } else if (e.key === "Enter" && e.target && e.target.id !== "bb-intro-open") {
          e.preventDefault();
          dismissIntro();
        } else if (e.key === "Tab") {
          trapFocus(document.querySelector("#bb-intro .bb-modal-card"), e);
        }
        return;
      }
      if (state.modalOpen) return;
      var tag = e.target && e.target.tagName;
      var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.key === "z" || e.key === "Z" || e.key === "y" || e.key === "Y") && (e.ctrlKey || e.metaKey)) {
        if (typing) return;
        e.preventDefault();
        if (e.key === "y" || e.key === "Y" || e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === "Escape") {
        if (state.menuOpen) { closeMenu(); return; }
        if (state.mode === "place") { setMode("select"); return; }
        if (state.wireStart) { state.wireStart = null; render(); return; }
        if (state.mode === "wire") { setMode("select"); return; }
        if (state.sheetOpen) { state.sheetOpen = false; syncChrome(); }
        return;
      }
      if (typing) return;
      if ((e.key === "Delete" || e.key === "Backspace") && state.selected) {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-1, 0); }
      else if (e.key === "ArrowRight") { e.preventDefault(); nudge(1, 0); }
      else if (e.key === "ArrowUp") { e.preventDefault(); nudge(0, -1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); nudge(0, 1); }
    });

    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || a.hasAttribute("download") || a.target === "_blank") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      var url;
      try { url = new URL(a.getAttribute("href"), location.href); } catch (err) { return; }
      if (url.origin !== location.origin || !isDirty()) return;
      e.preventDefault();
      ask({
        text: t("bb.unsaved.leave"),
        okKey: "bb.common.continue",
        cancelKey: "bb.common.cancel"
      }).then(function (yes) {
        if (!yes) return;
        state.allowLeave = true;
        location.href = a.href;
      });
    }, true);

    window.addEventListener("beforeunload", function (e) {
      if (state.allowLeave || !isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    });

    document.addEventListener("langchange", function () {
      if (!state.project) return;
      state.project.name = normalizeName(state.project.name);
      render();
    });

    window.addEventListener("resize", function () {
      if (narrow() && state.selected) state.sheetOpen = true;
      syncChrome();
    });

    boot();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
