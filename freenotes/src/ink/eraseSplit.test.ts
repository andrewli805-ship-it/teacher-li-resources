import { beforeEach, describe, expect, it } from "vitest";
import type { Point, Stroke } from "../types";
import { strokeRadius } from "./geometry";
import { eraseStrokes } from "./eraseSplit";
import { visibleDotRadius } from "./render";

let seq = 0;

beforeEach(() => {
  seq = 0;
});

function ids(): string {
  seq += 1;
  return `n${seq}`;
}

function pt(x: number, y = 0, p = 0.5, t = 0): Point {
  return { x, y, p, t };
}

function stroke(
  id: string,
  points: Point[],
  extra: Partial<Stroke> = {},
): Stroke {
  return {
    id,
    pageId: "page",
    tool: "pen",
    color: "#1c1917",
    width: 2,
    points,
    ...extra,
  };
}

function line(id: string, x0: number, x1: number, y = 0, extra: Partial<Stroke> = {}): Stroke {
  return stroke(id, [pt(x0, y, 0.5, 0), pt(x1, y, 0.5, 10)], extra);
}

describe("eraseStrokes", () => {
  it("cuts the middle of a long stroke and leaves both ends", () => {
    const original = line("s", 0, 100);
    const result = eraseStrokes([original], [pt(50, -30), pt(50, 30)], 10, ids);
    // width 2 → strokeRadius 2, threshold 12, so the gap is x in (38, 62).
    expect(result.removed).toEqual([original]);
    expect(result.added).toHaveLength(2);
    expect(result.strokes.map((s) => s.id)).not.toContain("s");
    expect(result.strokes[0].points[0].x).toBeCloseTo(0, 4);
    expect(result.strokes[0].points.at(-1)!.x).toBeCloseTo(38, 3);
    expect(result.strokes[1].points[0].x).toBeCloseTo(62, 3);
    expect(result.strokes[1].points.at(-1)!.x).toBeCloseTo(100, 4);
    for (const remnant of result.strokes) {
      expect(remnant.tool).toBe("pen");
      expect(remnant.color).toBe(original.color);
      expect(remnant.width).toBe(original.width);
      expect(remnant.pageId).toBe("page");
      for (const p of remnant.points) {
        expect(p.x < 38.05 || p.x > 61.95).toBe(true);
      }
    }
  });

  it("inserts boundary points instead of only dropping an interior vertex", () => {
    const original = stroke("s", [pt(0), pt(50), pt(100)]);
    const result = eraseStrokes([original], [pt(50, -30), pt(50, 30)], 10, ids);
    expect(result.added).toHaveLength(2);
    expect(result.added[0].points.at(-1)!.x).toBeCloseTo(38, 3);
    expect(result.added[1].points[0].x).toBeCloseTo(62, 3);
    expect(result.added[0].points.some((p) => p.x === 50)).toBe(false);
    expect(result.added[1].points.some((p) => p.x === 50)).toBe(false);
  });

  it("interpolates pressure and time at the cut", () => {
    const original = stroke("s", [pt(0, 0, 0.2, 100), pt(100, 0, 1, 500)]);
    const result = eraseStrokes([original], [pt(50, -40), pt(50, 40)], 10, ids);
    const cut = result.added[0].points.at(-1)!;
    expect(cut.x).toBeCloseTo(38, 3);
    expect(cut.p).toBeCloseTo(0.2 + 0.38 * 0.8, 3);
    expect(cut.t).toBeCloseTo(100 + 0.38 * 400, 2);
    expect(cut.p).not.toBe(0.5);
  });

  it("erases one end and keeps the other", () => {
    const original = line("s", 0, 100);
    const result = eraseStrokes([original], [pt(0, 0)], 10, ids);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].points[0].x).toBeCloseTo(12, 3);
    expect(result.added[0].points.at(-1)!.x).toBeCloseTo(100, 4);
  });

  it("deletes a stroke only when the eraser covers all of it", () => {
    const original = line("s", 0, 20);
    const result = eraseStrokes([original], [pt(10, 0)], 18, ids);
    expect(result.added).toEqual([]);
    expect(result.strokes).toEqual([]);
    expect(result.removed).toEqual([original]);
    expect(result.counts).toEqual([0]);
  });

  it("opens two gaps in one gesture and does not delete the whole stroke", () => {
    const original = line("s", 0, 200);
    const path = [pt(50, -30), pt(50, 30), pt(150, 30), pt(150, -30)];
    const result = eraseStrokes([original], path, 10, ids);
    expect(result.added).toHaveLength(3);
    expect(result.added[0].points[0].x).toBeCloseTo(0, 4);
    expect(result.added[0].points.at(-1)!.x).toBeCloseTo(38, 3);
    expect(result.added[1].points[0].x).toBeCloseTo(62, 3);
    expect(result.added[1].points.at(-1)!.x).toBeCloseTo(138, 3);
    expect(result.added[2].points[0].x).toBeCloseTo(162, 3);
    expect(result.added[2].points.at(-1)!.x).toBeCloseTo(200, 4);
  });

  it("treats a path that crosses the same place twice as one gap", () => {
    const original = line("s", 0, 100);
    const path = [pt(50, -30), pt(50, 30), pt(50, -30)];
    const result = eraseStrokes([original], path, 10, ids);
    expect(result.added).toHaveLength(2);
    expect(result.added[0].points.at(-1)!.x).toBeCloseTo(38, 3);
    expect(result.added[1].points[0].x).toBeCloseTo(62, 3);
  });

  it("drops a remnant shorter than 2 page px and keeps one of length 2", () => {
    const kept = line("keep", 0, 12);
    const keptResult = eraseStrokes([kept], [pt(0, 0)], 8, ids);
    expect(keptResult.added).toHaveLength(1);
    expect(polylineLength(keptResult.added[0].points)).toBeCloseTo(2, 3);

    const dropped = line("drop", 0, 11.5);
    const droppedResult = eraseStrokes([dropped], [pt(0, 0)], 8, ids);
    expect(droppedResult.added).toEqual([]);
    expect(droppedResult.removed).toEqual([dropped]);
  });

  it("keeps a short stroke that the eraser never touched", () => {
    const tiny = line("tiny", 0, 1, 200);
    const result = eraseStrokes([tiny], [pt(0, 0)], 10, ids);
    expect(result.strokes).toEqual([tiny]);
    expect(result.removed).toEqual([]);
    expect(result.strokes[0]).toBe(tiny);
  });

  it("deletes a pen dot inside its drawn radius and keeps one just outside", () => {
    const width = 4.8;
    const dot = stroke("dot", [pt(0, 0, 1, 0)], { width });
    const visible = visibleDotRadius(dot);
    expect(visible).toBeCloseTo(2.4, 5);
    expect(visible).toBeLessThan(strokeRadius(dot));
    const radius = 10;
    const erased = eraseStrokes([dot], [pt(radius + visible - 0.05, 0)], radius, ids);
    expect(erased.strokes).toEqual([]);
    const kept = eraseStrokes([dot], [pt(radius + visible + 0.2, 0)], radius, ids);
    expect(kept.strokes[0]).toBe(dot);
    expect(kept.removed).toEqual([]);
  });

  it("uses the 0.6 floor for a light pen dot", () => {
    const dot = stroke("dot", [pt(0, 0, 0, 0)], { width: 1.6 });
    expect(visibleDotRadius(dot)).toBeCloseTo(0.6, 5);
    const erased = eraseStrokes([dot], [pt(10.59, 0)], 10, ids);
    expect(erased.strokes).toEqual([]);
    const kept = eraseStrokes([dot], [pt(10.7, 0)], 10, ids);
    expect(kept.strokes[0]).toBe(dot);
  });

  it("uses the highlighter dot's drawn radius, not strokeRadius", () => {
    const dot = stroke("mark", [pt(0, 0, 0.4, 0)], { tool: "highlighter", width: 16, color: "#d4b429" });
    expect(visibleDotRadius(dot)).toBe(8);
    expect(strokeRadius(dot)).toBeCloseTo(9.6, 5);
    const radius = 10;
    // 19 is inside R + strokeRadius (19.6) but outside R + drawn radius (18).
    const kept = eraseStrokes([dot], [pt(19, 0)], radius, ids);
    expect(kept.strokes[0]).toBe(dot);
    const erased = eraseStrokes([dot], [pt(17, 0)], radius, ids);
    expect(erased.strokes).toEqual([]);
    expect(erased.removed[0].tool).toBe("highlighter");
  });

  it("splits a pen and a highlighter independently and leaves an unswept stroke", () => {
    const pen = line("pen", 0, 100, 0, { color: "#1c1917", width: 2 });
    const marker = line("mark", 0, 100, 0, { tool: "highlighter", color: "#d4b429", width: 16 });
    const earlier = line("earlier", 0, 100, 400);
    const result = eraseStrokes(
      [earlier, pen, marker],
      [pt(50, -40), pt(50, 40)],
      10,
      ids,
    );
    expect(result.strokes[0]).toBe(earlier);
    expect(result.removed.map((s) => s.id)).toEqual(["pen", "mark"]);
    expect(result.counts).toEqual([2, 2]);
    expect(result.strokes).toHaveLength(5);
    expect(result.strokes[1].tool).toBe("pen");
    expect(result.strokes[1].color).toBe("#1c1917");
    expect(result.strokes[3].tool).toBe("highlighter");
    expect(result.strokes[3].color).toBe("#d4b429");
    expect(result.strokes[3].width).toBe(16);
    // Highlighter ink is wider, so its gap starts farther from the eraser.
    expect(result.strokes[1].points.at(-1)!.x).toBeCloseTo(38, 2);
    expect(result.strokes[3].points.at(-1)!.x).toBeCloseTo(50 - (10 + 16 * 0.6), 2);
  });

  it("cuts only the stroke whose ink the eraser reaches", () => {
    const pen = line("pen", 0, 100, 0, { width: 2 });
    const marker = line("mark", 0, 100, 0, { tool: "highlighter", width: 24, color: "#d4b429" });
    // 16px off the shared centerline: inside R + highlighter strokeRadius, outside R + pen strokeRadius.
    const result = eraseStrokes([pen, marker], [pt(40, 16), pt(60, 16)], 10, ids);
    expect(result.strokes[0]).toBe(pen);
    expect(result.removed).toEqual([marker]);
    expect(result.added.length).toBeGreaterThan(0);
    expect(result.added.every((s) => s.tool === "highlighter")).toBe(true);
  });

  it("splits both overlapping strokes when the eraser sweeps both", () => {
    const lower = line("lower", 0, 100, 0, { color: "#111111" });
    const upper = line("upper", 0, 100, 0, { color: "#222222", tool: "highlighter", width: 16 });
    const result = eraseStrokes([lower, upper], [pt(50, -20), pt(50, 20)], 10, ids);
    expect(result.removed.map((s) => s.id)).toEqual(["lower", "upper"]);
    expect(result.counts).toEqual([2, 2]);
    expect(result.strokes.map((s) => s.color)).toEqual(["#111111", "#111111", "#222222", "#222222"]);
  });

  it("leaves a far stroke untouched and splices remnants in place", () => {
    const below = line("below", 0, 30, 80);
    const target = line("target", 0, 100, 0);
    const above = line("above", 0, 30, -80);
    const result = eraseStrokes([below, target, above], [pt(50, -20), pt(50, 20)], 10, ids);
    expect(result.strokes[0]).toBe(below);
    expect(result.strokes.at(-1)).toBe(above);
    expect(result.removed).toEqual([target]);
    expect(result.at).toEqual([1]);
    expect(result.counts).toEqual([2]);
    expect(result.strokes).toHaveLength(4);
  });

  it("keeps radius 6 from cutting a stroke that radius 18 only nicks", () => {
    const original = line("s", 0, 100);
    const path = [pt(50, 14)];
    const fine = eraseStrokes([original], path, 6, ids);
    expect(fine.strokes[0]).toBe(original);
    expect(fine.removed).toEqual([]);
    const mid = eraseStrokes([original], path, 10, ids);
    expect(mid.removed).toEqual([]);
    const coarse = eraseStrokes([original], path, 18, ids);
    expect(coarse.added).toHaveLength(2);
    expect(coarse.added[0].points[0].x).toBeCloseTo(0, 4);
    expect(coarse.added[0].points.at(-1)!.x).toBeGreaterThan(20);
    expect(coarse.added[1].points.at(-1)!.x).toBeCloseTo(100, 4);
    expect(coarse.strokes).not.toHaveLength(0);
  });
});

function polylineLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}
