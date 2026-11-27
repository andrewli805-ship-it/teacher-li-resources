import { describe, expect, it } from "vitest";
import type { Stroke } from "../types";
import { distToSegment, simplifyPoints, strokeHitsPath, strokeHitsPoint } from "./geometry";

function stroke(points: { x: number; y: number }[], width = 4): Stroke {
  return {
    id: "s1",
    pageId: "p1",
    tool: "pen",
    color: "#000",
    width,
    points: points.map((pt) => ({ ...pt, p: 0.5, t: 0 })),
  };
}

describe("distToSegment", () => {
  it("returns 0 on the segment", () => {
    expect(distToSegment(5, 0, 0, 0, 10, 0)).toBeCloseTo(0);
  });

  it("clamps to endpoints", () => {
    expect(distToSegment(-4, 0, 0, 0, 10, 0)).toBeCloseTo(4);
    expect(distToSegment(15, 3, 0, 0, 10, 0)).toBeCloseTo(Math.hypot(5, 3));
  });
});

describe("strokeHitsPoint", () => {
  it("hits a nearby stroke and misses a far one", () => {
    const s = stroke([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ]);
    expect(strokeHitsPoint(s, 20, 2, 0)).toBe(true);
    expect(strokeHitsPoint(s, 20, 40, 0)).toBe(false);
  });
});

describe("strokeHitsPath", () => {
  it("detects an eraser path crossing a stroke", () => {
    const s = stroke([
      { x: 0, y: 20 },
      { x: 80, y: 20 },
    ]);
    const path = [
      { x: 40, y: 0, p: 0.5, t: 0 },
      { x: 40, y: 40, p: 0.5, t: 1 },
    ];
    expect(strokeHitsPath(s, path, 2)).toBe(true);
  });
});

describe("eraser extra radii 6 / 10 / 18", () => {
  // Pen width 2 → strokeRadius = max(1.4, 2) = 2. Threshold is 2 + extra.
  const s = stroke(
    [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
    ],
    2,
  );

  it("extra 6 hits inside the radius and misses just outside", () => {
    expect(strokeHitsPoint(s, 40, 7.9, 6)).toBe(true);
    expect(strokeHitsPoint(s, 40, 8.2, 6)).toBe(false);
  });

  it("extra 10 reaches farther than 6 and stops short of 18", () => {
    expect(strokeHitsPoint(s, 40, 11, 6)).toBe(false);
    expect(strokeHitsPoint(s, 40, 11, 10)).toBe(true);
    expect(strokeHitsPoint(s, 40, 13, 10)).toBe(false);
  });

  it("extra 18 hits a more distant stroke and misses beyond it", () => {
    expect(strokeHitsPoint(s, 40, 19, 10)).toBe(false);
    expect(strokeHitsPoint(s, 40, 19, 18)).toBe(true);
    expect(strokeHitsPoint(s, 40, 21, 18)).toBe(false);
  });

  it("a near-miss path hits only with the larger extra", () => {
    const path = [
      { x: 40, y: 19, p: 0.5, t: 0 },
      { x: 48, y: 19, p: 0.5, t: 1 },
    ];
    expect(strokeHitsPath(s, path, 10)).toBe(false);
    expect(strokeHitsPath(s, path, 18)).toBe(true);
  });
});

describe("simplifyPoints", () => {
  it("keeps endpoints and drops tight midpoints", () => {
    const pts = [
      { x: 0, y: 0, p: 1, t: 0 },
      { x: 0.2, y: 0, p: 1, t: 1 },
      { x: 10, y: 0, p: 1, t: 2 },
    ];
    const out = simplifyPoints(pts, 0.6);
    expect(out[0]).toEqual(pts[0]);
    expect(out[out.length - 1]).toEqual(pts[2]);
    expect(out.length).toBe(2);
  });
});
