// AudioClock — the single source of truth for time. Wraps an <audio> element
// (webm + mp3 fallback); the driver polls `t` each frame. There is no internal
// clock, so nothing can drift.

// Minimal structural subset of HTMLAudioElement we rely on (also lets tests inject a stub).
export interface MediaClockSource {
  currentTime: number;
  readonly paused: boolean;
  readonly duration: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: string, listener: () => void): void;
}

export type ClockEvent = "play" | "pause" | "seeked" | "ended";

export class AudioClock {
  constructor(private media: MediaClockSource) {}

  /** Current time, rounded to 10 ms (matches the exemplar's resolution). */
  get t(): number {
    return Math.round(this.media.currentTime * 100) / 100;
  }

  get playing(): boolean {
    return !this.media.paused;
  }

  get duration(): number {
    return Number.isFinite(this.media.duration) ? this.media.duration : 0;
  }

  play(): void {
    void this.media.play();
  }

  pause(): void {
    this.media.pause();
  }

  seek(t: number): void {
    this.media.currentTime = Math.max(0, t);
  }

  on(event: ClockEvent, handler: () => void): void {
    this.media.addEventListener(event, handler);
  }
}
