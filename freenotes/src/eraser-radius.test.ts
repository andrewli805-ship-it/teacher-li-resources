import { describe, expect, it } from "vitest";
import { eraserRadiusFromStorage } from "./types";

describe("eraserRadiusFromStorage", () => {
  it("accepts the three stored strings", () => {
    expect(eraserRadiusFromStorage("6")).toBe(6);
    expect(eraserRadiusFromStorage("10")).toBe(10);
    expect(eraserRadiusFromStorage("18")).toBe(18);
  });

  it("falls back to the mid radius", () => {
    expect(eraserRadiusFromStorage(null)).toBe(10);
    expect(eraserRadiusFromStorage(undefined)).toBe(10);
    expect(eraserRadiusFromStorage("")).toBe(10);
    expect(eraserRadiusFromStorage("abc")).toBe(10);
    expect(eraserRadiusFromStorage("7")).toBe(10);
    expect(eraserRadiusFromStorage("10.0")).toBe(10);
    expect(eraserRadiusFromStorage(" 10")).toBe(10);
    expect(eraserRadiusFromStorage("18 ")).toBe(10);
  });
});
