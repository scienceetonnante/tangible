import { describe, it, expect } from "vitest";
import { parseVtt, activeCue } from "./captions.js";

const VTT = `WEBVTT

00:00:00.000 --> 00:00:02.500
Bonjour le monde.

00:00:02.500 --> 00:00:05.000
Ceci est un test.
`;

describe("parseVtt", () => {
  it("parses cues with timestamps and text", () => {
    const cues = parseVtt(VTT);
    expect(cues).toEqual([
      { start: 0, end: 2.5, text: "Bonjour le monde." },
      { start: 2.5, end: 5, text: "Ceci est un test." },
    ]);
  });
});

describe("activeCue", () => {
  const cues = parseVtt(VTT);
  it("binary-searches the active cue, else empty", () => {
    expect(activeCue(cues, 1)).toBe("Bonjour le monde.");
    expect(activeCue(cues, 2.5)).toBe("Ceci est un test.");
    expect(activeCue(cues, 4.9)).toBe("Ceci est un test.");
    expect(activeCue(cues, 5)).toBe("");
    expect(activeCue(cues, 100)).toBe("");
  });
});
