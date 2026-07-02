import { describe, it, expect } from "vitest";
import {
  blendRetain,
  approachU,
  approachScalar,
  holdActive,
  convergedScalar,
  maxAbsDiff,
  DEFAULT_TAU,
} from "./reconcile.js";

describe("blendRetain", () => {
  it("retains ≈0.92 of the gap per frame at 60fps (matches the exemplar)", () => {
    expect(blendRetain(1 / 60, DEFAULT_TAU)).toBeCloseTo(0.92, 2);
  });
  it("retains all at dt=0 and nothing as dt→∞", () => {
    expect(blendRetain(0)).toBe(1);
    expect(blendRetain(100)).toBeLessThan(1e-6);
  });
});

describe("approachScalar — frame-rate independence", () => {
  it("two half-steps ≈ one full step (exp composes)", () => {
    const prev = 10;
    const target = 0;
    const dt = 0.1;
    const oneStep = approachScalar(prev, target, dt);
    const half = approachScalar(prev, target, dt / 2);
    const twoHalf = approachScalar(half, target, dt / 2);
    expect(twoHalf).toBeCloseTo(oneStep, 12);
  });
  it("monotonically approaches the target", () => {
    let v = 10;
    for (let i = 0; i < 200; i++) v = approachScalar(v, 0, 1 / 60);
    expect(v).toBeCloseTo(0, 3);
  });
});

describe("approachU", () => {
  it("is 0 at dt=0 and → 1 as dt grows", () => {
    expect(approachU(0)).toBe(0);
    expect(approachU(100)).toBeGreaterThan(0.999999);
  });
  it("is consistent with approachScalar (u toward target)", () => {
    const prev = 4;
    const target = 10;
    const dt = 0.05;
    const u = approachU(dt);
    expect(prev + (target - prev) * u).toBeCloseTo(approachScalar(prev, target, dt), 12);
  });
});

describe("holdActive", () => {
  it("true inside the window, false at/after the boundary", () => {
    expect(holdActive(2, 0, 3)).toBe(true);
    expect(holdActive(3, 0, 3)).toBe(false);
    expect(holdActive(3.1, 0, 3)).toBe(false);
  });
});

describe("convergence tests", () => {
  it("convergedScalar within epsilon", () => {
    expect(convergedScalar(0.0005, 0, 1e-3)).toBe(true);
    expect(convergedScalar(0.01, 0, 1e-3)).toBe(false);
  });
  it("maxAbsDiff is the largest component gap", () => {
    expect(maxAbsDiff([1, 2, 3], [1, 2.5, 1])).toBeCloseTo(2, 12);
  });
});
