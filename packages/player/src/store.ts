// StateStore — a signal per parameter for the DOM layers, plus a plain-object
// mirror for the hot render path. Signals are written only on actual change to
// avoid churn. Also holds per-parameter interaction metadata (used by the M2
// Reconciler).

import { signal, type Signal } from "@preact/signals-core";
import type { Schema, ParamValue, PlainState, OrbitState } from "@xv/core";

export interface InteractionMeta {
  userValue?: ParamValue;
  lastTouched: number;
  touchedEver: boolean;
}

export class StateStore {
  readonly signals = new Map<string, Signal<ParamValue>>();
  readonly plain: PlainState = {};
  readonly meta = new Map<string, InteractionMeta>();

  constructor(schema: Schema) {
    for (const [key, spec] of Object.entries(schema)) {
      const v = clone(spec.default);
      this.signals.set(key, signal(v));
      this.plain[key] = v;
      this.meta.set(key, { lastTouched: -Infinity, touchedEver: false });
    }
  }

  keys(): string[] {
    return [...this.signals.keys()];
  }

  signal(key: string): Signal<ParamValue> {
    const s = this.signals.get(key);
    if (!s) throw new Error(`unknown parameter: ${key}`);
    return s;
  }

  /** Write a displayed value; updates the signal + mirror only if it changed. */
  set(key: string, value: ParamValue): void {
    const cur = this.plain[key];
    if (cur !== undefined && valuesEqual(cur, value)) return;
    const stored = writeInto(cur, value);
    this.plain[key] = stored;
    this.signals.get(key)!.value = stored;
  }

  /** Record a user interaction on a parameter (for the Reconciler). */
  touch(key: string, value: ParamValue, now: number): void {
    const m = this.meta.get(key);
    if (!m) return;
    m.userValue = clone(value);
    m.lastTouched = now;
    m.touchedEver = true;
  }
}

// --- value helpers (avoid churn; keep `plain` self-owned) ---

export function valuesEqual(a: ParamValue, b: ParamValue): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  if (isOrbit(a) && isOrbit(b))
    return (
      a.distance === b.distance &&
      a.azimuth === b.azimuth &&
      a.elevation === b.elevation &&
      a.target.every((x, i) => x === b.target[i])
    );
  return false;
}

/** Write `value` into the existing slot when possible (reuse arrays/orbit objects). */
function writeInto(cur: ParamValue | undefined, value: ParamValue): ParamValue {
  if (Array.isArray(value)) {
    if (Array.isArray(cur) && cur.length === value.length) {
      for (let i = 0; i < value.length; i++) cur[i] = value[i]!;
      return cur;
    }
    return value.slice();
  }
  if (isOrbit(value)) {
    if (isOrbit(cur)) {
      cur.target[0] = value.target[0];
      cur.target[1] = value.target[1];
      cur.target[2] = value.target[2];
      cur.distance = value.distance;
      cur.azimuth = value.azimuth;
      cur.elevation = value.elevation;
      return cur;
    }
    return clone(value);
  }
  return value;
}

function clone(v: ParamValue): ParamValue {
  if (Array.isArray(v)) return v.slice();
  if (isOrbit(v)) return { target: [...v.target] as [number, number, number], distance: v.distance, azimuth: v.azimuth, elevation: v.elevation };
  return v;
}

function isOrbit(v: unknown): v is OrbitState {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "azimuth" in v;
}
