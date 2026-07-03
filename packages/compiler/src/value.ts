// Interpret a raw cue value token against a parameter's type. Supports numbers,
// booleans, enum strings, vectors/quaternions ([a, b, c]), and named constants
// declared by the scene module.

import type { ParamType, ParamValue } from "@narrable/core";
import { validateValue } from "@narrable/core";

export type Constants = Record<string, number | number[]>;

export function parseValue(
  type: ParamType,
  raw: string,
  constants: Constants = {},
): { value?: ParamValue; error?: string } {
  const r = raw.trim();

  // Named constant resolves first (may be a scalar or a vector).
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(r) && r in constants) {
    const cv = constants[r]!;
    const err = validateValue(type, cv);
    return err ? { error: `constant ${r} ${err}` } : { value: cv };
  }

  let value: ParamValue;
  switch (type.kind) {
    case "scalar": {
      const n = Number(r);
      if (!Number.isFinite(n)) return { error: `expected a number, got "${raw}"` };
      value = n;
      break;
    }
    case "boolean":
      if (r !== "true" && r !== "false") return { error: `expected true/false, got "${raw}"` };
      value = r === "true";
      break;
    case "enum":
    case "boardItem":
      value = unquote(r);
      break;
    case "vec2":
    case "vec3":
    case "quaternion": {
      const arr = parseNumberArray(r);
      if (!arr) return { error: `expected a numeric array, got "${raw}"` };
      value = arr;
      break;
    }
    case "orbit":
      return { error: "orbit values come from camera presets or recorded tracks, not inline cues" };
  }

  const err = validateValue(type, value);
  if (err) return { error: `${err} (got "${raw}")` };

  // Range clamp is not applied here — out-of-range is a check error, not silent clamping.
  if (type.kind === "scalar" && type.range && typeof value === "number") {
    const [lo, hi] = type.range;
    if (value < lo || value > hi) return { error: `${value} is out of range [${lo}, ${hi}]` };
  }
  return { value };
}

function parseNumberArray(r: string): number[] | null {
  const m = r.match(/^\[(.*)\]$/s);
  if (!m) return null;
  const parts = m[1]!.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  const nums = parts.map(Number);
  return nums.every((n) => Number.isFinite(n)) ? nums : null;
}

function unquote(s: string): string {
  return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}
