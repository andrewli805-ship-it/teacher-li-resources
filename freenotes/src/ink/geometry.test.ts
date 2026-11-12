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
