// Reconciler — merges scripted state with user interaction per parameter (§5.5).
// While dragging, the user wins. After a touch: `viewer` sticks forever; `script`
// holds for HOLD then glides back exponentially (discrete types revert instantly);
// `shared` holds until the script's next keyframe, then glides. On seek, all
// interaction clears and the display rejoins the narration.

import { blend, converged, holdActive, approachU, type TrackIndex, type Schema, type ParamValue, type PlainState } from "@xv/core";
import type { StateStore } from "./store.js";

const EPS = 1e-3; // convergence epsilon to snap-and-clear a gliding parameter

export interface ReconcilerConfig {
  hold?: number; // seconds; default DEFAULT_HOLD
  tau?: number; // seconds; default DEFAULT_TAU
}

export class Reconciler {
  private hold: number;
  private tau: number;
  private keys: string[];

  constructor(
    private store: StateStore,
    private index: TrackIndex,
    private schema: Schema,
    cfg: ReconcilerConfig = {},
  ) {
    this.hold = cfg.hold ?? 3;
    this.tau = cfg.tau ?? 0.2;
    this.keys = Object.keys(schema);
  }

  /** Merge scripted → displayed for every parameter and write to the store. */
  reconcile(scripted: PlainState, t: number, now: number, dt: number): void {
    for (const key of this.keys) this.store.set(key, this.compute(key, scripted[key]!, t, now, dt));
  }

  /** Clear all interaction state (called on seek). */
  reset(): void {
    this.store.resetInteractions();
  }

  private compute(key: string, sc: ParamValue, t: number, now: number, dt: number): ParamValue {
    const meta = this.store.meta.get(key)!;
    if (meta.dragging) return meta.userValue!;
    if (!meta.touchedEver || !meta.modified) return sc;

    const spec = this.schema[key]!;
    const prev = this.store.plain[key]!;
    const discrete = spec.interpolate === "snap";

    switch (spec.ownership) {
      case "viewer":
        return meta.userValue!;
      case "script":
        if (holdActive(now, meta.lastTouched, this.hold)) return meta.userValue!;
        return discrete ? this.revert(meta, sc) : this.glide(meta, prev, sc, spec.interpolate, dt);
      case "shared":
        if (t < this.nextKeyframeAfter(key, meta.touchT)) return meta.userValue!;
        return discrete ? this.revert(meta, sc) : this.glide(meta, prev, sc, spec.interpolate, dt);
    }
  }

  private revert(meta: { modified: boolean }, sc: ParamValue): ParamValue {
    meta.modified = false; // discrete types revert instantly
    return sc;
  }

  private glide(meta: { modified: boolean }, prev: ParamValue, sc: ParamValue, mode: Schema[string]["interpolate"], dt: number): ParamValue {
    const next = blend(mode, prev, sc, approachU(dt, this.tau));
    if (converged(next, sc, EPS)) {
      meta.modified = false;
      return sc;
    }
    return next;
  }

  private nextKeyframeAfter(key: string, touchT: number): number {
    for (const k of this.index.entries[key]?.keyframes ?? []) if (k.t > touchT) return k.t;
    return Infinity;
  }
}
