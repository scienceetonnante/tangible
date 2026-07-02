import { describe, it, expect } from "vitest";
import { EASINGS, isEasing, getEasing } from "./easing.js";

describe("easing registry", () => {
  const names = Object.keys(EASINGS);

  it("every curve pins endpoints exactly (value-at-time correctness)", () => {
    for (const name of names) {
      const f = EASINGS[name]!;
      expect(f(0)).toBeCloseTo(0, 12);
      expect(f(1)).toBeCloseTo(1, 12);
    }
  });

  it("inOutCubic passes through 0.5 at the midpoint", () => {
    expect(EASINGS.inOutCubic!(0.5)).toBeCloseTo(0.5, 12);
  });

  it("inCubic and outCubic bracket linear", () => {
    expect(EASINGS.inCubic!(0.5)).toBeLessThan(0.5);
    expect(EASINGS.outCubic!(0.5)).toBeGreaterThan(0.5);
  });

  it("spring overshoots above 1 before settling", () => {
    const peak = Math.max(...Array.from({ length: 99 }, (_, i) => EASINGS.spring!((i + 1) / 100)));
    expect(peak).toBeGreaterThan(1);
  });

  it("isEasing / getEasing", () => {
    expect(isEasing("linear")).toBe(true);
    expect(isEasing("nope")).toBe(false);
    expect(getEasing("linear")(0.3)).toBeCloseTo(0.3, 12);
    expect(() => getEasing("nope")).toThrow();
  });
});
