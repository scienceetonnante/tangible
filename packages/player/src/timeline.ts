// TimelineDriver — the per-frame loop. Reads the clock, evaluates the scripted
// state (value-at-time), and writes it to the store. In M1 scripted state flows
// straight to the store; the M2 Reconciler slots in between here and the store.

import { evaluate, type TrackIndex, type PlainState } from "@xv/core";
import type { AudioClock } from "./clock.js";
import type { StateStore } from "./store.js";

export interface DriverHooks {
  onSeek?: (t: number) => void;
  onFrame?: (t: number) => void;
}

const SEEK_THRESHOLD = 0.25; // s between consecutive frames that implies a seek

export class TimelineDriver {
  private buf: PlainState = {};
  private lastT = 0;
  private raf = 0;
  private running = false;

  constructor(
    private clock: AudioClock,
    private index: TrackIndex,
    private store: StateStore,
    private hooks: DriverHooks = {},
  ) {}

  start(): void {
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.tick();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  /** One frame; public so tests can step deterministically without rAF. */
  tick(): void {
    const t = this.clock.t;
    const seeked = Math.abs(t - this.lastT) > SEEK_THRESHOLD;

    evaluate(this.index, t, this.buf);
    for (const key of this.index.keys) this.store.set(key, this.buf[key]!);

    if (seeked) this.hooks.onSeek?.(t);
    this.hooks.onFrame?.(t);
    this.lastT = t;
  }
}
