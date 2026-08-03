// The interpolator — value-at-time. evaluate(index, t) returns the full scripted
// state at time t by looking up each track's bracketing keyframes and interpolating
// with the param's kernel. Correctness never depends on call order (seekability);
// the per-track cursor is only a speed hint. Steady state is allocation-free.

import type { Keyframe, InterpolateMode, ParamValue, Schema, PlainState, OrbitState } from "./types.js";
import { getEasing } from "./easing.js";

interface TrackEntry {
  keyframes: Keyframe[];
  mode: InterpolateMode;
  def: ParamValue;
  cursor: number; // last segment index; a hint, not authoritative
}

export interface TrackIndex {
  entries: Record<string, TrackEntry>;
  keys: string[];
}

/** Precompute a per-track index from compiled tracks + the scene schema. */
export function buildIndex(tracks: Record<string, Keyframe[]>, schema: Schema): TrackIndex {
  const entries: Record<string, TrackEntry> = {};
  for (const [key, spec] of Object.entries(schema)) {
    entries[key] = {
      keyframes: tracks[key] ?? [],
      mode: spec.interpolate,
      def: spec.default,
      cursor: 0,
    };
  }
  return { entries, keys: Object.keys(entries) };
}

/** Largest index i with keyframes[i].t <= t, or -1 if t precedes the first. */
function findSegment(kf: Keyframe[], t: number, hint: number): number {
  const n = kf.length;
  if (n === 0) return -1;
  if (t < kf[0]!.t) return -1;
  if (t >= kf[n - 1]!.t) return n - 1;
  // Fast path: the hint segment still brackets t.
  if (hint >= 0 && hint < n - 1 && kf[hint]!.t <= t && t < kf[hint + 1]!.t) return hint;
  // Binary search for the bracket.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (kf[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Evaluate the full scripted state at time t, writing into (and returning) `out`. */
export function evaluate(index: TrackIndex, t: number, out: PlainState = {}): PlainState {
  for (const key of index.keys) {
    const e = index.entries[key]!;
    const kf = e.keyframes;
    const i = findSegment(kf, t, e.cursor);
    e.cursor = i < 0 ? 0 : i;

    if (i < 0) {
      assignInto(out, key, e.def); // before first keyframe → schema default
      continue;
    }
    const k0 = kf[i]!;
    const next = kf[i + 1];
    // Last keyframe, or a hold segment (no easing into next), or a snap track.
    if (!next || next.ease === undefined || e.mode === "snap") {
      assignInto(out, key, k0.v);
      continue;
    }
    const dur = next.t - k0.t;
    const localT = dur > 0 ? (t - k0.t) / dur : 1;
    const u = getEasing(next.ease)(localT);
    interpInto(out, key, e.mode, k0.v, next.v, u);
  }
  return out;
}

// --- assignment (copy, never alias source data into `out`) ---

function assignInto(out: PlainState, key: string, v: ParamValue): void {
  if (Array.isArray(v)) {
    const dst = ensureArray(out, key, v.length);
    for (let j = 0; j < v.length; j++) dst[j] = v[j]!;
  } else if (isOrbit(v)) {
    copyOrbit(ensureOrbit(out, key), v);
  } else {
    out[key] = v;
  }
}

function ensureArray(out: PlainState, key: string, len: number): number[] {
  const cur = out[key];
  if (Array.isArray(cur) && cur.length === len) return cur;
  const arr = new Array<number>(len).fill(0);
  out[key] = arr;
  return arr;
}

function ensureOrbit(out: PlainState, key: string): OrbitState {
  const cur = out[key];
  if (isOrbit(cur)) return cur;
  const o: OrbitState = { target: [0, 0, 0], distance: 0, azimuth: 0, elevation: 0 };
  out[key] = o;
  return o;
}

function copyOrbit(dst: OrbitState, src: OrbitState): void {
  dst.target[0] = src.target[0];
  dst.target[1] = src.target[1];
  dst.target[2] = src.target[2];
  dst.distance = src.distance;
  dst.azimuth = src.azimuth;
  dst.elevation = src.elevation;
}

// --- interpolation kernels ---

function interpInto(out: PlainState, key: string, mode: InterpolateMode, a: ParamValue, b: ParamValue, u: number): void {
  switch (mode) {
    case "lerp":
      if (typeof a === "number" && typeof b === "number") out[key] = a + (b - a) * u;
      else lerpArrayInto(ensureArray(out, key, (a as number[]).length), a as number[], b as number[], u);
      return;
    case "nlerp":
      nlerpInto(ensureArray(out, key, (a as number[]).length), a as number[], b as number[], u);
      return;
    case "orbit":
      orbitInto(ensureOrbit(out, key), a as OrbitState, b as OrbitState, u);
      return;
    case "typewriter":
      out[key] = typewriter(a as string, b as string, u);
      return;
    case "snap":
      assignInto(out, key, a); // snap holds the from-value (handled upstream too)
      return;
  }
}

/** Delete to the shared prefix, then type the target; newlines add a short pause. */
function typewriter(a: string, b: string, u: number): string {
  if (u <= 0) return a;
  if (u >= 1) return b;
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;

  const deleted = [...a.slice(shared)].reverse();
  const inserted = [...b.slice(shared)];
  const weight = (char: string) => char === "\n" ? 4 : 1;
  const total = [...deleted, ...inserted].reduce((sum, char) => sum + weight(char), 0);
  let budget = u * total;
  let remaining = a.length;
  for (const char of deleted) {
    const cost = weight(char);
    if (budget < cost) return a.slice(0, remaining);
    budget -= cost;
    remaining--;
  }
  let typed = "";
  for (const char of inserted) {
    const cost = weight(char);
    if (budget < cost) break;
    budget -= cost;
    typed += char;
  }
  return a.slice(0, shared) + typed;
}

function lerpArrayInto(dst: number[], a: number[], b: number[], u: number): void {
  for (let j = 0; j < a.length; j++) dst[j] = a[j]! + (b[j]! - a[j]!) * u;
}

/** Normalized lerp with shortest-path sign fix; for quaternions and axis vectors. */
function nlerpInto(dst: number[], a: number[], b: number[], u: number): void {
  let dot = 0;
  for (let j = 0; j < a.length; j++) dot += a[j]! * b[j]!;
  const s = dot < 0 ? -1 : 1; // flip b to the near hemisphere
  let mag = 0;
  for (let j = 0; j < a.length; j++) {
    const val = a[j]! + (s * b[j]! - a[j]!) * u;
    dst[j] = val;
    mag += val * val;
  }
  mag = Math.sqrt(mag) || 1;
  for (let j = 0; j < dst.length; j++) dst[j]! /= mag;
}

// Scratch direction vectors reused across orbit evaluations (allocation-free).
const _dirA: [number, number, number] = [0, 0, 0];
const _dirB: [number, number, number] = [0, 0, 0];

/** Orbit interpolation: nlerp the view direction, lerp distance and target separately. */
function orbitInto(dst: OrbitState, a: OrbitState, b: OrbitState, u: number): void {
  sphericalTo(_dirA, a.azimuth, a.elevation);
  sphericalTo(_dirB, b.azimuth, b.elevation);
  const dot = _dirA[0] * _dirB[0] + _dirA[1] * _dirB[1] + _dirA[2] * _dirB[2];
  const s = dot < 0 ? -1 : 1;
  let x = _dirA[0] + (s * _dirB[0] - _dirA[0]) * u;
  let y = _dirA[1] + (s * _dirB[1] - _dirA[1]) * u;
  let z = _dirA[2] + (s * _dirB[2] - _dirA[2]) * u;
  const mag = Math.sqrt(x * x + y * y + z * z) || 1;
  x /= mag;
  y /= mag;
  z /= mag;
  dst.azimuth = Math.atan2(x, z);
  dst.elevation = Math.asin(Math.max(-1, Math.min(1, y)));
  dst.distance = a.distance + (b.distance - a.distance) * u;
  for (let j = 0; j < 3; j++) dst.target[j] = a.target[j]! + (b.target[j]! - a.target[j]!) * u;
}

/** Unit direction from azimuth (around +Y) and elevation (from the XZ plane). */
function sphericalTo(out: [number, number, number], az: number, el: number): void {
  const ce = Math.cos(el);
  out[0] = ce * Math.sin(az);
  out[1] = Math.sin(el);
  out[2] = ce * Math.cos(az);
}

function isOrbit(v: unknown): v is OrbitState {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "azimuth" in v;
}

// --- pure kernels for the Reconciler's frame-by-frame blend (§5.5) ---

/** Blend from a toward b by u using the given kernel; returns a fresh value. */
export function blend(mode: InterpolateMode, a: ParamValue, b: ParamValue, u: number): ParamValue {
  if (mode === "snap") return b;
  const out: PlainState = {};
  interpInto(out, "v", mode, a, b, u);
  return out["v"]!;
}

/** Structural convergence test (scalar / vector / orbit) within epsilon. */
export function converged(a: ParamValue, b: ParamValue, eps: number): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= eps;
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i]! - b[i]!) > eps) return false;
    return true;
  }
  if (isOrbit(a) && isOrbit(b)) {
    return (
      Math.abs(a.distance - b.distance) <= eps &&
      Math.abs(a.azimuth - b.azimuth) <= eps &&
      Math.abs(a.elevation - b.elevation) <= eps &&
      a.target.every((x, i) => Math.abs(x - b.target[i]!) <= eps)
    );
  }
  return a === b;
}
