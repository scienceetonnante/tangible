// Chrome — the controls bar: play/pause, elapsed/remaining, scrubber with chapter
// and pause-checkpoint ticks, captions toggle, fullscreen, keyboard shortcuts.

import type { LessonTracks } from "@narrable/core";
import type { AudioClock } from "./clock.js";
import { pauseTime } from "./pause-gate.js";

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
    pauses: tracks.pauses.map((p) => pauseTime(p, d) / d),
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
  private captionsOn = false;
  private scrubbing = false;
  private scrubTimer?: ReturnType<typeof setTimeout>;

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
    // Seek live while dragging; suppress the frame loop's value writes so the drag
    // isn't fought back to the playhead. Driven by `input` (fires on every value
    // change in all browsers) with a watchdog — robust to flaky pointer events on
    // range inputs. `change` (release) and the timeout clear it.
    const beginScrub = () => {
      this.scrubbing = true;
      clearTimeout(this.scrubTimer);
      this.scrubTimer = setTimeout(() => (this.scrubbing = false), 400);
    };
    this.scrubber.addEventListener("input", () => {
      this.clock.seek((Number(this.scrubber.value) / 1000) * this.duration());
      beginScrub();
    });
    this.scrubber.addEventListener("pointerdown", beginScrub);
    this.scrubber.addEventListener("change", () => {
      clearTimeout(this.scrubTimer);
      this.scrubbing = false;
    });

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
    full.onclick = () => this.toggleFullscreen();

    this.el.append(this.playBtn, this.scrubber, this.elapsed, captions, full);
  }

  /** Global keyboard shortcuts; returns a disposer. */
  bindKeys(target: Window | HTMLElement = window): () => void {
    const onKey = (e: KeyboardEvent) => {
      const source = e.target as HTMLElement | null;
      if (source?.matches("input, textarea, select, button, [contenteditable=true]")) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === "f") this.toggleFullscreen();
      else if (e.key === "ArrowRight") this.clock.seek(this.clock.t + 5);
      else if (e.key === "ArrowLeft") this.clock.seek(this.clock.t - 5);
    };
    (target as HTMLElement).addEventListener("keydown", onKey as EventListener);
    return () => (target as HTMLElement).removeEventListener("keydown", onKey as EventListener);
  }

  update(t: number): void {
    const d = this.duration();
    if (!this.scrubbing) this.scrubber.value = String(d > 0 ? Math.round((t / d) * 1000) : 0);
    this.elapsed.textContent = `${formatTime(t)} / ${formatTime(d)}`;
    // Drive the icon from the actual state (robust to browsers that fire media
    // play/pause events unreliably, e.g. Safari).
    this.playBtn.textContent = this.clock.playing ? "⏸" : "▶";
  }

  private togglePlay(): void {
    if (this.clock.playing) this.clock.pause();
    else this.clock.play();
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void (this.el.closest(".xv-shell") ?? this.el.closest(".xv-player"))?.requestFullscreen?.();
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
