/**
 * Breadboard wiring planner — board maps, part footprints, and net rules.
 * Original schematic data for this site. Planning only: no electrical simulation.
 */
(function (root) {
  var ROWS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  var COLS = 30;
  var MAX_SLOTS = 4;

  var PARTS = [
    { id: "led", limit: 8, place: "board" },
    { id: "resistor", limit: 8, place: "board" },
    { id: "button", limit: 4, place: "board" },
    { id: "ldr", limit: 2, place: "board" },
    { id: "pot", limit: 2, place: "board" },
    { id: "buzzer", limit: 2, place: "board" },
    { id: "servo", limit: 2, place: "module" },
    { id: "ultrasonic", limit: 1, place: "module" }
  ];

  var WIRE_COLORS = ["red", "black", "orange", "yellow", "teal", "white", "gray"];
  var LED_COLORS = ["red", "yellow", "green", "blue", "white"];
  var RESISTOR_VALUES = ["220", "330", "1000", "10000"];

  function partById(id) {
    for (var i = 0; i < PARTS.length; i++) {
      if (PARTS[i].id === id) return PARTS[i];
    }
    return null;
  }

  function parseHole(ref) {
    var m = /^([a-j])(\d+)$/.exec(ref || "");
    if (!m) return null;
    var col = parseInt(m[2], 10);
    if (col < 1 || col > COLS) return null;
    return { row: m[1], col: col };
  }

  function holeRef(row, col) {
    return row + String(col);
  }

  function sameStrip(rowA, rowB) {
    var a = ROWS.indexOf(rowA);
    var b = ROWS.indexOf(rowB);
    if (a < 0 || b < 0) return false;
    return (a <= 4 && b <= 4) || (a >= 5 && b >= 5);
  }

  function rotStep(rotation) {
    if (rotation === 90) return { dc: 0, dr: 1 };
    if (rotation === 180) return { dc: -1, dr: 0 };
    if (rotation === 270) return { dc: 0, dr: -1 };
    return { dc: 1, dr: 0 };
  }

  function shiftHole(anchor, dc, dr) {
    var h = parseHole(anchor);
    if (!h) return null;
    var ri = ROWS.indexOf(h.row) + dr;
    var col = h.col + dc;
    if (ri < 0 || ri >= ROWS.length || col < 1 || col > COLS) return null;
    var row = ROWS[ri];
    if ((dc !== 0 || dr !== 0) && dr !== 0 && !sameStrip(h.row, row)) return null;
    if (dr === 0 && row !== h.row) return null;
    return holeRef(row, col);
  }

  function oriented(anchor, rotation, distances) {
    var step = rotStep(rotation);
    var out = [];
    for (var i = 0; i < distances.length; i++) {
      var ref = shiftHole(anchor, step.dc * distances[i], step.dr * distances[i]);
      if (!ref) return null;
      out.push(ref);
    }
    return out;
  }

  function footprint(type, anchor, rotation) {
    var rot = rotation || 0;
    if (rot !== 0 && rot !== 90 && rot !== 180 && rot !== 270) return { ok: false };
    if (type === "button") return buttonFootprint(anchor, rot);
    if (type === "led") return twoPin(anchor, rot, 1, "cathode", "anode", "bb.led.cathode", "bb.led.anode", true, true);
    if (type === "ldr") return twoPin(anchor, rot, 1, "a", "b", "bb.ldr.a", "bb.ldr.b", true, true);
    if (type === "resistor") return twoPin(anchor, rot, 3, "a", "b", "bb.resistor.a", "bb.resistor.b", false, false);
    if (type === "buzzer") return twoPin(anchor, rot, 2, "plus", "minus", "bb.buzzer.plus", "bb.buzzer.minus", true, false);
    if (type === "pot") return potFootprint(anchor, rot);
    return { ok: false };
  }

  function twoPin(anchor, rotation, dist, idA, idB, keyA, keyB, sigA, sigB) {
    var holes = oriented(anchor, rotation, [0, dist]);
    if (!holes) return { ok: false };
    var map = {};
    map[idA] = holes[0];
    map[idB] = holes[1];
    return {
      ok: true,
      holes: map,
      terminals: [
        { id: idA, hole: holes[0], signal: sigA, labelKey: keyA },
        { id: idB, hole: holes[1], signal: sigB, labelKey: keyB }
      ],
      bridges: []
    };
  }

  function potFootprint(anchor, rotation) {
    var holes = oriented(anchor, rotation, [0, 1, 2]);
    if (!holes) return { ok: false };
    return {
      ok: true,
      holes: { pin1: holes[0], wiper: holes[1], pin3: holes[2] },
      terminals: [
        { id: "pin1", hole: holes[0], signal: true, labelKey: "bb.pot.pin1" },
        { id: "wiper", hole: holes[1], signal: true, labelKey: "bb.pot.wiper" },
        { id: "pin3", hole: holes[2], signal: true, labelKey: "bb.pot.pin3" }
      ],
      bridges: []
    };
  }

  function buttonFootprint(anchor, rotation) {
    if (rotation !== 0 && rotation !== 180) return { ok: false };
    var h = parseHole(anchor);
    if (!h || h.row !== "e" || h.col + 2 > COLS) return { ok: false };
    var n = h.col;
    var e1 = "e" + n;
    var f1 = "f" + n;
    var e2 = "e" + (n + 2);
    var f2 = "f" + (n + 2);
    return {
      ok: true,
      holes: { end1: e1, end1b: f1, end2: e2, end2b: f2 },
      terminals: [
        { id: "end1", hole: e1, signal: true, labelKey: "bb.button.end1" },
        { id: "end2", hole: e2, signal: true, labelKey: "bb.button.end2" }
      ],
      bridges: [[e1, f1], [e2, f2]]
    };
  }

  function moduleTerminals(type) {
    if (type === "servo") {
      return [
        { id: "signal", signal: true, labelKey: "bb.servo.signal" },
        { id: "vcc", signal: false, labelKey: "bb.servo.vcc" },
        { id: "gnd", signal: false, labelKey: "bb.servo.gnd" }
      ];
    }
    if (type === "ultrasonic") {
      return [
        { id: "vcc", signal: false, labelKey: "bb.ultra.vcc" },
        { id: "trig", signal: true, labelKey: "bb.ultra.trig" },
        { id: "echo", signal: true, labelKey: "bb.ultra.echo" },
        { id: "gnd", signal: false, labelKey: "bb.ultra.gnd" }
      ];
    }
    return null;
  }

  function defaultProps(type) {
    if (type === "led") return { color: "red" };
    if (type === "resistor") return { value: "220" };
    return {};
  }

  function pwmSet(board) {
    var list = ["D3", "D5", "D6", "D9", "D10", "D11"];
    if (board === "leonardo") list.push("D13");
    return list;
  }

  function pinLayout(board) {
    var leo = board === "leonardo";
    var pwm = {};
    pwmSet(board).forEach(function (ref) { pwm[ref] = true; });
    function badges(ref, extra) {
      var out = [];
      if (pwm[ref]) out.push("PWM");
      if (extra) extra.forEach(function (b) { out.push(b); });
      return out;
    }
    var left = [
      { ref: "IOREF", index: 0, label: "IOREF" },
      { ref: "RESET", index: 1, label: "RESET" },
      { ref: "3V3", index: 2, label: "3.3V" },
      { ref: "5V", index: 3, label: "5V" },
      { ref: "GND", index: 4, label: "GND" },
      { ref: "GND2", index: 5, label: "GND" },
      { ref: "VIN", index: 6, label: "VIN" },
      { ref: "A0", index: 8, label: "A0" },
      { ref: "A1", index: 9, label: "A1" },
      { ref: "A2", index: 10, label: "A2" },
      { ref: "A3", index: 11, label: "A3" },
      { ref: "A4", index: 12, label: "A4", badges: leo ? [] : ["SDA"] },
      { ref: "A5", index: 13, label: "A5", badges: leo ? [] : ["SCL"] }
    ];
    var right = [
      { ref: "D0", index: 0, label: "D0", badges: ["RX"] },
      { ref: "D1", index: 1, label: "D1", badges: ["TX"] },
      { ref: "D2", index: 2, label: "D2", badges: badges("D2", leo ? ["SDA"] : null) },
      { ref: "D3", index: 3, label: "D3", badges: badges("D3", leo ? ["SCL"] : null) },
      { ref: "D4", index: 4, label: "D4" },
      { ref: "D5", index: 5, label: "D5", badges: badges("D5") },
      { ref: "D6", index: 6, label: "D6", badges: badges("D6") },
      { ref: "D7", index: 7, label: "D7" },
      { ref: "D8", index: 9, label: "D8" },
      { ref: "D9", index: 10, label: "D9", badges: badges("D9") },
      { ref: "D10", index: 11, label: "D10", badges: badges("D10", leo ? null : ["SS"]) },
      { ref: "D11", index: 12, label: "D11", badges: badges("D11", leo ? null : ["MOSI"]) },
      { ref: "D12", index: 13, label: "D12", badges: badges("D12", leo ? null : ["MISO"]) },
      { ref: "D13", index: 14, label: "D13", badges: badges("D13", leo ? null : ["SCK"]), note: "LED" },
      { ref: "GND3", index: 15, label: "GND" },
      { ref: "AREF", index: 16, label: "AREF" }
    ];
    left.forEach(function (p) { p.side = "left"; if (!p.badges) p.badges = []; });
    right.forEach(function (p) { p.side = "right"; if (!p.badges) p.badges = []; });
    return left.concat(right);
  }

  function icspLayout(board) {
    var leo = board === "leonardo";
    return [
      { ref: "ICSP_MISO", label: "MISO", col: 0, row: 0 },
      { ref: "ICSP_MOSI", label: "MOSI", col: 1, row: 0 },
      { ref: "ICSP_SCK", label: "SCK", col: 0, row: 1 },
      { ref: "5V", label: "5V", col: 1, row: 1, alias: true },
      { ref: "GND", label: "GND", col: 0, row: 2, alias: true },
      { ref: "RESET", label: "RST", col: 1, row: 2, alias: true }
    ].map(function (p) {
      p.spi = leo && !p.alias;
      return p;
    });
  }

  function i2cPins(board) {
    return board === "leonardo" ? ["D2", "D3"] : ["A4", "A5"];
  }

  function autoWireColor(end) {
    if (!end) return "yellow";
    if (end.kind === "pin") {
      if (end.ref === "5V") return "red";
      if (end.ref === "3V3") return "orange";
      if (end.ref === "GND" || end.ref === "GND2" || end.ref === "GND3") return "black";
    }
    if (end.kind === "rail" && end.ref) {
      if (end.ref.indexOf(":+:") !== -1) return "red";
      if (end.ref.indexOf(":-:") !== -1) return "black";
    }
    return "yellow";
  }

  function endKey(end) {
    return (end && end.kind ? end.kind : "") + ":" + (end && end.ref ? end.ref : "");
  }

  function sameEnd(a, b) {
    return !!a && !!b && a.kind === b.kind && a.ref === b.ref;
  }

  function wireKey(wire) {
    var a = endKey(wire.from);
    var b = endKey(wire.to);
    return a < b ? a + "|" + b : b + "|" + a;
  }

  function displayPin(ref, board) {
    if (ref === "GND" || ref === "GND2" || ref === "GND3") return "GND";
    if (ref === "3V3") return "3.3V";
    if (ref === "ICSP_MOSI") return board === "uno" ? "D11" : "ICSP MOSI";
    if (ref === "ICSP_MISO") return board === "uno" ? "D12" : "ICSP MISO";
    if (ref === "ICSP_SCK") return board === "uno" ? "D13" : "ICSP SCK";
    return ref;
  }

  function conflictId(ref, board) {
    if (/^D([0-9]|1[0-3])$/.test(ref) || /^A[0-5]$/.test(ref)) return ref;
    if (ref === "ICSP_MOSI" || ref === "ICSP_MISO" || ref === "ICSP_SCK") {
      return displayPin(ref, board);
    }
    return null;
  }

  function pinSortKey(label) {
    var d = /^D(\d+)$/.exec(label);
    if (d) return 100 + parseInt(d[1], 10);
    var a = /^A(\d+)$/.exec(label);
    if (a) return 200 + parseInt(a[1], 10);
    if (label === "5V") return 300;
    if (label === "3.3V") return 301;
    if (label === "GND") return 302;
    return 400;
  }

  function uniqueSorted(list) {
    var seen = {};
    var out = [];
    list.forEach(function (item) {
      if (!item || seen[item]) return;
      seen[item] = true;
      out.push(item);
    });
    out.sort(function (a, b) { return pinSortKey(a) - pinSortKey(b); });
    return out;
  }

  function analyze(project) {
    var board = project && project.board === "leonardo" ? "leonardo" : "uno";
    var parent = {};
    function add(id) {
      if (parent[id] === undefined) parent[id] = id;
    }
    function find(id) {
      add(id);
      var root = id;
      while (parent[root] !== root) root = parent[root];
      var cur = id;
      while (parent[cur] !== cur) {
        var next = parent[cur];
        parent[cur] = root;
        cur = next;
      }
      return root;
    }
    function union(a, b) {
      var ra = find(a);
      var rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    }

    var r;
    var c;
    for (c = 1; c <= COLS; c++) {
      for (r = 0; r < 4; r++) union("hole:" + ROWS[r] + c, "hole:" + ROWS[r + 1] + c);
      for (r = 5; r < 9; r++) union("hole:" + ROWS[r] + c, "hole:" + ROWS[r + 1] + c);
      if (c > 1) {
        union("hole:rail:+:top:1", "hole:rail:+:top:" + c);
        union("hole:rail:-:top:1", "hole:rail:-:top:" + c);
        union("hole:rail:+:bottom:1", "hole:rail:+:bottom:" + c);
        union("hole:rail:-:bottom:1", "hole:rail:-:bottom:" + c);
      } else {
        add("hole:rail:+:top:1");
        add("hole:rail:-:top:1");
        add("hole:rail:+:bottom:1");
        add("hole:rail:-:bottom:1");
      }
    }

    var pinRefs = ["5V", "3V3", "GND", "GND2", "GND3", "VIN", "RESET", "IOREF", "AREF", "ICSP_MOSI", "ICSP_MISO", "ICSP_SCK"];
    var di;
    for (di = 0; di <= 13; di++) pinRefs.push("D" + di);
    for (di = 0; di <= 5; di++) pinRefs.push("A" + di);
    pinRefs.forEach(add);
    pinRefs.forEach(function (ref) { add("pin:" + ref); });
    union("pin:GND", "pin:GND2");
    union("pin:GND", "pin:GND3");
    if (board === "uno") {
      union("pin:ICSP_MOSI", "pin:D11");
      union("pin:ICSP_MISO", "pin:D12");
      union("pin:ICSP_SCK", "pin:D13");
    }

    var components = (project && project.components) || [];
    var modules = (project && project.modules) || [];
    var wires = (project && project.wires) || [];
    var footprints = {};

    components.forEach(function (comp) {
      var fp = footprint(comp.type, comp.anchor, comp.rotation || 0);
      footprints[comp.id] = fp;
      if (!fp.ok) return;
      fp.terminals.forEach(function (term) {
        union("hole:" + term.hole, "hole:" + term.hole);
      });
      (fp.bridges || []).forEach(function (pair) {
        union("hole:" + pair[0], "hole:" + pair[1]);
      });
    });

    modules.forEach(function (mod) {
      var terms = moduleTerminals(mod.type) || [];
      terms.forEach(function (term) {
        add("mod:" + mod.id + ":" + term.id);
      });
    });

    function endNode(end) {
      if (!end) return "";
      if (end.kind === "pin") return "pin:" + end.ref;
      if (end.kind === "module") return "mod:" + end.ref;
      return "hole:" + end.ref;
    }

    wires.forEach(function (wire) {
      if (!wire.from || !wire.to) return;
      union(endNode(wire.from), endNode(wire.to));
    });

    var usedRoot = {};
    wires.forEach(function (wire) {
      if (!wire.from || !wire.to) return;
      usedRoot[find(endNode(wire.from))] = true;
      usedRoot[find(endNode(wire.to))] = true;
    });

    function nodesIn(root, pred) {
      var out = [];
      Object.keys(parent).forEach(function (id) {
        if (find(id) === root && pred(id)) out.push(id);
      });
      return out;
    }

    function rootHasSupply(root) {
      if (find("pin:5V") === root) return true;
      for (di = 0; di <= 13; di++) if (find("pin:D" + di) === root) return true;
      for (di = 0; di <= 5; di++) if (find("pin:A" + di) === root) return true;
      return false;
    }

    function resistorIn(root) {
      for (var i = 0; i < components.length; i++) {
        var comp = components[i];
        if (comp.type !== "resistor") continue;
        var fp = footprints[comp.id];
        if (!fp || !fp.ok) continue;
        if (find("hole:" + fp.holes.a) === root || find("hole:" + fp.holes.b) === root) return true;
      }
      return false;
    }

    var connections = {};
    var signalsByRoot = {};

    function noteSignal(node, signalId) {
      var root = find(node);
      if (!signalsByRoot[root]) signalsByRoot[root] = [];
      signalsByRoot[root].push(signalId);
    }

    function labelsFor(node) {
      var root = find(node);
      var labels = [];
      pinRefs.forEach(function (ref) {
        if (find("pin:" + ref) === root) labels.push(displayPin(ref, board));
      });
      return uniqueSorted(labels);
    }

    components.forEach(function (comp) {
      var fp = footprints[comp.id];
      if (!fp || !fp.ok) return;
      fp.terminals.forEach(function (term) {
        var node = "hole:" + term.hole;
        connections[comp.id + ":" + term.id] = labelsFor(node);
        if (term.signal) noteSignal(node, comp.id + ":" + term.id);
      });
    });

    modules.forEach(function (mod) {
      var terms = moduleTerminals(mod.type) || [];
      terms.forEach(function (term) {
        var node = "mod:" + mod.id + ":" + term.id;
        connections[mod.id + ":" + term.id] = labelsFor(node);
        if (term.signal) noteSignal(node, mod.id + ":" + term.id);
      });
    });

    var alerts = [];
    var conflictSeen = {};
    var rootsSeen = {};
    Object.keys(parent).forEach(function (id) {
      var root = find(id);
      if (rootsSeen[root]) return;
      rootsSeen[root] = true;
      var pinsHere = [];
      pinRefs.forEach(function (ref) {
        if (find("pin:" + ref) !== root) return;
        var cid = conflictId(ref, board);
        if (cid && pinsHere.indexOf(cid) === -1) pinsHere.push(cid);
      });
      var sigs = signalsByRoot[root] || [];
      if (pinsHere.length >= 2) {
        pinsHere.forEach(function (pin) {
          if (!conflictSeen[pin]) {
            conflictSeen[pin] = true;
            alerts.push({ level: "danger", id: "pin-conflict", pin: pin });
          }
        });
      } else if (pinsHere.length === 1 && sigs.length >= 2) {
        var pinOne = pinsHere[0];
        if (!conflictSeen[pinOne]) {
          conflictSeen[pinOne] = true;
          alerts.push({ level: "danger", id: "pin-conflict", pin: pinOne });
        }
      }
    });
    alerts.sort(function (a, b) { return pinSortKey(a.pin) - pinSortKey(b.pin); });

    var plusRoots = [find("pin:5V"), find("hole:rail:+:top:1"), find("hole:rail:+:bottom:1")];
    var minusRoots = [find("pin:GND"), find("hole:rail:-:top:1"), find("hole:rail:-:bottom:1")];
    var v3 = find("pin:3V3");
    var railShort = plusRoots.some(function (pr) { return minusRoots.indexOf(pr) !== -1; });
    var vShort = plusRoots.indexOf(v3) !== -1;
    if (railShort) alerts.push({ level: "danger", id: "rail-short" });
    if (vShort) alerts.push({ level: "danger", id: "3v3-5v-short" });

    var ledCount = 0;
    components.forEach(function (comp) {
      if (comp.type !== "led") return;
      var fp = footprints[comp.id];
      if (!fp || !fp.ok) return;
      var anode = find("hole:" + fp.holes.anode);
      var cathode = find("hole:" + fp.holes.cathode);
      if (!rootHasSupply(anode) && !rootHasSupply(cathode)) return;
      if (!resistorIn(anode) && !resistorIn(cathode)) ledCount += 1;
    });
    if (ledCount === 1) alerts.push({ level: "hint", id: "led-no-resistor", count: 1 });
    if (ledCount > 1) alerts.push({ level: "hint", id: "led-no-resistor", count: ledCount });

    function pinUsed(ref) {
      return !!usedRoot[find("pin:" + ref)];
    }
    if (pinUsed("D0") || pinUsed("D1")) alerts.push({ level: "hint", id: "serial-pins" });
    if (pinUsed("D13")) alerts.push({ level: "hint", id: "pin13-led" });
    var i2c = i2cPins(board);
    if (pinUsed(i2c[0]) || pinUsed(i2c[1])) alerts.push({ level: "hint", id: "i2c-occupied" });

    return {
      board: board,
      connections: connections,
      alerts: alerts,
      find: find
    };
  }

  function occupiedMap(components, ignoreId) {
    var map = {};
    (components || []).forEach(function (comp) {
      if (comp.id === ignoreId) return;
      var fp = footprint(comp.type, comp.anchor, comp.rotation || 0);
      if (!fp.ok) return;
      Object.keys(fp.holes).forEach(function (key) {
        map[fp.holes[key]] = comp.id;
      });
    });
    return map;
  }

  function collides(components, fp, ignoreId) {
    if (!fp || !fp.ok) return true;
    var occ = occupiedMap(components, ignoreId);
    return Object.keys(fp.holes).some(function (key) { return !!occ[fp.holes[key]]; });
  }

  function countType(project, type) {
    var n = 0;
    (project.components || []).forEach(function (c) { if (c.type === type) n += 1; });
    (project.modules || []).forEach(function (m) { if (m.type === type) n += 1; });
    return n;
  }

  function slotTaken(project, slot, ignoreId) {
    return (project.modules || []).some(function (m) {
      return m.slot === slot && m.id !== ignoreId;
    });
  }

  function normalizeEnd(end) {
    if (!end || typeof end.ref !== "string" || typeof end.kind !== "string") return null;
    var kind = end.kind;
    var ref = end.ref;
    if (kind === "hole" && ref.indexOf("rail:") === 0) kind = "rail";
    if (kind === "hole") {
      if (!parseHole(ref)) return null;
      return { kind: "hole", ref: ref };
    }
    if (kind === "rail") {
      if (!/^rail:[+-]:(top|bottom):([1-9]|[12]\d|30)$/.test(ref)) return null;
      return { kind: "rail", ref: ref };
    }
    if (kind === "pin") {
      if (!/^(D([0-9]|1[0-3])|A[0-5]|5V|3V3|GND2?|GND3|VIN|RESET|IOREF|AREF|ICSP_MOSI|ICSP_MISO|ICSP_SCK)$/.test(ref)) return null;
      return { kind: "pin", ref: ref };
    }
    if (kind === "module") {
      if (!/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(ref)) return null;
      return { kind: "module", ref: ref };
    }
    return null;
  }

  function cleanProps(type, props) {
    var src = props && typeof props === "object" ? props : {};
    if (type === "led") {
      var color = LED_COLORS.indexOf(src.color) !== -1 ? src.color : "red";
      return { color: color };
    }
    if (type === "resistor") {
      var value = RESISTOR_VALUES.indexOf(String(src.value)) !== -1 ? String(src.value) : "220";
      return { value: value };
    }
    return {};
  }

  function validateProject(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false };
    if (data.version !== 1) return { ok: false };
    if (data.board !== "uno" && data.board !== "leonardo") return { ok: false };
    if (data.components != null && !Array.isArray(data.components)) return { ok: false };
    if (data.modules != null && !Array.isArray(data.modules)) return { ok: false };
    if (data.wires != null && !Array.isArray(data.wires)) return { ok: false };
    var ids = {};
    function takeId(id, prefix) {
      var clean = typeof id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : "";
      if (!clean || ids[clean]) {
        var n = 1;
        while (ids[prefix + n]) n += 1;
        clean = prefix + n;
      }
      ids[clean] = true;
      return clean;
    }
    var components = [];
    (data.components || []).forEach(function (raw) {
      if (!raw || !partById(raw.type) || partById(raw.type).place !== "board") return;
      var rot = raw.rotation || 0;
      var fp = footprint(raw.type, raw.anchor, rot);
      if (!fp.ok) return;
      if (collides(components, fp, null)) return;
      var name = typeof raw.name === "string" ? raw.name.trim().slice(0, 20) : "";
      components.push({
        id: takeId(raw.id, "c"),
        type: raw.type,
        anchor: raw.anchor,
        rotation: rot,
        props: cleanProps(raw.type, raw.props),
        name: name
      });
    });
    var modules = [];
    var usedSlots = {};
    (data.modules || []).forEach(function (raw) {
      if (!raw || !partById(raw.type) || partById(raw.type).place !== "module") return;
      if (!moduleTerminals(raw.type)) return;
      var slot = raw.slot;
      if (typeof slot !== "number" || slot < 0 || slot >= MAX_SLOTS || usedSlots[slot]) return;
      var limit = partById(raw.type).limit;
      var have = modules.filter(function (m) { return m.type === raw.type; }).length;
      if (have >= limit) return;
      usedSlots[slot] = true;
      var name = typeof raw.name === "string" ? raw.name.trim().slice(0, 20) : "";
      modules.push({
        id: takeId(raw.id, "m"),
        type: raw.type,
        slot: slot,
        props: {},
        name: name
      });
    });
    var knownMod = {};
    modules.forEach(function (m) {
      (moduleTerminals(m.type) || []).forEach(function (term) {
        knownMod[m.id + ":" + term.id] = true;
      });
    });
    var wires = [];
    var wireSeen = {};
    (data.wires || []).forEach(function (raw) {
      if (!raw) return;
      var from = normalizeEnd(raw.from);
      var to = normalizeEnd(raw.to);
      if (!from || !to || sameEnd(from, to)) return;
      if (from.kind === "module" && !knownMod[from.ref]) return;
      if (to.kind === "module" && !knownMod[to.ref]) return;
      var color = WIRE_COLORS.indexOf(raw.color) !== -1 ? raw.color : "yellow";
      var wire = { id: takeId(raw.id, "w"), from: from, to: to, color: color };
      var key = wireKey(wire);
      if (wireSeen[key]) return;
      wireSeen[key] = true;
      wires.push(wire);
    });
    var name = typeof data.name === "string" ? data.name.trim().slice(0, 60) : "";
    var view = data.view && typeof data.view === "object" ? data.view : {};
    var zoom = typeof view.zoom === "number" ? view.zoom : 1;
    if (zoom < 0.5) zoom = 0.5;
    if (zoom > 2) zoom = 2;
    return {
      ok: true,
      project: {
        version: 1,
        id: typeof data.id === "string" && data.id ? data.id : "",
        name: name,
        board: data.board,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
        components: components,
        modules: modules,
        wires: wires,
        view: {
          zoom: zoom,
          panX: typeof view.panX === "number" ? view.panX : 0,
          panY: typeof view.panY === "number" ? view.panY : 0
        }
      }
    };
  }

  root.BreadboardData = {
    ROWS: ROWS,
    COLS: COLS,
    MAX_SLOTS: MAX_SLOTS,
    PARTS: PARTS,
    WIRE_COLORS: WIRE_COLORS,
    LED_COLORS: LED_COLORS,
    RESISTOR_VALUES: RESISTOR_VALUES,
    partById: partById,
    parseHole: parseHole,
    footprint: footprint,
    moduleTerminals: moduleTerminals,
    defaultProps: defaultProps,
    pinLayout: pinLayout,
    icspLayout: icspLayout,
    i2cPins: i2cPins,
    autoWireColor: autoWireColor,
    sameEnd: sameEnd,
    wireKey: wireKey,
    displayPin: displayPin,
    analyze: analyze,
    occupiedMap: occupiedMap,
    collides: collides,
    countType: countType,
    slotTaken: slotTaken,
    validateProject: validateProject
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
