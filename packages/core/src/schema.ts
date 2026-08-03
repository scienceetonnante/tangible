// Schema utilities: legal interpolate-for-type validation, value validation/clamping,
// and a stable schemaHash for player/scene/tracks compatibility checks.

import type { ParamType, ParamValue, ParamSpec, Schema, OrbitState } from "./types.js";

const BOARD_STATES = ["hidden", "shown", "dimmed"] as const;

// Which interpolate modes are legal for each parameter kind. "snap" is always legal.
const LEGAL_INTERPOLATE: Record<ParamType["kind"], readonly string[]> = {
  scalar: ["lerp", "snap"],
  vec2: ["lerp", "snap"],
  vec3: ["lerp", "nlerp", "snap"], // nlerp for axis/direction vectors
  quaternion: ["nlerp", "snap"],
  orbit: ["orbit", "snap"],
  boolean: ["snap"],
  text: ["typewriter", "snap"],
  enum: ["snap"],
  boardItem: ["snap"],
};

/** Returns null if `v` is a valid value for `type`, else an error message. */
export function validateValue(type: ParamType, v: ParamValue): string | null {
  switch (type.kind) {
    case "scalar":
      if (typeof v !== "number" || !Number.isFinite(v)) return "expected a finite number";
      return null;
    case "vec2":
    case "vec3": {
      const n = type.kind === "vec2" ? 2 : 3;
      if (!Array.isArray(v) || v.length !== n || !v.every((x) => typeof x === "number"))
        return `expected a ${n}-number array`;
      return null;
    }
    case "quaternion":
      if (!Array.isArray(v) || v.length !== 4 || !v.every((x) => typeof x === "number"))
        return "expected a 4-number array [w, x, y, z]";
      return null;
    case "orbit":
      return isOrbit(v) ? null : "expected an OrbitState { target, distance, azimuth, elevation }";
    case "boolean":
      return typeof v === "boolean" ? null : "expected a boolean";
    case "text":
      return typeof v === "string" ? null : "expected text";
    case "enum":
      if (typeof v !== "string" || !type.values.includes(v))
        return `expected one of: ${type.values.join(", ")}`;
      return null;
    case "boardItem":
      return typeof v === "string" && (BOARD_STATES as readonly string[]).includes(v)
        ? null
        : `expected one of: ${BOARD_STATES.join(", ")}`;
  }
}

function isOrbit(v: ParamValue): v is OrbitState {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Array.isArray((v as OrbitState).target) &&
    (v as OrbitState).target.length === 3 &&
    typeof (v as OrbitState).distance === "number" &&
    typeof (v as OrbitState).azimuth === "number" &&
    typeof (v as OrbitState).elevation === "number"
  );
}

/** Clamp a scalar to its declared range; other types pass through unchanged. */
export function clampValue(type: ParamType, v: ParamValue): ParamValue {
  if (type.kind === "scalar" && type.range && typeof v === "number") {
    const [lo, hi] = type.range;
    return Math.min(hi, Math.max(lo, v));
  }
  return v;
}

/** Validate a whole schema; returns a list of "key: message" errors (empty if valid). */
export function validateSchema(schema: Schema): string[] {
  const errors: string[] = [];
  for (const [key, spec] of Object.entries(schema)) {
    if (!LEGAL_INTERPOLATE[spec.type.kind].includes(spec.interpolate))
      errors.push(
        `${key}: interpolate "${spec.interpolate}" is illegal for type "${spec.type.kind}" ` +
          `(legal: ${LEGAL_INTERPOLATE[spec.type.kind].join(", ")})`,
      );
    const valErr = validateValue(spec.type, spec.default);
    if (valErr) errors.push(`${key}: default ${valErr}`);
  }
  return errors;
}

/** Stable 53-bit hash (cyrb53) of a string. */
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return hash.toString(16).padStart(14, "0");
}

/** Canonical, key-order-independent structural fingerprint of one spec. */
function canonicalSpec(spec: ParamSpec): string {
  const extras =
    spec.type.kind === "enum"
      ? `values=${spec.type.values.join(",")}`
      : spec.type.kind === "scalar" && spec.type.range
        ? `range=${spec.type.range.join(",")}`
        : "";
  return `${spec.type.kind}|${extras}|${spec.interpolate}|${spec.ownership}|${JSON.stringify(spec.default)}`;
}

/** Stable hash guarding player/scene/tracks compatibility; independent of key order. */
export function schemaHash(schema: Schema): string {
  const canonical = Object.keys(schema)
    .sort()
    .map((k) => `${k}=${canonicalSpec(schema[k]!)}`)
    .join(";");
  return cyrb53(canonical);
}
