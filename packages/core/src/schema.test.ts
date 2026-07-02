import { describe, it, expect } from "vitest";
import { validateSchema, validateValue, clampValue, schemaHash } from "./schema.js";
import type { ParamType, Schema } from "./types.js";

describe("validateSchema — interpolate-for-type legality", () => {
  const cases: { type: ParamType; interpolate: string; legal: boolean }[] = [
    { type: { kind: "scalar" }, interpolate: "lerp", legal: true },
    { type: { kind: "scalar" }, interpolate: "nlerp", legal: false },
    { type: { kind: "quaternion" }, interpolate: "nlerp", legal: true },
    { type: { kind: "quaternion" }, interpolate: "lerp", legal: false },
    { type: { kind: "orbit" }, interpolate: "orbit", legal: true },
    { type: { kind: "orbit" }, interpolate: "lerp", legal: false },
    { type: { kind: "vec3" }, interpolate: "nlerp", legal: true },
    { type: { kind: "boolean" }, interpolate: "snap", legal: true },
    { type: { kind: "boolean" }, interpolate: "lerp", legal: false },
    { type: { kind: "enum", values: ["a", "b"] }, interpolate: "snap", legal: true },
  ];

  for (const { type, interpolate, legal } of cases) {
    it(`${type.kind} + ${interpolate} → ${legal ? "legal" : "illegal"}`, () => {
      const schema: Schema = {
        p: { type, default: defaultFor(type), interpolate: interpolate as never, ownership: "script" },
      };
      const errors = validateSchema(schema);
      expect(errors.length === 0).toBe(legal);
    });
  }
});

describe("validateValue", () => {
  it("scalar accepts finite numbers, rejects NaN and non-numbers", () => {
    expect(validateValue({ kind: "scalar" }, 1.5)).toBeNull();
    expect(validateValue({ kind: "scalar" }, NaN)).not.toBeNull();
    expect(validateValue({ kind: "scalar" }, "x")).not.toBeNull();
  });
  it("vec3 needs exactly three numbers", () => {
    expect(validateValue({ kind: "vec3" }, [1, 2, 3])).toBeNull();
    expect(validateValue({ kind: "vec3" }, [1, 2])).not.toBeNull();
  });
  it("quaternion needs four numbers", () => {
    expect(validateValue({ kind: "quaternion" }, [1, 0, 0, 0])).toBeNull();
    expect(validateValue({ kind: "quaternion" }, [1, 0, 0])).not.toBeNull();
  });
  it("enum requires a listed value", () => {
    const t: ParamType = { kind: "enum", values: ["a", "b"] };
    expect(validateValue(t, "a")).toBeNull();
    expect(validateValue(t, "c")).not.toBeNull();
  });
  it("boardItem requires hidden/shown/dimmed", () => {
    expect(validateValue({ kind: "boardItem" }, "shown")).toBeNull();
    expect(validateValue({ kind: "boardItem" }, "glowing")).not.toBeNull();
  });
  it("orbit requires the full shape", () => {
    expect(
      validateValue({ kind: "orbit" }, { target: [0, 0, 0], distance: 5, azimuth: 0, elevation: 0 }),
    ).toBeNull();
    expect(validateValue({ kind: "orbit" }, [0, 0, 0])).not.toBeNull();
  });
});

describe("clampValue", () => {
  it("clamps scalars to range", () => {
    const t: ParamType = { kind: "scalar", range: [0, 1] };
    expect(clampValue(t, 2)).toBe(1);
    expect(clampValue(t, -1)).toBe(0);
    expect(clampValue(t, 0.5)).toBe(0.5);
  });
  it("passes through when no range", () => {
    expect(clampValue({ kind: "scalar" }, 42)).toBe(42);
  });
});

describe("schemaHash", () => {
  const base: Schema = {
    theta: { type: { kind: "scalar", range: [0, 6.28] }, default: 0, interpolate: "lerp", ownership: "script" },
    q: { type: { kind: "quaternion" }, default: [1, 0, 0, 0], interpolate: "nlerp", ownership: "script" },
  };

  it("is independent of key insertion order", () => {
    const reordered: Schema = { q: base.q!, theta: base.theta! };
    expect(schemaHash(reordered)).toBe(schemaHash(base));
  });
  it("ignores the cosmetic label field", () => {
    const withLabel: Schema = { ...base, theta: { ...base.theta!, label: "angle" } };
    expect(schemaHash(withLabel)).toBe(schemaHash(base));
  });
  it("changes when a structural field changes", () => {
    const changed: Schema = { ...base, theta: { ...base.theta!, ownership: "viewer" } };
    expect(schemaHash(changed)).not.toBe(schemaHash(base));
  });
});

function defaultFor(type: ParamType) {
  switch (type.kind) {
    case "scalar":
      return 0;
    case "vec2":
      return [0, 0];
    case "vec3":
      return [0, 0, 0];
    case "quaternion":
      return [1, 0, 0, 0];
    case "orbit":
      return { target: [0, 0, 0] as [number, number, number], distance: 1, azimuth: 0, elevation: 0 };
    case "boolean":
      return false;
    case "enum":
      return type.values[0]!;
    case "boardItem":
      return "hidden";
  }
}
