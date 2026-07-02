// Chrome — the controls bar: play/pause, elapsed/remaining, scrubber with chapter
// and pause-checkpoint ticks, captions toggle, fullscreen, keyboard shortcuts.

import type { LessonTracks } from "@xv/core";
import type { AudioClock } from "./clock.js";

/** m:ss (or h:mm:ss) for the readouts. */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Marker positions (0..1) along the scrubber for chapters and pause checkpoints. */
export function tickFractions(tracks: LessonTracks): { chapters: number[]; pauses: number[] } {
  const d = tracks.duration || 1;
  return {
    chapters: tracks.chapters.map((c) => c.t / d),
    pauses: tracks.pauses.map((p) => p.t / d),
  };
}

export interface ChromeOptions {
  onCaptionsToggle?: (on: boolean) => void;
}

export class Chrome {
  readonly el: HTMLElement;
  private playBtn: HTMLButtonElement;
  private scrubber: HTMLInputElement;
  private elapsed: HTMLElement;
  private captionsOn = true;

  constructor(
    private clock: AudioClock,
    private tracks: LessonTracks,
    opts: ChromeOptions = {},
  ) {
    const doc = document;
    this.el = div("xv-chrome");

    this.playBtn = doc.createElement("button");
    this.playBtn.className = "xv-play";
    this.playBtn.textContent = "▶";
    this.playBtn.onclick = () => this.togglePlay();

    this.scrubber = doc.createElement("input");
    this.scrubber.type = "range";
    this.scrubber.min = "0";
    this.scrubber.max = "1000";
    this.scrubber.value = "0";
    this.scrubber.className = "xv-scrubber";
    this.scrubber.oninput = () => this.clock.seek((Number(this.scrubber.value) / 1000) * this.duration());

    this.elapsed = div("xv-elapsed");
    this.elapsed.textContent = "0:00 / 0:00";

    const captions = doc.createElement("button");
    captions.className = "xv-captions-toggle";
    captions.textContent = "CC";
    captions.onclick = () => {
      this.captionsOn = !this.captionsOn;
      opts.onCaptionsToggle?.(this.captionsOn);
    };

    const full = doc.createElement("button");
    full.className = "xv-fullscreen";
    full.textContent = "⛶";
    full.onclick = () => void this.el.closest(".xv-player")?.requestFullscreen?.();

    this.el.append(this.playBtn, this.scrubber, this.elapsed, captions, full);
    this.clock.on("play", () => (this.playBtn.textContent = "⏸"));
    this.clock.on("pause", () => (this.playBtn.textContent = "▶"));
  }

  /** Global keyboard shortcuts; returns a disposer. */
  bindKeys(target: Window | HTMLElement = window): () => void {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === "f") this.el.closest(".xv-player")?.requestFullscreen?.();
      else if (e.key === "ArrowRight") this.clock.seek(this.clock.t + 5);
      else if (e.key === "ArrowLeft") this.clock.seek(this.clock.t - 5);
    };
    (target as HTMLElement).addEventListener("keydown", onKey as EventListener);
    return () => (target as HTMLElement).removeEventListener("keydown", onKey as EventListener);
  }

  update(t: number): void {
    const d = this.duration();
    this.scrubber.value = String(d > 0 ? Math.round((t / d) * 1000) : 0);
    this.elapsed.textContent = `${formatTime(t)} / ${formatTime(d)}`;
  }

  private togglePlay(): void {
    if (this.clock.playing) this.clock.pause();
    else this.clock.play();
  }

  private duration(): number {
    return this.clock.duration || this.tracks.duration;
  }
}

function div(className: string): HTMLElement {
  const d = document.createElement("div");
  d.className = className;
  return d;
}
