// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { LessonTracks } from "@xv/core";
import { AudioClock, type MediaClockSource } from "./clock.js";
import { Chrome } from "./chrome.js";

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

const tracks = { duration: 20, chapters: [], pauses: [] } as unknown as LessonTracks;

describe("Chrome scrubber", () => {
  it("does not fight the user's drag: value writes are suppressed while scrubbing", () => {
    const clock = new AudioClock(new FakeMedia());
    const chrome = new Chrome(clock, tracks);
    const scrubber = chrome.el.querySelector(".xv-scrubber") as HTMLInputElement;

    chrome.update(5);
    expect(scrubber.value).toBe("250"); // 5/20 * 1000

    scrubber.dispatchEvent(new Event("pointerdown"));
    chrome.update(10); // frame loop tries to move it — should be ignored
    expect(scrubber.value).toBe("250");

    scrubber.dispatchEvent(new Event("pointerup"));
    chrome.update(10); // resumed
    expect(scrubber.value).toBe("500");
  });
});
