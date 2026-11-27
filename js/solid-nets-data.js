/**
 * Solid Nets — geometry, net catalogue, and paper-model measurements.
 * Original classroom implementation. Net order is fixed (sorted), never random.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SolidNetsData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var FACE_COLORS = [
    "#4C78A8",
    "#F58518",
    "#E45756",
    "#72B7B2",
    "#54A24B",
    "#EECA3B",
    "#B279A2",
    "#FF9D98",
  ];
  var TAB_CM = 0.5;
  var EPS = 1e-4;

  function hypot3(x, y, z) {
    return Math.hypot(x, y, z);
  }
  function sub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }
  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }
  function norm(a) {
    var l = hypot3(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  function near3(a, b) {
    return hypot3(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6;
  }
  function newell(verts) {
    var nx = 0, ny = 0, nz = 0, i, a, b;
    for (i = 0; i < verts.length; i++) {
      a = verts[i];
      b = verts[(i + 1) % verts.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return norm([nx, ny, nz]);
  }
  function signedArea(poly) {
    var a = 0, i, p, q;
    for (i = 0; i < poly.length; i++) {
      p = poly[i];
      q = poly[(i + 1) % poly.length];
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  }
  function shapeKey(poly) {
    var lens = [], i, a, b;
    for (i = 0; i < poly.length; i++) {
      a = poly[i];
      b = poly[(i + 1) % poly.length];
      lens.push(Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 100) / 100);
    }
    lens.sort(function (x, y) { return x - y; });
    return lens.join(",");
  }
  function linChan(c) {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function relLuma(hex) {
    var n = hex.replace("#", "");
    var r = linChan(parseInt(n.slice(0, 2), 16));
    var g = linChan(parseInt(n.slice(2, 4), 16));
    var b = linChan(parseInt(n.slice(4, 6), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function labelInk(hex) {
    var L = relLuma(hex);
    var navy = relLuma("#0D1B2A");
    var white = relLuma("#FFFFFF");
    var cNavy = (Math.max(L, navy) + 0.05) / (Math.min(L, navy) + 0.05);
    var cWhite = (Math.max(L, white) + 0.05) / (Math.min(L, white) + 0.05);
    return cWhite > cNavy ? "#FFFFFF" : "#0D1B2A";
  }
  function faceColor(no) {
    return FACE_COLORS[(no - 1) % FACE_COLORS.length];
  }

  function centerFaces(raw) {
    var uniq = [], i, j, v, found, c;
    for (i = 0; i < raw.length; i++) {
      for (j = 0; j < raw[i].length; j++) {
        v = raw[i][j];
        found = false;
        for (c = 0; c < uniq.length; c++) {
          if (near3(uniq[c], v)) { found = true; break; }
        }
        if (!found) uniq.push(v);
      }
    }
    var cx = 0, cy = 0, cz = 0;
    for (i = 0; i < uniq.length; i++) {
      cx += uniq[i][0]; cy += uniq[i][1]; cz += uniq[i][2];
    }
    cx /= uniq.length; cy /= uniq.length; cz /= uniq.length;
    return raw.map(function (face) {
      return face.map(function (p) {
        return [p[0] - cx, p[1] - cy, p[2] - cz];
      });
    });
  }

  function toPoly2(verts, n) {
    var o = verts[0];
    var ux = verts[1][0] - o[0], uy = verts[1][1] - o[1], uz = verts[1][2] - o[2];
    var nd = ux * n[0] + uy * n[1] + uz * n[2];
    ux -= nd * n[0]; uy -= nd * n[1]; uz -= nd * n[2];
    var ul = hypot3(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    var vx = n[1] * uz - n[2] * uy;
    var vy = n[2] * ux - n[0] * uz;
    var vz = n[0] * uy - n[1] * ux;
    return verts.map(function (p) {
      var dx = p[0] - o[0], dy = p[1] - o[1], dz = p[2] - o[2];
      return { x: dx * ux + dy * uy + dz * uz, y: dx * vx + dy * vy + dz * vz };
    });
  }

  function frameOf(verts) {
    var o = verts[0];
    var n = newell(verts);
    var ux = verts[1][0] - o[0], uy = verts[1][1] - o[1], uz = verts[1][2] - o[2];
    var nd = ux * n[0] + uy * n[1] + uz * n[2];
    ux -= nd * n[0]; uy -= nd * n[1]; uz -= nd * n[2];
    var ul = hypot3(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    var vx = n[1] * uz - n[2] * uy;
    var vy = n[2] * ux - n[0] * uz;
    var vz = n[0] * uy - n[1] * ux;
    return {
      n: n,
      toLocal: function (p) {
        var dx = p[0] - o[0], dy = p[1] - o[1], dz = p[2] - o[2];
        return {
          x: dx * ux + dy * uy + dz * uz,
          y: dx * vx + dy * vy + dz * vz,
          z: dx * n[0] + dy * n[1] + dz * n[2],
        };
      },
      toWorld: function (p) {
        return [
          o[0] + p.x * ux + p.y * vx + p.z * n[0],
          o[1] + p.x * uy + p.y * vy + p.z * n[1],
          o[2] + p.x * uz + p.y * vz + p.z * n[2],
        ];
      },
    };
  }

  function finalizePoly(id, params, rawFaces) {
    var shifted = centerFaces(rawFaces);
    var uniq = [], i, j, v, found;
    for (i = 0; i < shifted.length; i++) {
      for (j = 0; j < shifted[i].length; j++) {
        v = shifted[i][j];
        found = false;
        for (var c = 0; c < uniq.length; c++) if (near3(uniq[c], v)) { found = true; break; }
        if (!found) uniq.push(v);
      }
    }
    var centroid = [0, 0, 0];
    for (i = 0; i < uniq.length; i++) {
      centroid[0] += uniq[i][0]; centroid[1] += uniq[i][1]; centroid[2] += uniq[i][2];
    }
    centroid[0] /= uniq.length; centroid[1] /= uniq.length; centroid[2] /= uniq.length;

    var faces = shifted.map(function (verts, index) {
      var nrm = newell(verts);
      var cface = [0, 0, 0];
      for (var k = 0; k < verts.length; k++) {
        cface[0] += verts[k][0]; cface[1] += verts[k][1]; cface[2] += verts[k][2];
      }
      cface = cface.map(function (x) { return x / verts.length; });
      if (dot(nrm, sub(cface, centroid)) < 0) verts = verts.slice().reverse();
      nrm = newell(verts);
      var poly2 = toPoly2(verts, nrm);
      if (signedArea(poly2) < 0) poly2 = poly2.map(function (p) { return { x: p.x, y: -p.y }; });
      var edges = poly2.map(function (_, k) { return { i: k, j: (k + 1) % poly2.length }; });
      return {
        index: index,
        no: index + 1,
        verts3: verts,
        poly2: poly2,
        edges: edges,
        shapeKey: shapeKey(poly2),
      };
    });

    var adj = [];
    for (i = 0; i < faces.length; i++) {
      for (j = i + 1; j < faces.length; j++) {
        var ea, eb, matched = false;
        for (ea = 0; ea < faces[i].edges.length && !matched; ea++) {
          var e1 = faces[i].edges[ea];
          var a1 = faces[i].verts3[e1.i], b1 = faces[i].verts3[e1.j];
          for (eb = 0; eb < faces[j].edges.length; eb++) {
            var e2 = faces[j].edges[eb];
            var a2 = faces[j].verts3[e2.i], b2 = faces[j].verts3[e2.j];
            if ((near3(a1, a2) && near3(b1, b2)) || (near3(a1, b2) && near3(b1, a2))) {
              adj.push({ a: i, b: j, ea: ea, eb: eb });
              matched = true;
              break;
            }
          }
        }
      }
    }

    var key = id + ":" + Object.keys(params).sort().map(function (k) {
      return k + "=" + params[k];
    }).join(",");
    return { kind: "poly", id: id, params: params, faces: faces, adj: adj, cacheKey: key };
  }

  function square(a) {
    var h = a / 2;
    return [{ x: -h, y: -h }, { x: h, y: -h }, { x: h, y: h }, { x: -h, y: h }];
  }
  function equilateral(a) {
    var R = a / Math.sqrt(3);
    var pts = [], i, th;
    for (i = 0; i < 3; i++) {
      th = -Math.PI / 2 + i * (2 * Math.PI / 3);
      pts.push({ x: R * Math.cos(th), y: R * Math.sin(th) });
    }
    if (signedArea(pts) < 0) pts.reverse();
    return pts;
  }
  function trapezoid(a, b, c) {
    var overhang = (a - b) / 2;
    if (!(a > b) || c <= overhang + 1e-8) return null;
    var ht = Math.sqrt(Math.max(0, c * c - overhang * overhang));
    if (ht < 1e-6) return null;
    var y0 = -ht / 2, y1 = ht / 2;
    return [
      { x: -a / 2, y: y0 },
      { x: a / 2, y: y0 },
      { x: b / 2, y: y1 },
      { x: -b / 2, y: y1 },
    ];
  }
  function prism(base, height) {
    var n = base.length;
    var bot = base.map(function (p) { return [p.x, p.y, -height / 2]; });
    var top = base.map(function (p) { return [p.x, p.y, height / 2]; });
    var faces = [bot.slice().reverse(), top.slice()];
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      faces.push([bot[i], bot[j], top[j], top[i]]);
    }
    return faces;
  }
  function pyramid(base, height) {
    var bot = base.map(function (p) { return [p.x, p.y, 0]; });
    var apex = [0, 0, height];
    var faces = [bot.slice().reverse()];
    for (var i = 0; i < bot.length; i++) {
      var j = (i + 1) % bot.length;
      faces.push([bot[i], bot[j], apex]);
    }
    return faces;
  }

  function rawSolid(id, p) {
    if (id === "cube") return prism(square(p.a), p.a);
    if (id === "cuboid") {
      var hx = p.a / 2, hy = p.b / 2;
      return prism([
        { x: -hx, y: -hy },
        { x: hx, y: -hy },
        { x: hx, y: hy },
        { x: -hx, y: hy },
      ], p.c);
    }
    if (id === "tri-prism") return prism(equilateral(p.a), p.h);
    if (id === "quad-prism") {
      var trap = trapezoid(p.a, p.b, p.c);
      if (!trap) return null;
      return prism(trap, p.h);
    }
    if (id === "tri-pyramid") return pyramid(equilateral(p.a), p.h);
    if (id === "quad-pyramid") return pyramid(square(p.a), p.h);
    if (id === "tetrahedron") return pyramid(equilateral(p.a), Math.sqrt(6) / 3 * p.a);
    if (id === "octahedron") {
      var s = p.a / Math.SQRT2;
      var faces = [], sx, sy, sz;
      for (sx = -1; sx <= 1; sx += 2) {
        for (sy = -1; sy <= 1; sy += 2) {
          for (sz = -1; sz <= 1; sz += 2) {
            faces.push([[sx * s, 0, 0], [0, sy * s, 0], [0, 0, sz * s]]);
          }
        }
      }
      return faces;
    }
    return null;
  }

  function buildCylinder(p) {
    var r = p.r, h = p.h;
    var w = 2 * Math.PI * r;
    return {
      kind: "cylinder",
      id: "cylinder",
      params: { r: r, h: h },
      r: r, h: h, w: w,
      cacheKey: "cylinder:r=" + r + ",h=" + h,
      faces: [
        { no: 1, shapeKey: "cyl-side" },
        { no: 2, shapeKey: "cyl-top" },
        { no: 3, shapeKey: "cyl-bot" },
      ],
    };
  }
  function buildCone(p) {
    var r = p.r, h = p.h;
    var l = Math.sqrt(r * r + h * h);
    if (!(l > r)) return null;
    return {
      kind: "cone",
      id: "cone",
      params: { r: r, h: h },
      r: r, h: h, l: l,
      alpha: (2 * Math.PI * r) / l,
      cacheKey: "cone:r=" + r + ",h=" + h,
      faces: [
        { no: 1, shapeKey: "cone-side" },
        { no: 2, shapeKey: "cone-base" },
      ],
    };
  }

  function build(id, params) {
    if (id === "cylinder") return buildCylinder(params);
    if (id === "cone") return buildCone(params);
    var raw = rawSolid(id, params);
    if (!raw) return null;
    return finalizePoly(id, params, raw);
  }

  function mapPoly(childPoly, childEdge, parentPts, parentEdge) {
    var A = parentPts[parentEdge.i];
    var B = parentPts[parentEdge.j];
    var C0 = childPoly[childEdge.i];
    var C1 = childPoly[childEdge.j];
    var sy = C1.y - C0.y, sx = C1.x - C0.x;
    var dy = A.y - B.y, dx = A.x - B.x;
    var ang = Math.atan2(dy, dx) - Math.atan2(sy, sx);
    var c = Math.cos(ang), s = Math.sin(ang);
    return childPoly.map(function (pt) {
      var x = pt.x - C0.x, y = pt.y - C0.y;
      return { x: B.x + x * c - y * s, y: B.y + x * s + y * c };
    });
  }

  function treeAdj(model, edgeIdxs) {
    var g = model.faces.map(function () { return []; });
    edgeIdxs.forEach(function (ei) {
      var e = model.adj[ei];
      g[e.a].push({ face: e.b, parentEdge: e.ea, childEdge: e.eb });
      g[e.b].push({ face: e.a, parentEdge: e.eb, childEdge: e.ea });
    });
    return g;
  }

  function layoutNet(model, edgeIdxs) {
    var n = model.faces.length;
    var placed = new Array(n);
    placed[0] = model.faces[0].poly2.map(function (pt) { return { x: pt.x, y: pt.y }; });
    var g = treeAdj(model, edgeIdxs);
    var seen = new Set([0]);
    var q = [0];
    while (q.length) {
      var u = q.shift();
      for (var k = 0; k < g[u].length; k++) {
        var nb = g[u][k];
        if (seen.has(nb.face)) continue;
        placed[nb.face] = mapPoly(
          model.faces[nb.face].poly2,
          model.faces[nb.face].edges[nb.childEdge],
          placed[u],
          model.faces[u].edges[nb.parentEdge]
        );
        seen.add(nb.face);
        q.push(nb.face);
      }
    }
    if (seen.size !== n) return null;
    if (anyOverlap(placed)) return null;
    if (!anglesOpen(placed)) return null;
    return placed;
  }

  function interiorAngle(poly, i) {
    var n = poly.length;
    var prev = poly[(i - 1 + n) % n];
    var cur = poly[i];
    var next = poly[(i + 1) % n];
    var inx = cur.x - prev.x, iny = cur.y - prev.y;
    var outx = next.x - cur.x, outy = next.y - cur.y;
    var turn = Math.atan2(inx * outy - iny * outx, inx * outx + iny * outy);
    return Math.PI - turn;
  }

  function anglesOpen(placed) {
    var buckets = [], i, k, poly, b, ang, found;
    for (i = 0; i < placed.length; i++) {
      poly = placed[i];
      if (!poly) continue;
      for (k = 0; k < poly.length; k++) {
        ang = interiorAngle(poly, k);
        found = null;
        for (b = 0; b < buckets.length; b++) {
          if (Math.hypot(buckets[b].x - poly[k].x, buckets[b].y - poly[k].y) < 1e-3) {
            found = buckets[b];
            break;
          }
        }
        if (!found) {
          found = { x: poly[k].x, y: poly[k].y, sum: 0 };
          buckets.push(found);
        }
        found.sum += ang;
      }
    }
    for (b = 0; b < buckets.length; b++) {
      if (buckets[b].sum >= Math.PI * 2 - 1e-3) return false;
    }
    return true;
  }

  function proj(poly, ax, ay) {
    var min = Infinity, max = -Infinity, i, t;
    for (i = 0; i < poly.length; i++) {
      t = poly[i].x * ax + poly[i].y * ay;
      if (t < min) min = t;
      if (t > max) max = t;
    }
    return { min: min, max: max };
  }
  function polysOverlap(A, B) {
    var polys = [A, B], p, i, q, dx, dy, len, ax, ay, pa, pb, pen;
    for (p = 0; p < 2; p++) {
      for (i = 0; i < polys[p].length; i++) {
        q = polys[p][(i + 1) % polys[p].length];
        dx = q.x - polys[p][i].x;
        dy = q.y - polys[p][i].y;
        len = Math.hypot(dx, dy);
        if (len < 1e-12) continue;
        ax = -dy / len; ay = dx / len;
        pa = proj(A, ax, ay); pb = proj(B, ax, ay);
        pen = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
        if (pen <= EPS) return false;
      }
    }
    return true;
  }
  function anyOverlap(placed) {
    var ids = [], a, b;
    for (a = 0; a < placed.length; a++) if (placed[a]) ids.push(a);
    for (a = 0; a < ids.length; a++) {
      for (b = a + 1; b < ids.length; b++) {
        if (polysOverlap(placed[ids[a]], placed[ids[b]])) return true;
      }
    }
    return false;
  }

  function automorphisms(model) {
    var n = model.faces.length;
    var adjM = [];
    for (var i = 0; i < n; i++) adjM.push(new Array(n).fill(false));
    model.adj.forEach(function (e) {
      adjM[e.a][e.b] = true;
      adjM[e.b][e.a] = true;
    });
    var shapes = model.faces.map(function (f) { return f.shapeKey; });
    var idx = [];
    for (i = 0; i < n; i++) idx.push(i);
    var autos = [];
    function keep(p) {
      var a, b;
      for (a = 0; a < n; a++) if (shapes[a] !== shapes[p[a]]) return;
      for (a = 0; a < n; a++) {
        for (b = a + 1; b < n; b++) {
          if (adjM[a][b] !== adjM[p[a]][p[b]]) return;
        }
      }
      autos.push(p.slice());
    }
    function heap(k) {
      if (k === 1) { keep(idx); return; }
      heap(k - 1);
      for (var t = 0; t < k - 1; t++) {
        var s = k % 2 === 0 ? t : 0;
        var tmp = idx[s];
        idx[s] = idx[k - 1];
        idx[k - 1] = tmp;
        heap(k - 1);
      }
    }
    heap(n);
    return autos;
  }

  function canonKey(model, edgeIdxs, autos) {
    var pairs = edgeIdxs.map(function (ei) {
      var e = model.adj[ei];
      return [e.a, e.b];
    });
    var best = null;
    autos.forEach(function (p) {
      var mapped = pairs.map(function (pair) {
        var x = p[pair[0]], y = p[pair[1]];
        return x < y ? x + ">" + y : y + ">" + x;
      });
      mapped.sort();
      var s = mapped.join("|");
      if (best === null || s < best) best = s;
    });
    return best;
  }

  function spanningTrees(n, adj) {
    var need = n - 1;
    var trees = [];
    var pick = [];
    function ok(list) {
      var p = [];
      for (var i = 0; i < n; i++) p.push(i);
      function find(x) { return p[x] === x ? x : (p[x] = find(p[x])); }
      for (var k = 0; k < list.length; k++) {
        var e = adj[list[k]];
        var a = find(e.a), b = find(e.b);
        if (a === b) return false;
        p[a] = b;
      }
      return true;
    }
    function rec(start) {
      if (pick.length === need) { trees.push(pick.slice()); return; }
      for (var i = start; i < adj.length; i++) {
        pick.push(i);
        if (ok(pick)) rec(i + 1);
        pick.pop();
      }
    }
    rec(0);
    return trees;
  }

  function treeKey(adj, idxs) {
    var parts = idxs.map(function (i) {
      var e = adj[i];
      var a = e.a < e.b ? e.a : e.b;
      var b = e.a < e.b ? e.b : e.a;
      return a + ">" + b;
    });
    parts.sort();
    return parts.join("|");
  }

  function distPointSeg(p, h0, h1) {
    var ax = h1.x - h0.x, ay = h1.y - h0.y, az = (h1.z || 0) - (h0.z || 0);
    var px = p.x - h0.x, py = p.y - h0.y, pz = (p.z || 0) - (h0.z || 0);
    var al2 = ax * ax + ay * ay + az * az || 1;
    var t = (px * ax + py * ay + pz * az) / al2;
    var dx = px - t * ax, dy = py - t * ay, dz = pz - t * az;
    return Math.hypot(dx, dy, dz);
  }
  function signedAngle(flat, folded, h0, h1) {
    function perp(p) {
      var ax = h1.x - h0.x, ay = h1.y - h0.y, az = h1.z - h0.z;
      var px = p.x - h0.x, py = p.y - h0.y, pz = (p.z || 0) - h0.z;
      var al2 = ax * ax + ay * ay + az * az || 1;
      var t = (px * ax + py * ay + pz * az) / al2;
      return { x: px - t * ax, y: py - t * ay, z: pz - t * az };
    }
    var a = perp(flat), b = perp(folded);
    var hx = h1.x - h0.x, hy = h1.y - h0.y, hz = h1.z - h0.z;
    var hl = Math.hypot(hx, hy, hz) || 1;
    var cx = a.y * b.z - a.z * b.y;
    var cy = a.z * b.x - a.x * b.z;
    var cz = a.x * b.y - a.y * b.x;
    var s = (cx * hx + cy * hy + cz * hz) / hl;
    var d = a.x * b.x + a.y * b.y + a.z * b.z;
    return Math.atan2(s, d);
  }
  function rotateAround(p, h0, h1, ang) {
    var ax = h1.x - h0.x, ay = h1.y - h0.y, az = h1.z - h0.z;
    var al = Math.hypot(ax, ay, az) || 1;
    var kx = ax / al, ky = ay / al, kz = az / al;
    var px = p.x - h0.x, py = p.y - h0.y, pz = (p.z || 0) - h0.z;
    var c = Math.cos(ang), s = Math.sin(ang);
    var dp = px * kx + py * ky + pz * kz;
    var cx = ky * pz - kz * py, cy = kz * px - kx * pz, cz = kx * py - ky * px;
    return {
      x: h0.x + px * c + cx * s + kx * dp * (1 - c),
      y: h0.y + py * c + cy * s + ky * dp * (1 - c),
      z: h0.z + pz * c + cz * s + kz * dp * (1 - c),
    };
  }

  function buildHinges(model, edgeIdxs) {
    var g = treeAdj(model, edgeIdxs);
    var parent = model.faces.map(function () { return -1; });
    var link = model.faces.map(function () { return null; });
    var seen = new Set([0]);
    var q = [0];
    while (q.length) {
      var u = q.shift();
      for (var k = 0; k < g[u].length; k++) {
        var nb = g[u][k];
        if (seen.has(nb.face)) continue;
        seen.add(nb.face);
        parent[nb.face] = u;
        link[nb.face] = nb;
        q.push(nb.face);
      }
    }
    var hinges = new Array(model.faces.length).fill(null);
    for (var f = 1; f < model.faces.length; f++) {
      var pidx = parent[f];
      var frame = frameOf(model.faces[pidx].verts3);
      var pLocal = model.faces[pidx].verts3.map(function (v) { return frame.toLocal(v); });
      var ce = model.faces[f].edges[link[f].childEdge];
      var pe = model.faces[pidx].edges[link[f].parentEdge];
      var flat2 = mapPoly(model.faces[f].poly2, ce, pLocal, pe);
      var flat = flat2.map(function (pt) { return { x: pt.x, y: pt.y, z: 0 }; });
      var h0 = { x: pLocal[pe.i].x, y: pLocal[pe.i].y, z: 0 };
      var h1 = { x: pLocal[pe.j].x, y: pLocal[pe.j].y, z: 0 };
      var probe = 0, best = -1, i;
      for (i = 0; i < flat.length; i++) {
        var d = distPointSeg(flat[i], h0, h1);
        if (d > best) { best = d; probe = i; }
      }
      var folded = frame.toLocal(model.faces[f].verts3[probe]);
      var theta = signedAngle(flat[probe], folded, h0, h1);
      hinges[f] = { parent: pidx, child: f, flat: flat, h0: h0, h1: h1, theta: theta };
    }
    return { parent: parent, hinges: hinges };
  }

  function posePoly(model, net, t) {
    var world = new Array(model.faces.length);
    world[0] = model.faces[0].verts3.map(function (v) { return v.slice(); });
    var kids = model.faces.map(function () { return []; });
    for (var i = 1; i < net.hinges.length; i++) {
      if (net.hinges[i]) kids[net.hinges[i].parent].push(i);
    }
    function rec(p) {
      var frame = frameOf(world[p]);
      for (var k = 0; k < kids[p].length; k++) {
        var ci = kids[p][k];
        var h = net.hinges[ci];
        var ang = h.theta * (1 - t);
        world[ci] = h.flat.map(function (pt) {
          return frame.toWorld(rotateAround(pt, h.h0, h.h1, ang));
        });
        rec(ci);
      }
    }
    rec(0);
    var polys = world.map(function (pts, idx) {
      var no = model.faces[idx].no;
      var fill = faceColor(no);
      return { no: no, pts: pts, fill: fill, ink: labelInk(fill) };
    });
    return { polys: polys };
  }

  var netCache = new Map();

  function enumeratePoly(model) {
    var autos = automorphisms(model);
    model.autos = autos;
    var trees = spanningTrees(model.faces.length, model.adj);
    var groups = new Map();
    for (var i = 0; i < trees.length; i++) {
      var idxs = trees[i];
      var placed = layoutNet(model, idxs);
      if (!placed) continue;
      var key = canonKey(model, idxs, autos);
      var raw = treeKey(model.adj, idxs);
      var prev = groups.get(key);
      if (!prev || raw < prev.rawKey) {
        groups.set(key, { treeKey: key, rawKey: raw, edgeIdxs: idxs.slice(), placed: placed });
      }
    }
    var nets = Array.from(groups.values());
    nets.sort(function (a, b) {
      if (a.treeKey < b.treeKey) return -1;
      if (a.treeKey > b.treeKey) return 1;
      return 0;
    });
    nets.forEach(function (net) {
      var prep = buildHinges(model, net.edgeIdxs);
      net.parent = prep.parent;
      net.hinges = prep.hinges;
      net.id = net.treeKey;
    });
    return nets;
  }

  function tabTrapezoid(p, q, width) {
    var dx = q.x - p.x, dy = q.y - p.y;
    var len = Math.hypot(dx, dy) || 1;
    var ux = dx / len, uy = dy / len;
    var nx = dy / len, ny = -dx / len;
    var inset = Math.min(width, len * 0.18);
    if (len - 2 * inset < width * 0.4) inset = Math.max(0, len * 0.08);
    var p2 = { x: p.x + ux * inset, y: p.y + uy * inset };
    var q2 = { x: q.x - ux * inset, y: q.y - uy * inset };
    return [
      p2,
      q2,
      { x: q2.x + nx * width, y: q2.y + ny * width },
      { x: p2.x + nx * width, y: p2.y + ny * width },
    ];
  }

  function polyGeom(model, net, withTabs) {
    var figures = net.placed.map(function (pts, idx) {
      var no = model.faces[idx].no;
      var fill = faceColor(no);
      return { no: no, kind: "poly", pts: pts.map(function (p) { return { x: p.x, y: p.y }; }), fill: fill, ink: labelInk(fill) };
    });
    var hinge = {};
    net.edgeIdxs.forEach(function (ei) {
      var e = model.adj[ei];
      var a = e.a < e.b ? e.a : e.b;
      var b = e.a < e.b ? e.b : e.a;
      hinge[a + ">" + b] = true;
    });
    var folds = [], cuts = [], tabs = [];
    model.adj.forEach(function (e) {
      var key = e.a + ">" + e.b;
      if (hinge[key]) {
        var pe = model.faces[e.a].edges[e.ea];
        var pa = net.placed[e.a][pe.i], pb = net.placed[e.a][pe.j];
        folds.push([{ x: pa.x, y: pa.y }, { x: pb.x, y: pb.y }]);
      }
    });
    for (var fi = 0; fi < model.faces.length; fi++) {
      var face = model.faces[fi];
      for (var ei = 0; ei < face.edges.length; ei++) {
        var mate = null, m;
        for (m = 0; m < model.adj.length; m++) {
          var e = model.adj[m];
          if (e.a === fi && e.ea === ei) mate = e;
          if (e.b === fi && e.eb === ei) mate = e;
        }
        if (!mate) continue;
        var mk = mate.a + ">" + mate.b;
        if (hinge[mk]) continue;
        var ed = face.edges[ei];
        var p = net.placed[fi][ed.i], q = net.placed[fi][ed.j];
        cuts.push([{ x: p.x, y: p.y }, { x: q.x, y: q.y }]);
        if (withTabs && fi === mate.a) tabs.push(tabTrapezoid(p, q, TAB_CM));
      }
    }
    return { figures: figures, folds: folds, cuts: cuts, tabs: tabs };
  }

  function cylinderNets(model) {
    var r = model.r, h = model.h, w = model.w;
    // 2πr is always longer than 4r, so both bases fit on one circumference edge
    // with a gap and still do not overlap.
    var spare = w - 4 * r;
    var gap = Math.max(0.4, Math.min(r * 0.45, spare * 0.28));
    var sep = 2 * r + gap;
    function onRim(no, edgeY, outward, cx) {
      return {
        no: no,
        cx: cx,
        cy: edgeY + outward * r,
        edgeY: edgeY,
        outward: outward,
      };
    }
    function base(side) {
      var rect = [
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 },
      ];
      var circles = side === "A"
        ? [onRim(2, h / 2, 1, -sep / 2), onRim(3, h / 2, 1, sep / 2)]
        : [onRim(2, h / 2, 1, 0), onRim(3, -h / 2, -1, 0)];
      return { rect: rect, circles: circles, side: side };
    }
    return [base("A"), base("B")].map(function (spec) {
      return {
        id: "cyl-" + spec.side,
        treeKey: "cyl-" + spec.side,
        rawKey: "cyl-" + spec.side,
        round: spec,
      };
    });
  }

  function coneNets(model) {
    return [{ id: "cone", treeKey: "cone", rawKey: "cone", round: { alpha: model.alpha, l: model.l, r: model.r } }];
  }

  function roundGeom(model, net, withTabs) {
    var figures = [], folds = [], cuts = [], tabs = [];
    if (model.kind === "cylinder") {
      var spec = net.round;
      var fill1 = faceColor(1);
      figures.push({ no: 1, kind: "poly", pts: spec.rect.map(function (p) { return { x: p.x, y: p.y }; }), fill: fill1, ink: labelInk(fill1) });
      var lift = withTabs ? TAB_CM : 0;
      spec.circles.forEach(function (c) {
        var fill = faceColor(c.no);
        figures.push({
          no: c.no, kind: "circle",
          cx: c.cx, cy: c.cy + c.outward * lift, r: model.r,
          fill: fill, ink: labelInk(fill),
        });
      });
      var rect = spec.rect;
      // Short edges are the seam (a cut that is glued), not a fold.
      // Long edges are the circular rims; the bases glue to them.
      cuts.push([rect[0], rect[1]], [rect[2], rect[3]], [rect[3], rect[0]], [rect[1], rect[2]]);
      if (withTabs) {
        tabs.push(tabTrapezoid(rect[1], rect[2], TAB_CM));
        spec.circles.forEach(function (c) {
          var room = model.w / 2 - Math.abs(c.cx) - 0.15;
          var half = Math.min(model.r * 0.85, Math.max(0.6, room));
          var y0 = c.edgeY;
          var y1 = c.edgeY + c.outward * TAB_CM;
          var inset = Math.min(0.18, half * 0.22);
          tabs.push([
            { x: c.cx - half, y: y0 },
            { x: c.cx + half, y: y0 },
            { x: c.cx + half - inset, y: y1 },
            { x: c.cx - half + inset, y: y1 },
          ]);
        });
      }
      return { figures: figures, folds: folds, cuts: cuts, tabs: tabs };
    }
    var alpha = model.alpha, l = model.l, r = model.r;
    var a0 = -Math.PI / 2 - alpha / 2;
    var a1 = -Math.PI / 2 + alpha / 2;
    var fillS = faceColor(1);
    figures.push({
      no: 1, kind: "sector", ax: 0, ay: 0, r: l, a0: a0, a1: a1,
      fill: fillS, ink: labelInk(fillS),
    });
    var mid = -Math.PI / 2;
    var arc = { x: l * Math.cos(mid), y: l * Math.sin(mid) };
    var dir = { x: Math.cos(mid), y: Math.sin(mid) };
    var fillB = faceColor(2);
    var cy = arc.y + dir.y * (TAB_CM + r);
    var cx = arc.x + dir.x * (TAB_CM + r);
    figures.push({ no: 2, kind: "circle", cx: cx, cy: cy, r: r, fill: fillB, ink: labelInk(fillB) });
    var steps = 48, s;
    var seam0 = { x: l * Math.cos(a0), y: l * Math.sin(a0) };
    var seam1 = { x: l * Math.cos(a1), y: l * Math.sin(a1) };
    folds.push([{ x: 0, y: 0 }, seam0], [{ x: 0, y: 0 }, seam1]);
    var prev = seam0;
    for (s = 1; s <= steps; s++) {
      var a = a0 + (a1 - a0) * (s / steps);
      var cur = { x: l * Math.cos(a), y: l * Math.sin(a) };
      cuts.push([prev, cur]);
      prev = cur;
    }
    if (withTabs) {
      tabs.push(tabTrapezoid({ x: 0, y: 0 }, seam1, TAB_CM));
      var tangent = { x: -dir.y, y: dir.x };
      var half = Math.min(r * 0.8, 1.5);
      var tp = { x: arc.x - tangent.x * half, y: arc.y - tangent.y * half };
      var tq = { x: arc.x + tangent.x * half, y: arc.y + tangent.y * half };
      var outwardIsRight = (tq.x - tp.x) * dir.y - (tq.y - tp.y) * dir.x;
      if (outwardIsRight < 0) tabs.push(tabTrapezoid(tq, tp, TAB_CM));
      else tabs.push(tabTrapezoid(tp, tq, TAB_CM));
    }
    return { figures: figures, folds: folds, cuts: cuts, tabs: tabs };
  }

  function netsFor(model) {
    if (!model) return [];
    if (netCache.has(model.cacheKey)) return netCache.get(model.cacheKey);
    var nets;
    if (model.kind === "cylinder") nets = cylinderNets(model);
    else if (model.kind === "cone") nets = coneNets(model);
    else nets = enumeratePoly(model);
    netCache.set(model.cacheKey, nets);
    return nets;
  }

  function geometry(model, net, withTabs) {
    if (!model || !net) return { figures: [], folds: [], cuts: [], tabs: [] };
    if (model.kind === "poly") return polyGeom(model, net, withTabs);
    return roundGeom(model, net, withTabs);
  }

  function poseRound(model, net, t) {
    var polys = [];
    var segs = 40, i, f, s0, s1;
    if (model.kind === "cylinder") {
      var r = model.r, h = model.h, w = model.w;
      var open = 1 - t;
      function wall(u, y) {
        if (open < 1e-4) return [u, y, 0];
        var R = r / open;
        var phi = (u / r) * open;
        return [R * Math.sin(phi), y, R * (Math.cos(phi) - 1) + r * open];
      }
      var fill = faceColor(1);
      for (i = 0; i < segs; i++) {
        var u0 = -w / 2 + (w * i) / segs;
        var u1 = -w / 2 + (w * (i + 1)) / segs;
        var edges = [0, 2];
        if (i === 0) edges.push(3);
        if (i === segs - 1) edges.push(1);
        polys.push({
          no: 1, fill: fill, ink: labelInk(fill), part: true,
          strokeEdges: edges,
          pts: [wall(u0, -h / 2), wall(u1, -h / 2), wall(u1, h / 2), wall(u0, h / 2)],
        });
      }
      net.round.circles.forEach(function (c) {
        var flatC = [c.cx, c.cy, 0];
        var foldedC, normalFold;
        if (c.no === 2) { foldedC = [0, h / 2, 0]; normalFold = [0, 1, 0]; }
        else { foldedC = [0, -h / 2, 0]; normalFold = [0, -1, 0]; }
        var center = [
          foldedC[0] * (1 - t) + flatC[0] * t,
          foldedC[1] * (1 - t) + flatC[1] * t,
          foldedC[2] * (1 - t) + flatC[2] * t,
        ];
        var nrm = norm([
          normalFold[0] * (1 - t) + 0 * t,
          normalFold[1] * (1 - t) + 0 * t,
          normalFold[2] * (1 - t) + 1 * t,
        ]);
        var ref = Math.abs(nrm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        var xdir = norm(cross(ref, nrm));
        var ydir = norm(cross(nrm, xdir));
        var pts = [];
        for (var k = 0; k < segs; k++) {
          var a = (k / segs) * Math.PI * 2;
          pts.push([
            center[0] + Math.cos(a) * r * xdir[0] + Math.sin(a) * r * ydir[0],
            center[1] + Math.cos(a) * r * xdir[1] + Math.sin(a) * r * ydir[1],
            center[2] + Math.cos(a) * r * xdir[2] + Math.sin(a) * r * ydir[2],
          ]);
        }
        var cf = faceColor(c.no);
        polys.push({ no: c.no, fill: cf, ink: labelInk(cf), pts: pts });
      });
      return { polys: polys };
    }
    var rC = model.r, hC = model.h, l = model.l, alpha = model.alpha;
    var a0 = -Math.PI / 2 - alpha / 2;
    var fillS = faceColor(1);
    for (i = 0; i < segs; i++) {
      f = i / segs;
      var f2 = (i + 1) / segs;
      function conePoint(fr, sr) {
        var phi = (fr - 0.5) * Math.PI * 2;
        var folded = [
          Math.cos(phi) * rC * sr,
          hC * (1 - sr),
          Math.sin(phi) * rC * sr,
        ];
        var psi = a0 + fr * alpha;
        var flat = [Math.cos(psi) * l * sr, Math.sin(psi) * l * sr, 0];
        return [
          folded[0] * (1 - t) + flat[0] * t,
          folded[1] * (1 - t) + flat[1] * t,
          folded[2] * (1 - t) + flat[2] * t,
        ];
      }
      var cEdges = [1];
      if (i === 0) cEdges.push(0);
      if (i === segs - 1) cEdges.push(2);
      polys.push({
        no: 1, fill: fillS, ink: labelInk(fillS), part: true,
        strokeEdges: cEdges,
        pts: [conePoint(f, 0), conePoint(f, 1), conePoint(f2, 1), conePoint(f2, 0)],
      });
    }
    var mid = -Math.PI / 2;
    var arc = { x: l * Math.cos(mid), y: l * Math.sin(mid) };
    var dirx = Math.cos(mid), diry = Math.sin(mid);
    var flatCx = arc.x + dirx * (TAB_CM + rC);
    var flatCy = arc.y + diry * (TAB_CM + rC);
    var basePts = [];
    for (i = 0; i < segs; i++) {
      var ang = (i / segs) * Math.PI * 2;
      var foldedB = [Math.cos(ang) * rC, 0, Math.sin(ang) * rC];
      var flatB = [flatCx + Math.cos(ang) * rC, flatCy + Math.sin(ang) * rC, 0];
      basePts.push([
        foldedB[0] * (1 - t) + flatB[0] * t,
        foldedB[1] * (1 - t) + flatB[1] * t,
        foldedB[2] * (1 - t) + flatB[2] * t,
      ]);
    }
    var fillB = faceColor(2);
    polys.push({ no: 2, fill: fillB, ink: labelInk(fillB), pts: basePts });
    var apexFold = [0, hC, 0];
    return { polys: polys, apex: apexFold };
  }

  function pose(model, net, t) {
    if (!model || !net) return { polys: [] };
    if (model.kind === "poly") return posePoly(model, net, t);
    return poseRound(model, net, t);
  }

  function transformPoint(p, quarter, flip, cx, cy) {
    var x = p.x - cx, y = p.y - cy;
    for (var k = 0; k < ((quarter % 4) + 4) % 4; k++) {
      var nx = y, ny = -x;
      x = nx; y = ny;
    }
    if (flip) x = -x;
    return { x: x + cx, y: y + cy };
  }

  function applyView(geom, quarter, flip) {
    var pts = collectPoints(geom);
    var b = boundsOf(pts);
    var cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    function tp(p) { return transformPoint(p, quarter, flip, cx, cy); }
    var q = ((quarter % 4) + 4) % 4;
    var figures = geom.figures.map(function (f) {
      if (f.kind === "poly") {
        return Object.assign({}, f, { pts: f.pts.map(tp) });
      }
      if (f.kind === "circle") {
        var c = tp({ x: f.cx, y: f.cy });
        return Object.assign({}, f, { cx: c.x, cy: c.y });
      }
      var apex = tp({ x: f.ax, y: f.ay });
      var rot = -q * (Math.PI / 2);
      var a0 = f.a0 + rot, a1 = f.a1 + rot;
      if (flip) {
        var na0 = Math.PI - a1, na1 = Math.PI - a0;
        a0 = na0; a1 = na1;
      }
      return Object.assign({}, f, { ax: apex.x, ay: apex.y, a0: a0, a1: a1 });
    });
    function seg(s) { return [tp(s[0]), tp(s[1])]; }
    return {
      figures: figures,
      folds: geom.folds.map(seg),
      cuts: geom.cuts.map(seg),
      tabs: geom.tabs.map(function (poly) { return poly.map(tp); }),
    };
  }

  function collectPoints(geom) {
    var pts = [];
    geom.figures.forEach(function (f) {
      if (f.kind === "poly") f.pts.forEach(function (p) { pts.push(p); });
      else if (f.kind === "circle") {
        pts.push({ x: f.cx - f.r, y: f.cy - f.r });
        pts.push({ x: f.cx + f.r, y: f.cy + f.r });
        pts.push({ x: f.cx - f.r, y: f.cy + f.r });
        pts.push({ x: f.cx + f.r, y: f.cy - f.r });
      } else if (f.kind === "sector") {
        pts.push({ x: f.ax, y: f.ay });
        for (var i = 0; i <= 36; i++) {
          var a = f.a0 + (f.a1 - f.a0) * (i / 36);
          pts.push({ x: f.ax + f.r * Math.cos(a), y: f.ay + f.r * Math.sin(a) });
        }
      }
    });
    geom.tabs.forEach(function (poly) { poly.forEach(function (p) { pts.push(p); }); });
    return pts;
  }
  function boundsOf(pts) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    if (!pts.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1, w: 1, h: 1 };
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY };
  }

  function a4Scale(widthCm, heightCm) {
    var availW = 190;
    var availH = 265;
    var w = widthCm * 10, h = heightCm * 10;
    if (w <= 0 || h <= 0) return 1;
    var s = Math.min(1, availW / w, availH / h);
    if (s > 0.999) return 1;
    return s;
  }

  function centroid2(pts) {
    var x = 0, y = 0, i;
    for (i = 0; i < pts.length; i++) { x += pts[i].x; y += pts[i].y; }
    return { x: x / pts.length, y: y / pts.length };
  }
  function centroid3(pts) {
    var x = 0, y = 0, z = 0, i;
    for (i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; z += pts[i][2]; }
    return [x / pts.length, y / pts.length, z / pts.length];
  }

  var SOLIDS = [
    { id: "cube", params: [{ key: "a", label: "sn.dim.edge", def: 4 }] },
    { id: "cuboid", params: [
      { key: "a", label: "sn.dim.length", def: 6 },
      { key: "b", label: "sn.dim.width", def: 4 },
      { key: "c", label: "sn.dim.height", def: 3 },
    ] },
    { id: "tri-prism", params: [
      { key: "a", label: "sn.dim.base", def: 4 },
      { key: "h", label: "sn.dim.prismH", def: 6 },
    ] },
    { id: "quad-prism", params: [
      { key: "a", label: "sn.dim.bottom", def: 6 },
      { key: "b", label: "sn.dim.top", def: 3 },
      { key: "c", label: "sn.dim.leg", def: 3 },
      { key: "h", label: "sn.dim.prismH", def: 6 },
    ] },
    { id: "tri-pyramid", params: [
      { key: "a", label: "sn.dim.base", def: 6 },
      { key: "h", label: "sn.dim.height", def: 8 },
    ] },
    { id: "quad-pyramid", params: [
      { key: "a", label: "sn.dim.base", def: 5 },
      { key: "h", label: "sn.dim.height", def: 6 },
    ] },
    { id: "tetrahedron", params: [{ key: "a", label: "sn.dim.edge", def: 5 }] },
    { id: "cylinder", params: [
      { key: "r", label: "sn.dim.radius", def: 2.5 },
      { key: "h", label: "sn.dim.height", def: 6 },
    ] },
    { id: "cone", params: [
      { key: "r", label: "sn.dim.baseR", def: 3 },
      { key: "h", label: "sn.dim.height", def: 7 },
    ] },
    { id: "octahedron", params: [{ key: "a", label: "sn.dim.edge", def: 4 }] },
  ];

  SOLIDS.forEach(function (s) {
    s.params.forEach(function (p) {
      p.min = 0.5; p.max = 20; p.step = 0.1;
    });
  });

  function defaultParams(id) {
    var s = SOLIDS.filter(function (x) { return x.id === id; })[0];
    var o = {};
    if (!s) return o;
    s.params.forEach(function (p) { o[p.key] = p.def; });
    return o;
  }
  function clampParams(id, incoming, previous) {
    var s = SOLIDS.filter(function (x) { return x.id === id; })[0];
    var next = Object.assign({}, previous || defaultParams(id));
    if (!s) return { params: next, invalid: false };
    var invalid = false;
    s.params.forEach(function (p) {
      var v = Number(incoming[p.key]);
      if (!isFinite(v) || v < p.min - 1e-9 || v > p.max + 1e-9) invalid = true;
      else next[p.key] = Math.round(v * 10) / 10;
    });
    if (id === "quad-prism" && !(next.a > next.b)) invalid = true;
    if (id === "quad-prism") {
      var overhang = (next.a - next.b) / 2;
      if (next.c <= overhang + 1e-8) invalid = true;
    }
    if (invalid) return { params: previous || defaultParams(id), invalid: true };
    return { params: next, invalid: false };
  }
  function nearly(a, b) { return Math.abs(a - b) < 0.051; }
  function hintKey(id, params) {
    if (id === "cuboid" && nearly(params.a, params.b) && nearly(params.b, params.c)) return "sn.hint.cuboidCube";
    if (id === "tri-pyramid") {
      var ideal = Math.sqrt(6) / 3 * params.a;
      if (Math.abs(params.h - ideal) <= 0.05) return "sn.hint.triPyramidReg";
    }
    return "sn.hint." + id;
  }
  function findNetIndex(nets, treeKeyValue) {
    for (var i = 0; i < nets.length; i++) {
      if (nets[i].treeKey === treeKeyValue || nets[i].rawKey === treeKeyValue) return i;
    }
    return -1;
  }

  function locateNet(model, nets, edgeIdxs) {
    if (!model || !nets || !nets.length || !edgeIdxs) return -1;
    if (model.kind !== "poly") return -1;
    var raw = treeKey(model.adj, edgeIdxs);
    var i;
    for (i = 0; i < nets.length; i++) if (nets[i].rawKey === raw) return i;
    if (model.autos) {
      var key = canonKey(model, edgeIdxs, model.autos);
      for (i = 0; i < nets.length; i++) if (nets[i].treeKey === key) return i;
    }
    return -1;
  }

  function icons() {
    return {
      cube: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4l10 5.5v11L16 26 6 20.5v-11L16 4z" fill="#fff" stroke="#0D1B2A" stroke-width="1.4"/><path d="M16 4v11L6 20.5M16 15l10-5.5" stroke="#0D1B2A" stroke-width="1.2"/><path d="M16 15l10 5.5" stroke="#0D9488" stroke-width="1.2"/></svg>',
      cuboid: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 10l14 4v10l-14-4V10z" fill="#fff" stroke="#0D1B2A" stroke-width="1.4"/><path d="M8 10l6-3 14 4M14 7v10M22 14v10" stroke="#0D1B2A" stroke-width="1.2"/><path d="M8 10v10l6 3" stroke="#0D9488" stroke-width="1.2"/></svg>',
      "tri-prism": '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 22L16 8l10 14H6z" fill="#E8F4F3" stroke="#0D1B2A" stroke-width="1.4"/><path d="M16 8v8l10 6" stroke="#0D9488" stroke-width="1.2"/></svg>',
      "quad-prism": '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 20h18l-4-8H11l-4 8z" fill="#E8F4F3" stroke="#0D1B2A" stroke-width="1.4"/><path d="M11 12l2 8M21 12l-2 8" stroke="#0D9488" stroke-width="1.2"/></svg>',
      "tri-pyramid": '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5L27 25H5L16 5z" fill="#fff" stroke="#0D1B2A" stroke-width="1.4"/><path d="M16 5L16 25M16 15L5 25M16 15L27 25" stroke="#0D9488" stroke-width="1.1"/></svg>',
      "quad-pyramid": '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 22l8-14 8 14H8z" fill="#E8F4F3" stroke="#0D1B2A" stroke-width="1.4"/><path d="M6 18h20l-2 6H8l-2-6z" fill="#fff" stroke="#0D1B2A" stroke-width="1.2"/><path d="M16 8v16" stroke="#E8A838" stroke-width="1.2"/></svg>',
      tetrahedron: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4l12 20H4L16 4z" fill="#E8F4F3" stroke="#0D1B2A" stroke-width="1.4"/><path d="M16 4v20M4 24l12-8 12 8" stroke="#0D9488" stroke-width="1.2"/></svg>',
      cylinder: '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="8" rx="8" ry="3.2" fill="#fff" stroke="#0D1B2A" stroke-width="1.3"/><path d="M8 8v14c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V8" fill="#E8F4F3" stroke="#0D1B2A" stroke-width="1.3"/><path d="M8 8c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" stroke="#0D9488" stroke-width="1.2"/></svg>',
      cone: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5L26 24H6L16 5z" fill="#E8F4F3" stroke="#0D1B2A" stroke-width="1.4"/><ellipse cx="16" cy="24" rx="10" ry="3.2" fill="#fff" stroke="#0D1B2A" stroke-width="1.3"/><path d="M16 5v19" stroke="#E8A838" stroke-width="1.2"/></svg>',
      octahedron: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l10 13-10 13L6 16 16 3z" fill="#fff" stroke="#0D1B2A" stroke-width="1.4"/><path d="M6 16h20M16 3v26" stroke="#0D9488" stroke-width="1.1"/></svg>',
    };
  }

  return {
    FACE_COLORS: FACE_COLORS,
    TAB_CM: TAB_CM,
    SOLIDS: SOLIDS,
    faceColor: faceColor,
    labelInk: labelInk,
    defaultParams: defaultParams,
    clampParams: clampParams,
    build: build,
    netsFor: netsFor,
    geometry: geometry,
    pose: pose,
    applyView: applyView,
    collectPoints: collectPoints,
    boundsOf: boundsOf,
    a4Scale: a4Scale,
    centroid2: centroid2,
    centroid3: centroid3,
    hintKey: hintKey,
    findNetIndex: findNetIndex,
    locateNet: locateNet,
    icons: icons,
    nearlyEqual: nearly,
    tetraHeight: function (a) { return Math.sqrt(6) / 3 * a; },
  };
});
