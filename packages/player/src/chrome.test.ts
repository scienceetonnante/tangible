import { describe, it, expect } from "vitest";
import { formatTime, tickFractions } from "./chrome.js";
import { parseDevParams } from "./url.js";
import type { LessonTracks } from "@narrable/core";

describe("formatTime", () => {
  it("formats m:ss and h:mm:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(-3)).toBe("0:00");
  });
});

describe("tickFractions", () => {
  it("maps chapter/pause times to 0..1 fractions of duration", () => {
    const tracks = {
      duration: 20,
      chapters: [{ t: 0, title: "a" }, { t: 10, title: "b" }],
      pauses: [{ t: 5, id: "p0", prompt: "x" }],
    } as LessonTracks;
    expect(tickFractions(tracks)).toEqual({ chapters: [0, 0.5], pauses: [0.275] });
  });
});

describe("parseDevParams", () => {
  it("parses ?t, &nochrome, &state", () => {
    expect(parseDevParams("?t=14.2&nochrome&state")).toEqual({ t: 14.2, nochrome: true, state: true });
    expect(parseDevParams("")).toEqual({ t: undefined, nochrome: false, state: false });
    expect(parseDevParams("?t=abc")).toEqual({ t: undefined, nochrome: false, state: false });
  });
});
