// TimelineDriver — the per-frame loop. Reads the clock, evaluates scripted
// value-at-time state, reconciles interaction, and writes the display state.

import { evaluate, type TrackIndex, type PlainState } from "@narrable/core";
import type { AudioClock } from "./clock.js";
import type { StateStore } from "./store.js";
import type { Reconciler } from "./reconciler.js";

export interface DriverHooks {
  onSeek?: (t: number) => void;
  onFrame?: (t: number) => void;
  now?: () => number; // wall-clock seconds; injectable for tests
}

const SEEK_THRESHOLD = 0.25; // s between consecutive frames that implies a seek

export class TimelineDriver {
  private buf: PlainState = {};
  private lastT = 0;
  private lastNow = -1;
  private raf = 0;
  private running = false;
  private lastPlaying: boolean;

  constructor(
    private clock: AudioClock,
    private index: TrackIndex,
    private store: StateStore,
    private hooks: DriverHooks = {},
    private reconciler?: Reconciler,
  ) {
    this.lastPlaying = clock.playing;
  }

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
    const now = this.hooks.now?.() ?? performance.now() / 1000;
    const dt = this.lastNow < 0 ? 0 : Math.max(0, now - this.lastNow);
    const seeked = Math.abs(t - this.lastT) > SEEK_THRESHOLD;
    const playing = this.clock.playing;

    evaluate(this.index, t, this.buf);
    if (seeked) this.reconciler?.reset();
    if (!seeked && this.lastPlaying && !playing) this.reconciler?.freeze(t);
    if (!seeked && !this.lastPlaying && playing) this.reconciler?.resume(t);
    if (this.reconciler) this.reconciler.reconcile(this.buf, t, dt, playing);
    else for (const key of this.index.keys) this.store.set(key, this.buf[key]!);

    if (seeked) this.hooks.onSeek?.(t);
    this.hooks.onFrame?.(t);
    this.lastT = t;
    this.lastNow = now;
    this.lastPlaying = playing;
  }
}
