import { describe, expect, it } from "vitest";
import { mimeForAudio, preferredAudioSource } from "./audio-source.js";

describe("browser audio selection", () => {
  it("declares exact codecs for compressed lesson audio", () => {
    expect(mimeForAudio("audio.webm")).toBe('audio/webm; codecs="opus"');
    expect(mimeForAudio("audio.m4a")).toBe('audio/mp4; codecs="mp4a.40.2"');
  });

  it("prefers a probably supported source without downloading fallbacks", () => {
    const support: Record<string, string> = {
      [mimeForAudio("audio.webm")]: "probably",
      [mimeForAudio("audio.m4a")]: "maybe",
    };
    expect(preferredAudioSource(["audio.webm", "audio.m4a"], (mime) => support[mime] ?? "")).toBe("audio.webm");
  });

  it("uses a maybe-supported fallback and rejects unsupported browsers", () => {
    expect(preferredAudioSource(["audio.webm", "audio.m4a"], (mime) => (mime.includes("mp4") ? "maybe" : ""))).toBe("audio.m4a");
    expect(() => preferredAudioSource(["audio.webm"], () => "")).toThrow("does not support");
  });
});
