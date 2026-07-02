// PauseGate — when playback crosses a checkpoint, pause and show a non-modal prompt
// (the scene stays fully interactive). Satisfied on resume; seeking past satisfies
// it; gates reset when seeking back to the start. Gates are per-playthrough.

import type { AudioClock } from "./clock.js";

interface Pause {
  t: number;
  id: string;
  prompt: string;
}

export class PauseGate {
  readonly el: HTMLElement;
  private satisfied = new Set<string>();
  private active?: Pause;
  private lastT = 0;
  private promptText: HTMLElement;

  constructor(
    private clock: AudioClock,
    private pauses: Pause[],
  ) {
    this.el = document.createElement("div");
    this.el.className = "xv-gate";
    const box = document.createElement("div");
    box.className = "xv-gate-box";
    this.promptText = document.createElement("p");
    const btn = document.createElement("button");
    btn.textContent = "Continue";
    btn.onclick = () => this.resume();
    box.append(this.promptText, btn);
    this.el.append(box);
    this.hide();
    // Resuming playback by any means satisfies the active gate.
    this.clock.on("play", () => {
      if (this.active) this.resolve();
    });
  }

  update(t: number): void {
    const dt = t - this.lastT;
    if (t < 0.5 && dt < 0) this.satisfied.clear(); // seek to start → new playthrough
    const seeked = Math.abs(dt) >= 0.5;

    for (const p of this.pauses) {
      if (this.satisfied.has(p.id)) continue;
      if (seeked && p.t <= t) {
        this.satisfied.add(p.id); // seeking past a gate satisfies it silently
      } else if (!seeked && this.lastT <= p.t && p.t <= t && !this.active) {
        this.trigger(p);
        break;
      }
    }
    this.lastT = t;
  }

  private trigger(p: Pause): void {
    this.active = p;
    this.promptText.textContent = p.prompt;
    this.el.style.display = "flex";
    this.clock.pause();
  }

  /** User asked to continue (button): satisfy and play. */
  private resume(): void {
    this.resolve();
    this.clock.play();
  }

  private resolve(): void {
    if (this.active) this.satisfied.add(this.active.id);
    this.active = undefined;
    this.hide();
  }

  private hide(): void {
    this.el.style.display = "none";
  }
}
