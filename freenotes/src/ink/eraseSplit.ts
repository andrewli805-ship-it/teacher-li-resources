import type { Point, Stroke } from "../types";
import { dist, distToSegment, strokeRadius } from "./geometry";
import { visibleDotRadius } from "./render";

/** Remnants shorter than this (page px along the centerline) are dropped. */
const MIN_REMNANT_LENGTH = 2;

export interface EraseResult {
  strokes: Stroke[];
  removed: Stroke[];
  added: Stroke[];
  /** Index of each `removed` stroke in the pre-erase page array. */
  at: number[];
  /** Remnant count for each `removed` stroke. Fully erased strokes contribute 0. */
  counts: number[];
}

/**
 * Split every stroke the eraser swept. Untouched strokes keep their object and id.
 * `removed` is the pre-gesture strokes that changed; `added` is the kept remnants.
 */
export function eraseStrokes(
  strokes: readonly Stroke[],
  path: readonly Point[],
  radius: number,
  newId: () => string,
): EraseResult {
  const next: Stroke[] = [];
  const removed: Stroke[] = [];
  const added: Stroke[] = [];
  const at: number[] = [];
  const counts: number[] = [];
  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i];
    const remnants = splitStroke(stroke, path, radius, newId);
    if (remnants === null) {
      next.push(stroke);
      continue;
    }
    removed.push(stroke);
    at.push(i);
    counts.push(remnants.length);
    for (const remnant of remnants) {
      added.push(remnant);
      next.push(remnant);
    }
  }
  return { strokes: next, removed, added, at, counts };
}

/** `null` keeps the original stroke. An array (possibly empty) replaces it. */
function splitStroke(
  stroke: Stroke,
  path: readonly Point[],
  radius: number,
  newId: () => string,
): Stroke[] | null {
  const pts = stroke.points;
  if (pts.length === 0 || path.length === 0 || !Number.isFinite(radius)) return null;
  const limit = radius + (pts.length === 1 ? visibleDotRadius(stroke) : strokeRadius(stroke));
  if (bboxMisses(pts, path, limit)) return null;

  if (pts.length === 1) {
    const dot = pts[0];
    return distanceToPath(dot.x, dot.y, path) <= limit ? [] : null;
  }

  const erased: Array<Array<[number, number]>> = [];
  let hit = false;
  for (let i = 1; i < pts.length; i++) {
    const spans = erasedOnSegment(pts[i - 1], pts[i], path, limit);
    erased.push(spans);
    if (spans.length > 0) hit = true;
  }
  if (!hit) return null;

  const remnants: Stroke[] = [];
  for (const run of outsideRuns(pts, erased)) {
    if (run.length < 2 || polylineLength(run) < MIN_REMNANT_LENGTH) continue;
    remnants.push({
      id: newId(),
      pageId: stroke.pageId,
      tool: stroke.tool,
      color: stroke.color,
      width: stroke.width,
      points: run.map(clonePoint),
    });
  }
  return remnants;
}

function clonePoint(p: Point): Point {
  return { x: p.x, y: p.y, p: p.p, t: p.t };
}

function polylineLength(pts: Point[]): number {
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  }
  return length;
}

function distanceToPath(x: number, y: number, path: readonly Point[]): number {
  let best = dist(x, y, path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    const d = distToSegment(x, y, path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
    if (d < best) best = d;
  }
  return best;
}

function bboxMisses(pts: readonly Point[], path: readonly Point[], limit: number): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  let pathMinX = Infinity;
  let pathMinY = Infinity;
  let pathMaxX = -Infinity;
  let pathMaxY = -Infinity;
  for (const p of path) {
    if (p.x < pathMinX) pathMinX = p.x;
    if (p.y < pathMinY) pathMinY = p.y;
    if (p.x > pathMaxX) pathMaxX = p.x;
    if (p.y > pathMaxY) pathMaxY = p.y;
  }
  return (
    maxX < pathMinX - limit ||
    minX > pathMaxX + limit ||
    maxY < pathMinY - limit ||
    minY > pathMaxY + limit
  );
}

function outsideRuns(pts: readonly Point[], erased: Array<Array<[number, number]>>): Point[][] {
  const runs: Point[][] = [];
  let open: Point[] | null = null;
  const close = () => {
    if (open && open.length) runs.push(open);
    open = null;
  };

  for (let i = 0; i < erased.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const kept = outsideFromErased(erased[i]);
    if (kept.length === 0) {
      close();
      continue;
    }
    for (const [u0, u1] of kept) {
      const p0 = pointOn(a, b, u0);
      const p1 = pointOn(a, b, u1);
      if (open && u0 <= 1e-5) {
        appendPoint(open, p0);
        appendPoint(open, p1);
      } else {
        close();
        open = [];
        appendPoint(open, p0);
        appendPoint(open, p1);
      }
      if (u1 < 1 - 1e-5) close();
    }
  }
  close();
  return runs;
}

function appendPoint(run: Point[], p: Point): void {
  const last = run[run.length - 1];
  if (!last) {
    run.push(p);
    return;
  }
  if (last === p) return;
  if (dist(last.x, last.y, p.x, p.y) <= 1e-4) return;
  run.push(p);
}

function pointOn(a: Point, b: Point, u: number): Point {
  if (u <= 1e-8) return a;
  if (u >= 1 - 1e-8) return b;
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    p: a.p + (b.p - a.p) * u,
    t: a.t + (b.t - a.t) * u,
  };
}

function outsideFromErased(erased: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let cursor = 0;
  for (const [start, end] of erased) {
    if (start > cursor + 1e-7) out.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < 1 - 1e-7) out.push([cursor, 1]);
  return out;
}

function erasedOnSegment(
  a: Point,
  b: Point,
  path: readonly Point[],
  limit: number,
): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  if (path.length === 1) {
    pushDisk(spans, a, b, path[0], limit, 0, 1);
  } else {
    for (let i = 1; i < path.length; i++) {
      pushCapsule(spans, a, b, path[i - 1], path[i], limit);
    }
  }
  return mergeIntervals(spans);
}

function pushCapsule(
  out: Array<[number, number]>,
  a: Point,
  b: Point,
  c: Point,
  d: Point,
  limit: number,
): void {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const cdLen2 = cdx * cdx + cdy * cdy;
  if (cdLen2 < 1e-12) {
    pushDisk(out, a, b, c, limit, 0, 1);
    return;
  }
  const sA = ((a.x - c.x) * cdx + (a.y - c.y) * cdy) / cdLen2;
  const sDelta = (abx * cdx + aby * cdy) / cdLen2;
  const breaks = [0, 1];
  if (Math.abs(sDelta) > 1e-14) {
    const atStart = -sA / sDelta;
    const atEnd = (1 - sA) / sDelta;
    if (atStart > 1e-8 && atStart < 1 - 1e-8) breaks.push(atStart);
    if (atEnd > 1e-8 && atEnd < 1 - 1e-8) breaks.push(atEnd);
  }
  breaks.sort((p, q) => p - q);
  const cdLen = Math.sqrt(cdLen2);
  for (let i = 0; i < breaks.length - 1; i++) {
    const lo = breaks[i];
    const hi = breaks[i + 1];
    if (hi - lo < 1e-10) continue;
    const sMid = sA + ((lo + hi) / 2) * sDelta;
    if (sMid <= 0) pushDisk(out, a, b, c, limit, lo, hi);
    else if (sMid >= 1) pushDisk(out, a, b, d, limit, lo, hi);
    else pushSlab(out, a, b, c, cdx, cdy, cdLen, limit, lo, hi);
  }
}

function pushDisk(
  out: Array<[number, number]>,
  a: Point,
  b: Point,
  center: Point,
  limit: number,
  lo: number,
  hi: number,
): void {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const acx = a.x - center.x;
  const acy = a.y - center.y;
  const qa = abx * abx + aby * aby;
  const qb = 2 * (acx * abx + acy * aby);
  const qc = acx * acx + acy * acy - limit * limit;
  for (const span of solveQuadLE(qa, qb, qc, lo, hi)) out.push(span);
}

/** Portion of the stroke segment whose distance to the infinite eraser line is within `limit`. */
function pushSlab(
  out: Array<[number, number]>,
  a: Point,
  b: Point,
  c: Point,
  cdx: number,
  cdy: number,
  cdLen: number,
  limit: number,
  lo: number,
  hi: number,
): void {
  const u = (a.x - c.x) * cdy - (a.y - c.y) * cdx;
  const v = (b.x - a.x) * cdy - (b.y - a.y) * cdx;
  const rhs = limit * cdLen;
  if (Math.abs(v) < 1e-10) {
    if (Math.abs(u) <= rhs + 1e-6) out.push([lo, hi]);
    return;
  }
  const boundA = (rhs - u) / v;
  const boundB = (-rhs - u) / v;
  const start = Math.max(lo, Math.min(boundA, boundB));
  const end = Math.min(hi, Math.max(boundA, boundB));
  if (end - start > 1e-8) out.push([start, end]);
}

/** Parameter ranges where `a t^2 + b t + c <= 0` inside `[lo, hi]`. */
function solveQuadLE(
  a: number,
  b: number,
  c: number,
  lo: number,
  hi: number,
): Array<[number, number]> {
  if (hi - lo <= 1e-8) return [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return c <= 1e-7 ? [[lo, hi]] : [];
    const root = -c / b;
    if (b > 0) {
      const end = Math.min(hi, root);
      return end - lo > 1e-8 ? [[lo, end]] : [];
    }
    const start = Math.max(lo, root);
    return hi - start > 1e-8 ? [[start, hi]] : [];
  }
  let disc = b * b - 4 * a * c;
  if (disc < -1e-6) return a < 0 ? [[lo, hi]] : [];
  if (disc < 0) disc = 0;
  const sd = Math.sqrt(disc);
  const inv = 0.5 / a;
  let r1 = (-b - sd) * inv;
  let r2 = (-b + sd) * inv;
  if (r1 > r2) {
    const swap = r1;
    r1 = r2;
    r2 = swap;
  }
  if (a > 0) {
    const start = Math.max(lo, r1);
    const end = Math.min(hi, r2);
    return end - start > 1e-8 ? [[start, end]] : [];
  }
  const out: Array<[number, number]> = [];
  const leftEnd = Math.min(hi, r1);
  if (leftEnd - lo > 1e-8) out.push([lo, leftEnd]);
  const rightStart = Math.max(lo, r2);
  if (hi - rightStart > 1e-8) out.push([rightStart, hi]);
  return out;
}

function mergeIntervals(spans: Array<[number, number]>): Array<[number, number]> {
  const clipped: Array<[number, number]> = [];
  for (const [start, end] of spans) {
    const lo = Math.max(0, start);
    const hi = Math.min(1, end);
    if (hi - lo > 1e-7) clipped.push([lo, hi]);
  }
  clipped.sort((p, q) => p[0] - q[0]);
  const out: Array<[number, number]> = [];
  for (const [start, end] of clipped) {
    const last = out[out.length - 1];
    if (last && start <= last[1] + 1e-6) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}
