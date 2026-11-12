import type { Point, Stroke } from "../types";

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

export function strokeRadius(stroke: Stroke): number {
  const base = stroke.tool === "highlighter" ? stroke.width * 0.6 : stroke.width * 0.7;
  return Math.max(base, 2);
}

export function strokeHitsPoint(
  stroke: Stroke,
  x: number,
  y: number,
  extra = 0,
): boolean {
  const threshold = strokeRadius(stroke) + extra;
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) {
    return dist(pts[0].x, pts[0].y, x, y) <= threshold;
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (distToSegment(x, y, a.x, a.y, b.x, b.y) <= threshold) return true;
  }
  return false;
}

export function strokeHitsPath(stroke: Stroke, path: Point[], extra = 0): boolean {
  if (path.length === 0) return false;
  for (const p of path) {
    if (strokeHitsPoint(stroke, p.x, p.y, extra)) return true;
  }
  if (path.length < 2) return false;
  const threshold = strokeRadius(stroke) + extra;
  const pts = stroke.points;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    for (let j = 0; j < pts.length; j++) {
      const s = pts[j];
      if (j === 0) {
        if (distToSegment(s.x, s.y, a.x, a.y, b.x, b.y) <= threshold) return true;
      } else {
        const prev = pts[j - 1];
        if (segmentsClose(prev.x, prev.y, s.x, s.y, a.x, a.y, b.x, b.y, threshold)) {
          return true;
        }
      }
    }
  }
  return false;
}

function segmentsClose(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  threshold: number,
): boolean {
  return segmentDistance(ax, ay, bx, by, cx, cy, dx, dy) <= threshold;
}

export function segmentDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number {
  if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    distToSegment(ax, ay, cx, cy, dx, dy),
    distToSegment(bx, by, cx, cy, dx, dy),
    distToSegment(cx, cy, ax, ay, bx, by),
    distToSegment(dx, dy, ax, ay, bx, by),
  );
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true;
  if (o2 === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true;
  if (o3 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (o4 === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true;
  return false;
}

function orient(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(v) < 1e-9) return 0;
  return v > 0 ? 1 : -1;
}

function onSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): boolean {
  return (
    px >= Math.min(ax, bx) - 1e-9 &&
    px <= Math.max(ax, bx) + 1e-9 &&
    py >= Math.min(ay, by) - 1e-9 &&
    py <= Math.max(ay, by) + 1e-9
  );
}

export function simplifyPoints(points: Point[], minDist = 0.6): Point[] {
  if (points.length < 3) return points.slice();
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = points[i];
    if (dist(prev.x, prev.y, cur.x, cur.y) >= minDist) out.push(cur);
  }
  out.push(points[points.length - 1]);
  return out;
}
