// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { AudioClock, type MediaClockSource } from "./clock.js";
import { PauseGate } from "./pause-gate.js";

class FakeMedia implements MediaClockSource {
  currentTime = 0;
  paused = true;
  duration = 20;
  play() {
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  addEventListener() {}
}

let media: FakeMedia;
let clock: AudioClock;
let gate: PauseGate;
beforeEach(() => {
  media = new FakeMedia();
  media.paused = false; // playing
  clock = new AudioClock(media);
  gate = new PauseGate(clock, [{ t: 5, id: "p0", prompt: "Try it" }]);
});

describe("PauseGate", () => {
  it("triggers on normal crossing: pauses and shows the prompt", () => {
    gate.update(4.9);
    gate.update(5.1);
    expect(media.paused).toBe(true);
    expect(gate.el.style.display).toBe("flex");
    expect(gate.el.querySelector("p")!.textContent).toBe("Try it");
  });

  it("resumes and stays satisfied (no re-trigger) via the Continue button", () => {
    gate.update(4.9);
    gate.update(5.1);
    gate.el.querySelector("button")!.click();
    expect(media.paused).toBe(false);
    expect(gate.el.style.display).toBe("none");
    gate.update(5.2); // still past the gate, already satisfied
    expect(media.paused).toBe(false);
  });

  it("seeking past a gate satisfies it silently", () => {
    gate.update(0.1);
    gate.update(10); // big jump past t=5
    expect(gate.el.style.display).toBe("none");
    expect(media.paused).toBe(false);
  });

  it("seeking back to the start re-arms the gate", () => {
    gate.update(0.1);
    gate.update(10); // satisfied
    gate.update(0.2); // seek to start → re-arm
    gate.update(4.9);
    gate.update(5.1);
    expect(media.paused).toBe(true);
  });

  it("re-arms after resuming, then seeking back to just before the gate", () => {
    gate.update(4.9);
    gate.update(5.1); // triggered
    gate.el.querySelector("button")!.click(); // resume → satisfied
    gate.update(6); // playing on past it
    gate.update(4); // seek back to before the gate (not the start) → re-arm
    gate.update(4.9);
    gate.update(5.1); // re-cross
    expect(media.paused).toBe(true);
    expect(gate.el.style.display).toBe("flex");
  });
});
