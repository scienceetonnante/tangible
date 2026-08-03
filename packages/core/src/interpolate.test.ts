import { describe, it, expect } from "vitest";
import { buildIndex, evaluate } from "./interpolate.js";
import type { Keyframe, Schema, ParamValue } from "./types.js";

// Small seeded RNG so property-test failures reproduce.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function scalarTrack(r: () => number, n: number): Keyframe[] {
  const kf: Keyframe[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    t += r() * 3 + 0.1;
    kf.push({ t, v: r() * 10, ...(i > 0 && r() > 0.4 ? { ease: "inOutCubic" } : {}) });
  }
  return kf;
}

describe("evaluate — seekability (order independence)", () => {
  it("same index gives identical results regardless of evaluation order", () => {
    const r = rng(42);
    const schema: Schema = {
      a: { type: { kind: "scalar" }, default: 1, interpolate: "lerp", ownership: "script" },
      b: { type: { kind: "scalar" }, default: 2, interpolate: "lerp", ownership: "script" },
      flag: { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
    };
    const tracks = {
      a: scalarTrack(r, 6),
      b: scalarTrack(r, 5),
      flag: [
        { t: 0, v: false },
        { t: 4, v: true },
        { t: 9, v: false },
      ] as Keyframe[],
    };

    const times = Array.from({ length: 40 }, () => r() * 15);
    const ascending = [...times].sort((x, y) => x - y);

    // Ground truth: a fresh index evaluated in ascending order.
    const truthIndex = buildIndex(tracks, schema);
    const truth = new Map<number, ParamValue>();
    for (const t of ascending) truth.set(t, structuredClone(evaluate(truthIndex, t).a!));

    // Same index reused, times shuffled — cursor must not corrupt results.
    const idx = buildIndex(tracks, schema);
    const shuffled = [...times].sort(() => r() - 0.5);
    for (const t of shuffled) {
      const got = evaluate(idx, t).a;
      expect(got).toBeCloseTo(truth.get(t) as number, 12);
    }
  });
});

describe("evaluate — track semantics", () => {
  const schema: Schema = {
    x: { type: { kind: "scalar" }, default: 3, interpolate: "lerp", ownership: "script" },
  };
  it("returns the schema default before the first keyframe", () => {
    const idx = buildIndex({ x: [{ t: 5, v: 10 }] }, schema);
    expect(evaluate(idx, 2).x).toBe(3);
  });
  it("holds the last keyframe after the end", () => {
    const idx = buildIndex({ x: [{ t: 5, v: 10 }] }, schema);
    expect(evaluate(idx, 100).x).toBe(10);
  });
  it("holds (no glide) when the next keyframe has no easing, then snaps", () => {
    const idx = buildIndex(
      { x: [{ t: 0, v: 0 }, { t: 10, v: 100 }] }, // no ease → hold at 0 until t=10
      schema,
    );
    expect(evaluate(idx, 5).x).toBe(0);
    expect(evaluate(idx, 10).x).toBe(100);
  });
  it("eases into a keyframe when ease is present", () => {
    const idx = buildIndex({ x: [{ t: 0, v: 0 }, { t: 10, v: 100, ease: "linear" }] }, schema);
    expect(evaluate(idx, 5).x).toBeCloseTo(50, 9);
  });
});

describe("evaluate — continuity of continuous kernels", () => {
  it("no jumps for a lerp track with eased segments", () => {
    const r = rng(7);
    const schema: Schema = { x: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" } };
    const kf = scalarTrack(r, 8).map((k, i) => (i > 0 ? { ...k, ease: "inOutCubic" } : k));
    const idx = buildIndex({ x: kf }, schema);
    const end = kf[kf.length - 1]!.t;
    for (let i = 0; i < 500; i++) {
      const t = r() * end;
      const a = evaluate(idx, t).x as number;
      const b = evaluate(idx, t + 1e-6).x as number;
      expect(Math.abs(b - a)).toBeLessThan(1e-3);
    }
  });
});

describe("typewriter — deterministic text editing", () => {
  it("types appended text and pauses briefly at newlines", () => {
    const schema: Schema = {
      code: { type: { kind: "text" }, default: "", interpolate: "typewriter", ownership: "shared" },
    };
    const idx = buildIndex({ code: [{ t: 0, v: "" }, { t: 1, v: "a\nb", ease: "linear" }] }, schema);
    expect(evaluate(idx, 0).code).toBe("");
    expect(evaluate(idx, 0.2).code).toBe("a");
    expect(evaluate(idx, 0.5).code).toBe("a");
    expect(evaluate(idx, 1).code).toBe("a\nb");
  });

  it("deletes to the common prefix before typing a replacement", () => {
    const schema: Schema = {
      code: { type: { kind: "text" }, default: "cat", interpolate: "typewriter", ownership: "shared" },
    };
    const idx = buildIndex({ code: [{ t: 0, v: "cat" }, { t: 1, v: "car", ease: "linear" }] }, schema);
    expect(evaluate(idx, 0.6).code).toBe("ca");
    expect(evaluate(idx, 1).code).toBe("car");
  });
});

describe("nlerp — quaternion shortest path", () => {
  it("blends toward identity the short way for a near-antipodal representation", () => {
    // 350° about X ≡ -10°; its quaternion has negative w.
    const ang = (350 * Math.PI) / 180 / 2;
    const b = [Math.cos(ang), Math.sin(ang), 0, 0]; // w < 0
    const schema: Schema = {
      q: { type: { kind: "quaternion" }, default: [1, 0, 0, 0], interpolate: "nlerp", ownership: "script" },
    };
    const idx = buildIndex({ q: [{ t: 0, v: [1, 0, 0, 0] }, { t: 1, v: b, ease: "linear" }] }, schema);
    const mid = evaluate(idx, 0.5).q as number[];
    expect(mid[0]!).toBeGreaterThan(0.9); // stayed near identity, not through the long arc
    const mag = Math.hypot(...mid);
    expect(mag).toBeCloseTo(1, 9); // unit
  });
});

describe("orbit — never crosses the target", () => {
  it("distance stays strictly positive and between endpoints; direction stays unit", () => {
    const a = { target: [0, 0, 0] as [number, number, number], distance: 2, azimuth: 0, elevation: 0.1 };
    const b = { target: [1, 0, 0] as [number, number, number], distance: 8, azimuth: Math.PI, elevation: -0.3 };
    const schema: Schema = {
      cam: { type: { kind: "orbit" }, default: a, interpolate: "orbit", ownership: "viewer" },
    };
    const idx = buildIndex({ cam: [{ t: 0, v: a }, { t: 1, v: b, ease: "linear" }] }, schema);
    for (let i = 0; i <= 20; i++) {
      const o = evaluate(idx, i / 20).cam as {
        distance: number;
        azimuth: number;
        elevation: number;
      };
      expect(o.distance).toBeGreaterThan(0);
      expect(o.distance).toBeGreaterThanOrEqual(2 - 1e-9);
      expect(o.distance).toBeLessThanOrEqual(8 + 1e-9);
      const ce = Math.cos(o.elevation);
      const mag = Math.hypot(ce * Math.sin(o.azimuth), Math.sin(o.elevation), ce * Math.cos(o.azimuth));
      expect(mag).toBeCloseTo(1, 9);
    }
  });
});

describe("evaluate — allocation-free steady state", () => {
  it("reuses the same array instances in the out object across calls", () => {
    const schema: Schema = {
      v: { type: { kind: "vec3" }, default: [0, 0, 0], interpolate: "lerp", ownership: "script" },
    };
    const idx = buildIndex({ v: [{ t: 0, v: [0, 0, 0] }, { t: 1, v: [1, 2, 3], ease: "linear" }] }, schema);
    const out = {};
    evaluate(idx, 0.25, out);
    const ref = out["v" as keyof typeof out];
    evaluate(idx, 0.75, out);
    expect(out["v" as keyof typeof out]).toBe(ref); // no new allocation
  });
});
