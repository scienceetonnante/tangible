// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { AudioClock, type MediaClockSource } from "./clock.js";
import { PauseGate, pauseTime } from "./pause-gate.js";

class FakeMedia implements MediaClockSource {
  currentTime = 0;
  paused = true;
  duration = 20;
  private listeners = new Map<string, (() => void)[]>();
  play() {
    this.paused = false;
    for (const listener of this.listeners.get("play") ?? []) listener();
  }
  pause() {
    this.paused = true;
  }
  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
}

let media: FakeMedia;
let clock: AudioClock;
let gate: PauseGate;
beforeEach(() => {
  media = new FakeMedia();
  media.paused = false; // playing
  clock = new AudioClock(media);
  gate = new PauseGate(clock, [{ t: 5, id: "p0", prompt: "Try it." }]);
});

describe("PauseGate", () => {
  it("pauses at the checkpoint boundary", () => {
    gate.update(4.9);
    gate.update(5.01);
    expect(media.paused).toBe(true);
    expect(media.currentTime).toBe(5);
    expect(gate.activePrompt).toBe("Try it.");
  });

  it("resumes from the normal play control and does not re-trigger", () => {
    gate.update(4.9);
    gate.update(5.01);
    clock.play();
    expect(media.paused).toBe(false);
    expect(gate.activePrompt).toBeNull();
    gate.update(5.6); // still past the gate, already satisfied
    expect(media.paused).toBe(false);
  });

  it("seeking past a gate satisfies it silently", () => {
    gate.update(0.1);
    gate.update(10); // big jump past t=5
    expect(media.paused).toBe(false);
  });

  it("seeking back to the start re-arms the gate", () => {
    gate.update(0.1);
    gate.update(10); // satisfied
    gate.update(0.2); // seek to start → re-arm
    gate.update(4.9);
    gate.update(5.01);
    expect(media.paused).toBe(true);
  });

  it("re-arms after resuming, then seeking back to just before the gate", () => {
    gate.update(4.9);
    gate.update(5.01); // triggered
    clock.play(); // resume → satisfied
    gate.update(6); // playing on past it
    gate.update(4); // seek back to before the gate (not the start) → re-arm
    gate.update(4.9);
    gate.update(5.01); // re-cross
    expect(media.paused).toBe(true);
  });

  it("re-arms when seeking backward while stopped at the gate", () => {
    gate.update(4.9);
    gate.update(5.01); // triggered
    gate.update(4); // seek backward before resuming
    clock.play();
    gate.update(4.9);
    gate.update(5.01);

    expect(media.paused).toBe(true);
  });

  it("leaves the final checkpoint at its boundary by default", () => {
    expect(pauseTime({ t: 19.8 }, 20)).toBe(19.8);
  });
});
