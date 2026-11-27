/**
 * Solid Nets — classroom page for comparing a solid with its net.
 * Original WebGL view; if WebGL is missing, a static isometric stands in.
 */
(function () {
  "use strict";

  var D = window.SolidNetsData;
  var PREF_KEY = "teacher-li-sn-prefs";
  var INTRO_KEY = "teacher-li-sn-intro-dismissed";
  var ATTR = "李順華老師資源分享網 · 立體展開圖";
  var NAVY = "#0D1B2A";

  var state = {
    id: "cube",
    params: null,
    netIndex: 0,
    unfold: 0,
    labels: true,
    tabs: true,
    mono: false,
    printLabels: true,
    rot: 0,
    flip: false,
    yaw: -0.65,
    pitch: 0.55,
    dist: 16,
    notice: "",
    webgl: false,
  };

  var model = null;
  var nets = [];
  var gl = null;
  var glProg = null;
  var animToken = 0;
  var clipSeq = 0;
  var pointers = new Map();
  var pinchDist = 0;
  var focusReturn = null;

  function $(id) { return document.getElementById(id); }
  function t(key) {
    var api = window.TeacherLiI18n;
    return (api && api.t(key)) || key;
  }
  function tf(key, vars) {
    var s = t(key);
    Object.keys(vars).forEach(function (k) {
      s = s.split("{" + k + "}").join(String(vars[k]));
    });
    return s;
  }
  function fmt(n) {
    var v = Math.round(Number(n) * 10) / 10;
    return String(v);
  }
  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function currentNet() {
    return nets[state.netIndex] || null;
  }
  function solidDef() {
    for (var i = 0; i < D.SOLIDS.length; i++) if (D.SOLIDS[i].id === state.id) return D.SOLIDS[i];
    return D.SOLIDS[0];
  }

  function readPrefs() {
    try {
      var raw = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
      if (!raw || typeof raw !== "object") return null;
      return raw;
    } catch (e) {
      return null;
    }
  }
  function savePrefs() {
    var net = currentNet();
    var data = {
      v: 1,
      solidId: state.id,
      net: state.netIndex,
      treeKey: net && net.treeKey,
      edgeIdxs: net && net.edgeIdxs ? net.edgeIdxs.slice() : null,
      unfold: state.unfold,
      params: state.params,
      labels: state.labels,
      tabs: state.tabs,
      mono: state.mono,
    };
    try { localStorage.setItem(PREF_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function rebuild() {
    model = D.build(state.id, state.params);
    nets = model ? D.netsFor(model) : [];
    if (!nets.length) nets = [];
    if (state.netIndex >= nets.length) state.netIndex = 0;
    if (state.netIndex < 0) state.netIndex = 0;
  }

  function boot() {
    var hash = decodeURIComponent((location.hash || "").replace(/^#/, "")).toLowerCase();
    var known = D.SOLIDS.some(function (s) { return s.id === hash; });
    var prefs = readPrefs();
    state.labels = !prefs || prefs.labels !== false;
    state.tabs = !prefs || prefs.tabs !== false;
    state.mono = !!(prefs && prefs.mono);
    state.printLabels = state.labels;
    if (known) {
      state.id = hash;
      state.params = D.defaultParams(hash);
      state.netIndex = 0;
      state.unfold = 0;
      rebuild();
    } else if (prefs && D.SOLIDS.some(function (s) { return s.id === prefs.solidId; })) {
      state.id = prefs.solidId;
      var checked = D.clampParams(state.id, prefs.params || {}, D.defaultParams(state.id));
      state.params = checked.invalid ? D.defaultParams(state.id) : checked.params;
      state.unfold = Math.max(0, Math.min(1, Number(prefs.unfold) || 0));
      rebuild();
      var idx = -1;
      if (prefs.edgeIdxs && model && model.kind === "poly") idx = D.locateNet(model, nets, prefs.edgeIdxs);
      if (idx < 0 && prefs.treeKey) idx = D.findNetIndex(nets, prefs.treeKey);
      if (idx < 0 && isFinite(prefs.net)) idx = prefs.net;
      state.netIndex = idx >= 0 && idx < nets.length ? idx : 0;
    } else {
      state.id = "cube";
      state.params = D.defaultParams("cube");
      state.netIndex = 0;
      state.unfold = 0;
      rebuild();
    }
    if (localStorage.getItem(INTRO_KEY) !== "1") $("sn-intro").hidden = false;
    buildSolidButtons();
    initGL();
    bind();
    resetCamera(false);
    renderSizeFields();
    syncControls();
    drawAll();
    updateStatus();
    updateA4();
  }

  function buildSolidButtons() {
    var bar = $("sn-solids");
    var icons = D.icons();
    bar.innerHTML = "";
    bar.setAttribute("aria-label", t("sn.aria.picker"));
    D.SOLIDS.forEach(function (s) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sn-solid-btn";
      btn.dataset.solid = s.id;
      var ico = document.createElement("span");
      ico.innerHTML = icons[s.id] || "";
      var name = document.createElement("span");
      name.dataset.i18n = "sn.solid." + s.id;
      name.textContent = t("sn.solid." + s.id);
      btn.appendChild(ico);
      btn.appendChild(name);
      btn.addEventListener("click", function () { selectSolid(s.id, true); });
      bar.appendChild(btn);
    });
  }

  function selectSolid(id, fromUser) {
    animToken++;
    state.id = id;
    state.params = D.defaultParams(id);
    state.unfold = 0;
    state.netIndex = 0;
    state.rot = 0;
    state.flip = false;
    state.notice = "";
    rebuild();
    resetCamera(false);
    renderSizeFields();
    syncControls();
    drawAll();
    updateStatus();
    updateA4();
    savePrefs();
    if (fromUser && location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function bind() {
    $("sn-intro-dismiss").addEventListener("click", function () {
      localStorage.setItem(INTRO_KEY, "1");
      $("sn-intro").hidden = true;
    });
    $("sn-unfold").addEventListener("click", function () { animateUnfold(1, fullDuration(1)); });
    $("sn-fold").addEventListener("click", function () { animateUnfold(0, fullDuration(0)); });
    $("sn-fold-slider").addEventListener("input", function () {
      animToken++;
      state.unfold = Number($("sn-fold-slider").value) / 100;
      syncFoldPressed();
      drawSolid();
    });
    $("sn-fold-slider").addEventListener("change", savePrefs);
    $("sn-net-prev").addEventListener("click", function () { stepNet(-1); });
    $("sn-net-next").addEventListener("click", function () { stepNet(1); });
    $("sn-net-label").addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowLeft") { ev.preventDefault(); stepNet(-1); }
      if (ev.key === "ArrowRight") { ev.preventDefault(); stepNet(1); }
    });
    $("sn-net-all").addEventListener("click", openChooser);
    $("sn-chooser-close").addEventListener("click", closeChooser);
    $("sn-reset-view").addEventListener("click", function () { resetCamera(true); });
    $("sn-reset-view-m").addEventListener("click", function () { resetCamera(true); setMenu(false); });
    $("sn-labels").addEventListener("click", toggleLabels);
    $("sn-labels-m").addEventListener("click", function () { toggleLabels(); setMenu(false); });
    $("sn-size-btn").addEventListener("click", function () { toggleSize(); });
    $("sn-size-m").addEventListener("click", function () { setMenu(false); toggleSize(true); });
    $("sn-size-close").addEventListener("click", function () { toggleSize(false); });
    $("sn-size-reset").addEventListener("click", restoreSize);
    $("sn-print-btn").addEventListener("click", openPrint);
    $("sn-print-m").addEventListener("click", function () { setMenu(false); openPrint(); });
    $("sn-print-close").addEventListener("click", closePrint);
    $("sn-print-cancel").addEventListener("click", closePrint);
    $("sn-print-go").addEventListener("click", runPrint);
    $("sn-opt-tabs").addEventListener("change", function () {
      state.tabs = $("sn-opt-tabs").checked;
      drawNet();
      if (state.unfold > 0.02) drawSolid();
      updateA4();
      savePrefs();
    });
    $("sn-opt-color").addEventListener("change", function () {
      state.mono = false;
      updateA4();
      savePrefs();
    });
    $("sn-opt-mono").addEventListener("change", function () {
      state.mono = true;
      updateA4();
      savePrefs();
    });
    $("sn-dl-net").addEventListener("click", downloadNet);
    $("sn-dl-net-m").addEventListener("click", function () { setMenu(false); downloadNet(); });
    $("sn-dl-solid").addEventListener("click", downloadSolid);
    $("sn-dl-solid-m").addEventListener("click", function () { setMenu(false); downloadSolid(); });
    $("sn-menu-btn").addEventListener("click", function () {
      setMenu($("sn-menu").hidden);
    });
    $("sn-rot-net").addEventListener("click", function () {
      state.rot = (state.rot + 1) % 4;
      drawNet();
      updateA4();
    });
    $("sn-flip-net").addEventListener("click", function () {
      state.flip = !state.flip;
      drawNet();
      updateA4();
    });
    $("sn-zoom-in").addEventListener("click", function () { zoomBy(0.85); });
    $("sn-zoom-out").addEventListener("click", function () { zoomBy(1.18); });
    $("sn-zoom-fit").addEventListener("click", function () { resetCamera(true); });
    document.addEventListener("click", function (ev) {
      if (!$("sn-menu").hidden && !ev.target.closest(".sn-menu-wrap")) setMenu(false);
    });
    document.querySelectorAll("[data-sn-close]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (el.getAttribute("data-sn-close") === "chooser") closeChooser();
        else closePrint();
      });
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        if (!$("sn-chooser").hidden) closeChooser();
        else if (!$("sn-print-dialog").hidden) closePrint();
        else if (!$("sn-size").hidden) toggleSize(false);
        else if (!$("sn-menu").hidden) setMenu(false);
      }
    });
    var stage = $("sn-stage");
    stage.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
    $("sn-net-svg").addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
    stage.addEventListener("wheel", function (ev) {
      if (!state.webgl) return;
      ev.preventDefault();
      zoomBy(ev.deltaY > 0 ? 1.08 : 0.92);
    }, { passive: false });
    stage.addEventListener("keydown", function (ev) {
      if (!state.webgl) return;
      var step = 0.08;
      if (ev.key === "ArrowLeft") { state.yaw -= step; ev.preventDefault(); drawSolid(); }
      else if (ev.key === "ArrowRight") { state.yaw += step; ev.preventDefault(); drawSolid(); }
      else if (ev.key === "ArrowUp") { state.pitch = Math.min(1.2, state.pitch + step); ev.preventDefault(); drawSolid(); }
      else if (ev.key === "ArrowDown") { state.pitch = Math.max(-1.05, state.pitch - step); ev.preventDefault(); drawSolid(); }
      else if (ev.key === "+" || ev.key === "=") { zoomBy(0.9); ev.preventDefault(); }
      else if (ev.key === "-" || ev.key === "_") { zoomBy(1.12); ev.preventDefault(); }
    });
    window.addEventListener("resize", function () { resizeGL(); drawSolid(); });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { resizeGL(); drawSolid(); }).observe(stage);
    }
    document.addEventListener("langchange", onLang);
    window.addEventListener("afterprint", function () {
      document.body.classList.remove("sn-printing");
    });
  }

  function onLang() {
    buildSolidButtons();
    markSolid();
    renderSizeFields();
    syncControls();
    updateStatus();
    updateA4();
    drawNet();
    drawSolid();
  }

  function setMenu(open) {
    $("sn-menu").hidden = !open;
    $("sn-menu-btn").setAttribute("aria-expanded", open ? "true" : "false");
  }
  function toggleLabels() {
    state.labels = !state.labels;
    state.notice = "";
    syncControls();
    drawNet();
    drawSolid();
    savePrefs();
  }
  function toggleSize(force) {
    var panel = $("sn-size");
    var open = typeof force === "boolean" ? force : panel.hidden;
    panel.hidden = !open;
    $("sn-size-btn").setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      renderSizeFields();
      updateA4();
      var field = panel.querySelector("input");
      if (field) field.focus();
    }
  }
  function fullDuration(target) {
    if (reduceMotion()) return 0;
    return Math.max(80, Math.round(700 * Math.abs(target - state.unfold)));
  }
  function animateUnfold(target, ms, done) {
    if (!state.webgl) {
      state.unfold = 0;
      syncControls();
      if (done) done();
      return;
    }
    var token = ++animToken;
    var from = state.unfold;
    if (!ms || reduceMotion() || Math.abs(target - from) < 0.001) {
      state.unfold = target;
      syncControls();
      drawSolid();
      savePrefs();
      if (done) done();
      return;
    }
    var t0 = performance.now();
    function frame(now) {
      if (token !== animToken) return;
      var u = Math.min(1, (now - t0) / ms);
      var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      state.unfold = from + (target - from) * e;
      syncControls();
      drawSolid();
      if (u < 1) requestAnimationFrame(frame);
      else {
        state.unfold = target;
        syncControls();
        drawSolid();
        savePrefs();
        if (done) done();
      }
    }
    requestAnimationFrame(frame);
  }
  function stepNet(dir) {
    if (nets.length < 2) return;
    selectNet((state.netIndex + dir + nets.length) % nets.length);
  }
  function selectNet(index, overlap) {
    var apply = function () {
      state.netIndex = index;
      state.notice = overlap ? tf("sn.netOverlap", { i: index + 1 }) : "";
      syncControls();
      drawNet();
      drawSolid();
      updateStatus();
      updateA4();
      savePrefs();
    };
    if (state.webgl && state.unfold > 0.02) animateUnfold(0, reduceMotion() ? 0 : 280, apply);
    else {
      state.unfold = 0;
      apply();
    }
  }

  function renderSizeFields() {
    var box = $("sn-size-fields");
    box.innerHTML = "";
    solidDef().params.forEach(function (p) {
      var lab = document.createElement("label");
      lab.className = "sn-field";
      var span = document.createElement("span");
      span.dataset.i18n = p.label;
      span.textContent = t(p.label) + " (" + t("sn.unit") + ")";
      var input = document.createElement("input");
      input.type = "number";
      input.min = "0.5";
      input.max = "20";
      input.step = "0.1";
      input.inputMode = "decimal";
      input.value = fmt(state.params[p.key]);
      input.dataset.key = p.key;
      input.addEventListener("change", onSizeEdit);
      lab.appendChild(span);
      lab.appendChild(input);
      box.appendChild(lab);
    });
  }
  function onSizeEdit() {
    var incoming = Object.assign({}, state.params);
    solidDef().params.forEach(function (p) {
      var input = document.querySelector('#sn-size-fields input[data-key="' + p.key + '"]');
      if (input) incoming[p.key] = Number(input.value);
    });
    var prevEdges = currentNet() && currentNet().edgeIdxs;
    var oldIndex = state.netIndex;
    var checked = D.clampParams(state.id, incoming, state.params);
    if (checked.invalid) {
      state.notice = t("sn.sizeInvalid");
      renderSizeFields();
      updateStatus();
      return;
    }
    state.params = checked.params;
    rebuild();
    var idx = prevEdges && model && model.kind === "poly" ? D.locateNet(model, nets, prevEdges) : oldIndex;
    if (idx < 0 || idx >= nets.length) {
      state.netIndex = Math.max(0, Math.min(oldIndex, nets.length - 1));
      state.notice = tf("sn.netOverlap", { i: state.netIndex + 1 });
    } else {
      state.netIndex = idx;
      state.notice = "";
    }
    syncControls();
    drawAll();
    updateStatus();
    updateA4();
    savePrefs();
  }
  function restoreSize() {
    var prevEdges = currentNet() && currentNet().edgeIdxs;
    state.params = D.defaultParams(state.id);
    state.notice = "";
    rebuild();
    var idx = prevEdges && model.kind === "poly" ? D.locateNet(model, nets, prevEdges) : 0;
    state.netIndex = idx >= 0 ? idx : 0;
    renderSizeFields();
    syncControls();
    drawAll();
    updateStatus();
    updateA4();
    savePrefs();
  }

  function sizePhrase(scale) {
    var p = state.params;
    var mul = scale || 1;
    function f(k) { return fmt(p[k] * mul); }
    var id = state.id;
    if (id === "cube" || id === "tetrahedron" || id === "octahedron") return tf("sn.size.edge", { a: f("a") });
    if (id === "cuboid") return tf("sn.size.cuboid", { a: f("a"), b: f("b"), c: f("c") });
    if (id === "tri-prism") return tf("sn.size.triPrism", { a: f("a"), h: f("h") });
    if (id === "quad-prism") return tf("sn.size.quadPrism", { a: f("a"), b: f("b"), c: f("c"), h: f("h") });
    if (id === "tri-pyramid" || id === "quad-pyramid") return tf("sn.size.baseH", { a: f("a"), h: f("h") });
    if (id === "cylinder") return tf("sn.size.cyl", { r: f("r"), h: f("h") });
    if (id === "cone") return tf("sn.size.cone", { r: f("r"), h: f("h") });
    return "";
  }
  function fitInfo() {
    var geom = viewedGeom();
    var b = D.boundsOf(D.collectPoints(geom));
    var pad = 0.4;
    var scale = D.a4Scale(b.w + pad * 2, b.h + pad * 2);
    var label = scale >= 0.999 ? "1:1" : "1:" + (1 / scale).toFixed(2);
    return { scale: scale, label: label, bounds: b, pad: pad };
  }
  function updateA4() {
    var info = fitInfo();
    var msg = info.scale >= 0.999 ? t("sn.fitsA4") : tf("sn.fitsA4.shrink", { scale: info.label });
    $("sn-a4").textContent = msg;
    var printNote = $("sn-print-a4");
    if (printNote) printNote.textContent = msg;
  }
  function updateStatus() {
    var name = t("sn.solid." + state.id);
    var hint = t(D.hintKey(state.id, state.params));
    var netPart = nets.length < 2 ? t("sn.netOnlyOne") : tf("sn.netIndex", { i: state.netIndex + 1, n: nets.length });
    var line = name + " · " + hint + " · " + netPart;
    if (state.notice) line = state.notice + " · " + line;
    $("sn-status").textContent = line;
    $("sn-current-name").textContent = name;
  }
  function markSolid() {
    document.querySelectorAll(".sn-solid-btn").forEach(function (btn) {
      var on = btn.dataset.solid === state.id;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
  }
  function syncControls() {
    markSolid();
    var multi = nets.length >= 2;
    $("sn-net-switch").hidden = !multi;
    $("sn-net-label").textContent = multi ? tf("sn.netIndex", { i: state.netIndex + 1, n: nets.length }) : t("sn.netOnlyOne");
    $("sn-fold-slider").value = String(Math.round(state.unfold * 100));
    $("sn-fold-slider").setAttribute("aria-valuetext", Math.round(state.unfold * 100) + "%");
    $("sn-unfold").disabled = !state.webgl;
    $("sn-fold").disabled = !state.webgl;
    $("sn-fold-slider").disabled = !state.webgl;
    $("sn-slider-row").hidden = !state.webgl;
    $("sn-unfold").setAttribute("aria-pressed", state.unfold > 0.98 ? "true" : "false");
    $("sn-fold").setAttribute("aria-pressed", state.unfold < 0.02 ? "true" : "false");
    $("sn-labels").setAttribute("aria-pressed", state.labels ? "true" : "false");
    $("sn-labels-m").setAttribute("aria-pressed", state.labels ? "true" : "false");
    $("sn-net-prev").setAttribute("aria-label", t("sn.prev"));
    $("sn-net-next").setAttribute("aria-label", t("sn.next"));
    $("sn-stage").setAttribute("aria-label", t("sn.aria.stage"));
    $("sn-net-svg").setAttribute("aria-label", t("sn.aria.net"));
    $("sn-solids").setAttribute("aria-label", t("sn.aria.picker"));
    $("sn-opt-tabs").checked = state.tabs;
    $("sn-opt-mono").checked = state.mono;
    $("sn-opt-color").checked = !state.mono;
  }
  function syncFoldPressed() {
    $("sn-unfold").setAttribute("aria-pressed", state.unfold > 0.98 ? "true" : "false");
    $("sn-fold").setAttribute("aria-pressed", state.unfold < 0.02 ? "true" : "false");
    $("sn-fold-slider").value = String(Math.round(state.unfold * 100));
  }

  function viewedGeom() {
    var net = currentNet();
    if (!model || !net) return { figures: [], folds: [], cuts: [], tabs: [] };
    var geom = D.geometry(model, net, state.tabs);
    return D.applyView(geom, state.rot, state.flip);
  }

  function drawAll() {
    drawNet();
    drawSolid();
  }

  function svgNode(name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }
  function negY(p) { return { x: p.x, y: -p.y }; }
  function pointsAttr(pts) {
    return pts.map(function (p) { var q = negY(p); return q.x.toFixed(3) + "," + q.y.toFixed(3); }).join(" ");
  }
  function sectorPoints(f) {
    var pts = [{ x: f.ax, y: f.ay }];
    var steps = 72, i;
    for (i = 0; i <= steps; i++) {
      var a = f.a0 + (f.a1 - f.a0) * (i / steps);
      pts.push({ x: f.ax + f.r * Math.cos(a), y: f.ay + f.r * Math.sin(a) });
    }
    return pts;
  }
  function labelPoint(fig) {
    if (fig.kind === "circle") return { x: fig.cx, y: fig.cy };
    if (fig.kind === "sector") {
      var mid = (fig.a0 + fig.a1) / 2;
      return { x: fig.ax + Math.cos(mid) * fig.r * 0.55, y: fig.ay + Math.sin(mid) * fig.r * 0.55 };
    }
    return D.centroid2(fig.pts);
  }
  function paintSvg(svg, geom, opts) {
    var showLabels = opts.labels !== false;
    var mono = !!opts.mono;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var pts = D.collectPoints(geom);
    var b = D.boundsOf(pts);
    var pad = Math.max(0.35, Math.max(b.w, b.h) * 0.04);
    var x0 = b.minX - pad;
    var yTop = -(b.maxY + pad);
    var w = b.w + pad * 2;
    var h = b.h + pad * 2;
    svg.setAttribute("viewBox", x0 + " " + yTop + " " + w + " " + h);
    var defs = svgNode("defs");
    svg.appendChild(defs);
    geom.figures.forEach(function (fig) {
      var fill = mono ? "#E5E7EB" : fig.fill;
      var ink = mono ? NAVY : fig.ink;
      if (fig.kind === "poly") {
        svg.appendChild(svgNode("polygon", { points: pointsAttr(fig.pts), fill: fill }));
      } else if (fig.kind === "circle") {
        svg.appendChild(svgNode("circle", {
          cx: fig.cx.toFixed(3), cy: (-fig.cy).toFixed(3), r: fig.r.toFixed(3), fill: fill,
        }));
      } else if (fig.kind === "sector") {
        svg.appendChild(svgNode("polygon", { points: pointsAttr(sectorPoints(fig)), fill: fill }));
      }
      if (showLabels) {
        var lp = labelPoint(fig);
        var text = svgNode("text", {
          x: lp.x.toFixed(3),
          y: (-lp.y).toFixed(3),
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          fill: ink,
          "font-weight": "700",
          "font-family": "sans-serif",
          "font-size": String(Math.max(0.28, Math.min(fig.kind === "circle" ? fig.r * 0.7 : 0.55, 0.7))),
        });
        text.textContent = String(fig.no);
        svg.appendChild(text);
      }
    });
    function strokeSeg(seg, dash) {
      var a = negY(seg[0]), b = negY(seg[1]);
      svg.appendChild(svgNode("line", {
        x1: a.x.toFixed(3), y1: a.y.toFixed(3), x2: b.x.toFixed(3), y2: b.y.toFixed(3),
        stroke: NAVY,
        "stroke-width": opts.print ? "0.04" : "1.6",
        "vector-effect": opts.print ? "none" : "non-scaling-stroke",
        "stroke-dasharray": dash ? (opts.print ? "0.18 0.12" : "5 4") : "none",
        "stroke-linecap": "round",
      }));
    }
    geom.folds.forEach(function (seg) { strokeSeg(seg, true); });
    geom.cuts.forEach(function (seg) { strokeSeg(seg, false); });
    geom.tabs.forEach(function (poly) {
      var id = "snc" + (++clipSeq);
      var cp = svgNode("clipPath", { id: id });
      cp.appendChild(svgNode("polygon", { points: pointsAttr(poly) }));
      defs.appendChild(cp);
      var g = svgNode("g", { "clip-path": "url(#" + id + ")" });
      g.appendChild(svgNode("polygon", {
        points: pointsAttr(poly), fill: "#fff", stroke: NAVY,
        "stroke-width": opts.print ? "0.03" : "1.2",
        "vector-effect": opts.print ? "none" : "non-scaling-stroke",
      }));
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      poly.forEach(function (p) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      for (var i = 0; i < 5; i++) {
        var x = minX + (maxX - minX) * (i / 4);
        g.appendChild(svgNode("line", {
          x1: x.toFixed(3), y1: (-maxY).toFixed(3), x2: (x + 0.45).toFixed(3), y2: (-minY).toFixed(3),
          stroke: "#94A3B8", "stroke-width": opts.print ? "0.02" : "1",
          "vector-effect": opts.print ? "none" : "non-scaling-stroke",
        }));
      }
      svg.appendChild(g);
    });
  }
  function drawNet() {
    paintSvg($("sn-net-svg"), viewedGeom(), { labels: state.labels, mono: false, print: false });
  }

  function openChooser() {
    if (nets.length < 2) return;
    focusReturn = $("sn-net-label");
    var grid = $("sn-chooser-grid");
    grid.innerHTML = "";
    nets.forEach(function (net, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sn-thumb";
      if (i === state.netIndex) btn.setAttribute("aria-current", "true");
      var svg = svgNode("svg", { viewBox: "0 0 10 10" });
      var geom = D.geometry(model, net, false);
      paintSvg(svg, geom, { labels: false, mono: false, print: false });
      btn.appendChild(svg);
      var cap = document.createElement("span");
      cap.textContent = String(i + 1);
      btn.appendChild(cap);
      btn.addEventListener("click", function () {
        selectNet(i);
        closeChooser();
      });
      grid.appendChild(btn);
    });
    $("sn-chooser").hidden = false;
    $("sn-chooser-close").focus();
  }
  function closeChooser() {
    $("sn-chooser").hidden = true;
    if (focusReturn) focusReturn.focus();
  }
  function openPrint() {
    focusReturn = $("sn-print-btn");
    state.printLabels = state.labels;
    $("sn-opt-labels").checked = state.labels;
    $("sn-opt-tabs").checked = state.tabs;
    $("sn-opt-mono").checked = state.mono;
    $("sn-opt-color").checked = !state.mono;
    updateA4();
    $("sn-print-dialog").hidden = false;
    $("sn-print-close").focus();
  }
  function closePrint() {
    $("sn-print-dialog").hidden = true;
    if (focusReturn) focusReturn.focus();
  }
  function captionText(info) {
    var cap = tf("sn.printCaption", {
      name: t("sn.solid." + state.id),
      size: sizePhrase(1),
      scale: info.label,
    });
    if (info.scale < 0.999) {
      cap += " · " + tf("sn.printCaption.actual", { printSize: sizePhrase(info.scale) });
    }
    return cap;
  }
  function buildPrintDom() {
    var root = $("sn-print-root");
    root.innerHTML = "";
    var geom = viewedGeom();
    var info = fitInfo();
    var svg = svgNode("svg");
    paintSvg(svg, geom, { labels: $("sn-print-dialog").hidden ? state.labels : $("sn-opt-labels").checked, mono: state.mono, print: true });
    var b = info.bounds;
    var pad = info.pad;
    var wCm = b.w + pad * 2;
    var hCm = b.h + pad * 2;
    svg.setAttribute("width", (wCm * 10 * info.scale).toFixed(2) + "mm");
    svg.setAttribute("height", (hCm * 10 * info.scale).toFixed(2) + "mm");
    root.appendChild(svg);
    var p = document.createElement("p");
    p.className = "sn-print-caption";
    p.textContent = captionText(info);
    root.appendChild(p);
  }
  function runPrint() {
    state.tabs = $("sn-opt-tabs").checked;
    state.mono = $("sn-opt-mono").checked;
    state.printLabels = $("sn-opt-labels").checked;
    drawNet();
    updateA4();
    savePrefs();
    buildPrintDom();
    closePrint();
    document.body.classList.add("sn-printing");
    window.print();
  }

  function saveCanvas(canvas, name) {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement("a");
      var url = URL.createObjectURL(blob);
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }, "image/png");
  }
  function downloadNet() {
    var svg = $("sn-net-svg");
    var rect = svg.getBoundingClientRect();
    var w = Math.max(2, Math.round(rect.width * 2));
    var h = Math.max(2, Math.round(rect.height * 2));
    var clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    var xml = new XMLSerializer().serializeToString(clone);
    var blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.fillStyle = "#334155";
      ctx.font = "22px sans-serif";
      ctx.fillText(ATTR, 18, h - 22);
      URL.revokeObjectURL(url);
      saveCanvas(canvas, "solid-nets-" + state.id + "-net-" + (state.netIndex + 1) + ".png");
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      state.notice = t("sn.downloadFail");
      updateStatus();
    };
    img.src = url;
  }
  function downloadSolid() {
    var pose = D.pose(model, currentNet(), state.webgl ? state.unfold : 0, state.tabs);
    if (!pose || !pose.polys) {
      $("sn-dl-solid").disabled = true;
      state.notice = t("sn.downloadFail");
      updateStatus();
      return;
    }
    var canvas = document.createElement("canvas");
    var css = $("sn-stage").getBoundingClientRect();
    canvas.width = Math.max(2, Math.round(css.width * 2));
    canvas.height = Math.max(2, Math.round(css.height * 2));
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (state.webgl) {
      var glCanvas = $("sn-gl");
      var prevW = glCanvas.width, prevH = glCanvas.height;
      glCanvas.width = canvas.width;
      glCanvas.height = canvas.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      paintGL(pose);
      ctx.drawImage(glCanvas, 0, 0);
      glCanvas.width = prevW;
      glCanvas.height = prevH;
      resizeGL();
      drawSolid();
      paintNumbers(ctx, canvas.width, canvas.height, pose, false);
    } else {
      paintIso(ctx, canvas.width, canvas.height, pose);
    }
    ctx.fillStyle = "#334155";
    ctx.font = "22px sans-serif";
    ctx.fillText(ATTR, 18, canvas.height - 22);
    saveCanvas(canvas, "solid-nets-" + state.id + ".png");
  }

  function eyeVector() {
    var cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    var cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    return [state.dist * cp * sy, state.dist * sp, state.dist * cp * cy];
  }
  function modelRadius(polys) {
    var m = 0.5;
    polys.forEach(function (poly) {
      poly.pts.forEach(function (p) {
        m = Math.max(m, Math.hypot(p[0], p[1], p[2]));
      });
    });
    return m;
  }
  function fitDistance() {
    var pose = D.pose(model, currentNet(), 0, state.tabs);
    var flat = D.pose(model, currentNet(), 1, state.tabs);
    var r = Math.max(modelRadius(pose.polys || []), modelRadius(flat.polys || []));
    return r / Math.sin((32 * Math.PI) / 180) * 1.15;
  }
  function resetCamera() {
    state.yaw = -0.65;
    state.pitch = 0.55;
    state.dist = fitDistance();
    drawSolid();
  }
  function zoomBy(factor) {
    state.dist = Math.max(2, Math.min(80, state.dist * factor));
    drawSolid();
  }

  function matMultiply(a, b) {
    var o = new Array(16);
    var c, r;
    for (c = 0; c < 4; c++) {
      for (r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }
  function perspective(fov, aspect, near, far) {
    var f = 1 / Math.tan((fov * Math.PI) / 360);
    var nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ];
  }
  function lookAt(eye) {
    var target = [0, 0, 0], up = [0, 1, 0];
    var zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    var zl = Math.hypot(zx, zy, zz) || 1;
    zx /= zl; zy /= zl; zz /= zl;
    var xx = up[1] * zz - up[2] * zy;
    var xy = up[2] * zx - up[0] * zz;
    var xz = up[0] * zy - up[1] * zx;
    var xl = Math.hypot(xx, xy, xz) || 1;
    xx /= xl; xy /= xl; xz /= xl;
    var yx = zy * xz - zz * xy;
    var yy = zz * xx - zx * xz;
    var yz = zx * xy - zy * xx;
    return [
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
      1,
    ];
  }
  function mvpMatrix(width, height) {
    var aspect = width / Math.max(1, height);
    var proj = perspective(42, aspect, 0.1, 200);
    var view = lookAt(eyeVector());
    return matMultiply(proj, view);
  }
  function project(mvp, p, w, h) {
    var x = mvp[0] * p[0] + mvp[4] * p[1] + mvp[8] * p[2] + mvp[12];
    var y = mvp[1] * p[0] + mvp[5] * p[1] + mvp[9] * p[2] + mvp[13];
    var z = mvp[2] * p[0] + mvp[6] * p[1] + mvp[10] * p[2] + mvp[14];
    var w4 = mvp[3] * p[0] + mvp[7] * p[1] + mvp[11] * p[2] + mvp[15];
    if (!w4) return null;
    return { x: (x / w4 * 0.5 + 0.5) * w, y: (1 - (y / w4 * 0.5 + 0.5)) * h, z: z / w4 };
  }
  function polyNormal(pts) {
    var nx = 0, ny = 0, nz = 0, i, a, b;
    for (i = 0; i < pts.length; i++) {
      a = pts[i];
      b = pts[(i + 1) % pts.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    var l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }
  function facingCamera(pts, eye) {
    var c = [0, 0, 0];
    pts.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; });
    c[0] /= pts.length; c[1] /= pts.length; c[2] /= pts.length;
    var n = polyNormal(pts);
    var vx = c[0] - eye[0], vy = c[1] - eye[1], vz = c[2] - eye[2];
    return n[0] * vx + n[1] * vy + n[2] * vz < 0;
  }
  function hexToRgb(hex) {
    var n = hex.replace("#", "");
    return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255];
  }

  function initGL() {
    var canvas = $("sn-gl");
    try {
      gl = canvas.getContext("webgl", { antialias: true, preserveDrawingBuffer: true, alpha: false });
    } catch (e) { gl = null; }
    if (!gl) {
      state.webgl = false;
      canvas.hidden = true;
      $("sn-iso").hidden = false;
      $("sn-nowebgl").hidden = false;
      state.unfold = 0;
      return;
    }
    state.webgl = true;
    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, "attribute vec3 aPos;attribute vec3 aCol;uniform mat4 uMvp;varying vec3 vCol;void main(){gl_Position=uMvp*vec4(aPos,1.0);vCol=aCol;}");
    gl.compileShader(vs);
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, "precision mediump float;varying vec3 vCol;uniform float uAlpha;void main(){gl_FragColor=vec4(vCol,uAlpha);}");
    gl.compileShader(fs);
    glProg = gl.createProgram();
    gl.attachShader(glProg, vs);
    gl.attachShader(glProg, fs);
    gl.bindAttribLocation(glProg, 0, "aPos");
    gl.bindAttribLocation(glProg, 1, "aCol");
    gl.linkProgram(glProg);
    if (!gl.getProgramParameter(glProg, gl.LINK_STATUS)) {
      state.webgl = false;
      canvas.hidden = true;
      $("sn-iso").hidden = false;
      $("sn-nowebgl").hidden = false;
      return;
    }
    gl.useProgram(glProg);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    resizeGL();
  }
  function resizeGL() {
    if (!gl) return;
    var canvas = $("sn-gl");
    var rect = $("sn-stage").getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(2, Math.floor(rect.width * dpr));
    var h = Math.max(2, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  function triangulate(pts) {
    var tris = [];
    for (var i = 1; i < pts.length - 1; i++) tris.push(pts[0], pts[i], pts[i + 1]);
    return tris;
  }
  function paintGL(pose) {
    var canvas = $("sn-gl");
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.973, 0.98, 0.988, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var mvp = mvpMatrix(canvas.width, canvas.height);
    gl.useProgram(glProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(glProg, "uMvp"), false, new Float32Array(mvp));
    var locA = gl.getAttribLocation(glProg, "aPos");
    var locC = gl.getAttribLocation(glProg, "aCol");
    var eye = eyeVector();
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    function drawList(list, alpha) {
      if (!list.length) return;
      var data = [];
      list.forEach(function (poly) {
        if (!poly.pts || poly.pts.length < 3) return;
        var rgb = hexToRgb(poly.fill);
        triangulate(poly.pts).forEach(function (p) {
          data.push(p[0], p[1], p[2], rgb[0], rgb[1], rgb[2]);
        });
      });
      if (!data.length) return;
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(locA);
      gl.enableVertexAttribArray(locC);
      gl.vertexAttribPointer(locA, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(locC, 3, gl.FLOAT, false, 24, 12);
      gl.uniform1f(gl.getUniformLocation(glProg, "uAlpha"), alpha);
      gl.drawArrays(gl.TRIANGLES, 0, data.length / 6);
    }
    var front = [], back = [];
    pose.polys.forEach(function (poly) {
      (facingCamera(poly.pts, eye) ? front : back).push(poly);
    });
    gl.depthMask(true);
    drawList(back, 0.38);
    drawList(front, 1);
    var lines = [];
    pose.polys.forEach(function (poly) {
      var n = poly.pts.length;
      var idxs = poly.strokeEdges || null;
      var count = idxs ? idxs.length : n;
      for (var i = 0; i < count; i++) {
        var ei = idxs ? idxs[i] : i;
        var a = poly.pts[ei], b = poly.pts[(ei + 1) % n];
        lines.push(a[0], a[1], a[2], 0.05, 0.11, 0.16, b[0], b[1], b[2], 0.05, 0.11, 0.16);
      }
    });
    if (lines.length) {
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(locA, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(locC, 3, gl.FLOAT, false, 24, 12);
      gl.uniform1f(gl.getUniformLocation(glProg, "uAlpha"), 1);
      gl.drawArrays(gl.LINES, 0, lines.length / 6);
    }
    gl.deleteBuffer(buf);
  }
  function faceAnchors(pose, eye) {
    var groups = {};
    pose.polys.forEach(function (poly) {
      if (!poly.pts || !poly.pts.length) return;
      var c = [0, 0, 0];
      poly.pts.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; });
      c[0] /= poly.pts.length; c[1] /= poly.pts.length; c[2] /= poly.pts.length;
      var key = String(poly.no);
      if (!groups[key]) groups[key] = { no: poly.no, ink: poly.ink, parts: [] };
      groups[key].parts.push({ c: c, front: facingCamera(poly.pts, eye) });
    });
    return Object.keys(groups).map(function (key) {
      var g = groups[key];
      var use = g.parts.filter(function (p) { return p.front; });
      if (!use.length) use = g.parts;
      var c = [0, 0, 0];
      use.forEach(function (p) { c[0] += p.c[0]; c[1] += p.c[1]; c[2] += p.c[2]; });
      c[0] /= use.length; c[1] /= use.length; c[2] /= use.length;
      return { no: g.no, ink: g.ink, c: c, front: g.parts.some(function (p) { return p.front; }) };
    });
  }
  function paintNumbers(ctx, w, h, pose, force) {
    if (!state.labels && !force) return;
    var mvp = mvpMatrix(w, h);
    var eye = eyeVector();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 " + Math.max(16, Math.round(w / 48)) + "px sans-serif";
    faceAnchors(pose, eye).forEach(function (face) {
      if (!face.front) return;
      var s = project(mvp, face.c, w, h);
      if (!s || s.z < -1 || s.z > 1) return;
      ctx.fillStyle = face.ink || NAVY;
      ctx.fillText(String(face.no), s.x, s.y);
    });
  }
  function placeHtmlLabels(pose) {
    var box = $("sn-face-labels");
    box.innerHTML = "";
    if (!state.labels || !state.webgl) return;
    var canvas = $("sn-gl");
    var mvp = mvpMatrix(canvas.width, canvas.height);
    var eye = eyeVector();
    var rect = canvas.getBoundingClientRect();
    faceAnchors(pose, eye).forEach(function (face) {
      if (!face.front) return;
      var s = project(mvp, face.c, rect.width, rect.height);
      if (!s) return;
      var el = document.createElement("span");
      el.className = "sn-face-label";
      el.textContent = String(face.no);
      el.style.left = s.x + "px";
      el.style.top = s.y + "px";
      el.style.color = face.ink || NAVY;
      box.appendChild(el);
    });
  }
  function paintIso(ctx, w, h, pose) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);
    var savedYaw = state.yaw, savedPitch = state.pitch, savedDist = state.dist;
    state.yaw = -0.65;
    state.pitch = 0.55;
    state.dist = fitDistance();
    var mvp = mvpMatrix(w, h);
    var eye = eyeVector();
    var order = pose.polys.map(function (poly, i) {
      var z = 0;
      poly.pts.forEach(function (p) { z += p[0] * eye[0] + p[1] * eye[1] + p[2] * eye[2]; });
      return { poly: poly, z: z / poly.pts.length, i: i };
    });
    order.sort(function (a, b) { return b.z - a.z; });
    order.forEach(function (item) {
      var poly = item.poly;
      ctx.beginPath();
      poly.pts.forEach(function (p, k) {
        var s = project(mvp, p, w, h);
        if (!s) return;
        if (k === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fillStyle = facingCamera(poly.pts, eye) ? poly.fill : poly.fill;
      ctx.globalAlpha = facingCamera(poly.pts, eye) ? 1 : 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = NAVY;
      ctx.lineWidth = Math.max(1, w / 500);
      var n = poly.pts.length;
      var idxs = poly.strokeEdges || null;
      var count = idxs ? idxs.length : n;
      ctx.beginPath();
      for (var ei = 0; ei < count; ei++) {
        var e = idxs ? idxs[ei] : ei;
        var a = project(mvp, poly.pts[e], w, h);
        var b = project(mvp, poly.pts[(e + 1) % n], w, h);
        if (!a || !b) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    });
    state.yaw = savedYaw;
    state.pitch = savedPitch;
    state.dist = savedDist;
    if (state.labels) {
      state.yaw = -0.65; state.pitch = 0.55; state.dist = fitDistance();
      paintNumbers(ctx, w, h, pose, true);
      state.yaw = savedYaw; state.pitch = savedPitch; state.dist = savedDist;
    }
  }
  function drawSolid() {
    var net = currentNet();
    if (!model || !net) return;
    var pose = D.pose(model, net, state.webgl ? state.unfold : 0, state.tabs);
    if (state.webgl) {
      resizeGL();
      paintGL(pose);
      placeHtmlLabels(pose);
    } else {
      var canvas = $("sn-iso");
      var rect = $("sn-stage").getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(2, Math.floor(rect.width * dpr));
      canvas.height = Math.max(2, Math.floor(rect.height * dpr));
      canvas.hidden = false;
      paintIso(canvas.getContext("2d"), canvas.width, canvas.height, pose);
      $("sn-face-labels").innerHTML = "";
    }
  }

  function onPointerDown(ev) {
    if (!state.webgl) return;
    $("sn-stage").setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2) pinchDist = pointerSpan();
  }
  function onPointerMove(ev) {
    if (!state.webgl || !pointers.has(ev.pointerId)) return;
    var prev = pointers.get(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2) {
      var span = pointerSpan();
      if (pinchDist > 0) zoomBy(pinchDist / span);
      pinchDist = span;
      return;
    }
    if (pointers.size === 1) {
      var dx = ev.clientX - prev.x;
      var dy = ev.clientY - prev.y;
      state.yaw += dx * 0.01;
      state.pitch = Math.max(-1.05, Math.min(1.2, state.pitch + dy * 0.01));
      drawSolid();
    }
  }
  function onPointerUp(ev) {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinchDist = 0;
  }
  function pointerSpan() {
    var pts = Array.from(pointers.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
  }

  function start() {
    boot();
    requestAnimationFrame(function () {
      resizeGL();
      drawSolid();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
