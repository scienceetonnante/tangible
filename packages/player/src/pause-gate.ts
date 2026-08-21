// PauseGate — pause shortly after a narrated checkpoint. The scene stays fully
// interactive and ordinary playback resumes it. Seeking forward satisfies a gate
// silently; going back before it re-arms it.

import type { AudioClock } from "./clock.js";

interface Pause {
  t: number;
  id: string;
  prompt?: string;
  tail?: number;
}

export const PAUSE_TAIL_SECONDS = 0;

export function pauseTime(pause: Pick<Pause, "t" | "tail">, duration: number): number {
  const delayed = pause.t + (pause.tail ?? PAUSE_TAIL_SECONDS);
  // Stay just before `ended` so even a final checkpoint is explicitly resumable.
  return duration > 0 ? Math.min(delayed, Math.max(pause.t, duration - 0.05)) : delayed;
}

export class PauseGate {
  private satisfied = new Set<string>();
  private active?: Pause;
  private lastT = 0;

  constructor(
    private clock: AudioClock,
    private pauses: Pause[],
  ) {
    // Resuming playback by any means satisfies the active gate.
    this.clock.on("play", () => {
      if (this.active) this.resolve();
    });
  }

  update(t: number): void {
    const seeked = Math.abs(t - this.lastT) >= 0.5;

    for (const p of this.pauses) {
      const stopT = pauseTime(p, this.clock.duration);
      if (t < stopT) {
        this.satisfied.delete(p.id); // back before the gate → re-arm for the next crossing
        if (this.active?.id === p.id) this.active = undefined;
      } else if (this.satisfied.has(p.id)) {
        continue;
      } else if (seeked) {
        this.satisfied.add(p.id); // seeking forward past a gate satisfies it silently
      } else if (this.lastT <= stopT && stopT <= t && !this.active) {
        this.trigger(p, stopT); // played across it
        break;
      }
    }
    this.lastT = t;
  }

  /** Prompt for the authored gate that currently holds playback. */
  get activePrompt(): string | null {
    return this.active?.prompt ?? null;
  }

  private trigger(p: Pause, stopT: number): void {
    this.active = p;
    this.clock.pause();
    this.clock.seek(stopT);
  }

  private resolve(): void {
    if (this.active) this.satisfied.add(this.active.id);
    this.active = undefined;
  }
}
