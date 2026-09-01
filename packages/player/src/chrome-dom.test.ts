// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { LessonTracks } from "@tangible/core";
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
    const media = new FakeMedia();
    const clock = new AudioClock(media);
    const chrome = new Chrome(clock, tracks);
    const scrubber = chrome.el.querySelector(".xv-scrubber") as HTMLInputElement;

    chrome.update(5);
    expect(scrubber.value).toBe("250"); // 5/20 * 1000

    // Simulate a drag: the range fires `input` with the new value.
    scrubber.value = "600";
    scrubber.dispatchEvent(new Event("input"));
    expect(media.currentTime).toBe(12); // seeked to 0.6 * 20
    chrome.update(3); // frame loop tries to move it — should be ignored while scrubbing
    expect(scrubber.value).toBe("600");

    // Release: `change` clears scrubbing and the loop resumes.
    scrubber.dispatchEvent(new Event("change"));
    chrome.update(3);
    expect(scrubber.value).toBe("150");
  });

  it("drives the play/pause icon from the actual clock state each frame", () => {
    const media = new FakeMedia();
    const clock = new AudioClock(media);
    const chrome = new Chrome(clock, tracks);
    const playBtn = chrome.el.querySelector(".xv-play") as HTMLButtonElement;

    chrome.update(0);
    expect(playBtn.textContent).toBe("▶");
    expect(playBtn.getAttribute("aria-label")).toBe("Play lesson");
    media.paused = false; // playing (as if any code/event changed it)
    chrome.update(0);
    expect(playBtn.textContent).toBe("⏸");
    expect(playBtn.getAttribute("aria-label")).toBe("Pause lesson");
  });

  it("labels playback controls and reports the captions state", () => {
    const chrome = new Chrome(new AudioClock(new FakeMedia()), tracks);
    const captions = chrome.el.querySelector(".xv-captions-toggle") as HTMLButtonElement;
    const credit = chrome.el.querySelector(".xv-credit") as HTMLAnchorElement;

    expect((chrome.el.querySelector(".xv-scrubber") as HTMLInputElement).ariaLabel).toBe("Lesson position");
    expect((chrome.el.querySelector(".xv-fullscreen") as HTMLButtonElement).ariaLabel).toBe("Enter full screen");
    expect(credit.textContent).toBe("Made with Tangible");
    expect(credit.href).toBe("https://github.com/scienceetonnante/tangible");
    expect(credit.target).toBe("_blank");
    expect(credit.rel).toBe("noopener noreferrer");
    expect(credit.ariaLabel).toBe("Made with Tangible (opens in a new tab)");
    expect(captions.getAttribute("aria-pressed")).toBe("false");
    captions.click();
    expect(captions.getAttribute("aria-pressed")).toBe("true");
    expect(captions.ariaLabel).toBe("Hide captions");
  });

  it("does not trigger playback shortcuts while the learner types a question", () => {
    const media = new FakeMedia();
    const chrome = new Chrome(new AudioClock(media), tracks);
    const target = document.createElement("div");
    const input = document.createElement("input");
    target.append(input);
    chrome.bindKeys(target);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(media.paused).toBe(true);
    target.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(media.paused).toBe(false);
  });
});
