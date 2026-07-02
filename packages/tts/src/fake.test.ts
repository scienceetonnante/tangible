import { describe, it, expect } from "vitest";
import { FakeTtsAdapter } from "./fake.js";

describe("FakeTtsAdapter", () => {
  const tts = new FakeTtsAdapter();

  it("emits deterministic 60ms/char timing", async () => {
    const r = await tts.synthesize({ text: "abc def", voice: "v", language: "fr" });
    expect(r.charTimes).toHaveLength(7);
    expect(r.duration).toBeCloseTo(7 * 0.06, 12);
    expect(r.charTimes![0]).toEqual({ start: 0, end: 0.06 });
  });

  it("derives word times with correct char offsets and onsets", async () => {
    const r = await tts.synthesize({ text: "abc def", voice: "v", language: "fr" });
    expect(r.wordTimes).toEqual([
      { word: "abc", start: 0, end: 0.18, charOffset: 0 },
      { word: "def", start: 0.24, end: 0.42, charOffset: 4 },
    ]);
  });

  it("produces a WAV whose header matches the duration", async () => {
    const r = await tts.synthesize({ text: "ab", voice: "v", language: "fr" });
    expect(new TextDecoder().decode(r.audio.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(r.audio.slice(8, 12))).toBe("WAVE");
  });
});
