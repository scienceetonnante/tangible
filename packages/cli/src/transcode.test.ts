import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { FakeTtsAdapter } from "@tangible/tts";
import { browserAudioArtifacts, transcodeForBrowsers } from "./transcode.js";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

describe.runIf(hasFfmpeg)("browser audio transcoding", () => {
  it("converts TTS WAV into compact deterministic Opus and AAC-LC files", async () => {
    const source = await new FakeTtsAdapter().synthesize({ text: "A narrated test sentence that is long enough to compress.", voice: "test" });
    const first = transcodeForBrowsers(source.audio, source.format);
    const second = transcodeForBrowsers(source.audio, source.format);

    expect(first.map((artifact) => artifact.format)).toEqual(["webm", "m4a"]);
    expect([...first[0]!.audio.slice(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    expect(new TextDecoder().decode(first[1]!.audio.slice(4, 8))).toBe("ftyp");
    expect(first.every((artifact) => artifact.audio.length < source.audio.length)).toBe(true);
    expect(first[0]!.audio).toEqual(second[0]!.audio);
    expect(first[1]!.audio).toEqual(second[1]!.audio);
  });

  it("automatically compresses a WAV returned by a real TTS adapter", async () => {
    const source = await new FakeTtsAdapter().synthesize({ text: "Provider WAV output.", voice: "test" });
    expect(browserAudioArtifacts("hf-endpoint", source).map((artifact) => artifact.format)).toEqual(["webm", "m4a"]);
    expect(browserAudioArtifacts("fake", source).map((artifact) => artifact.format)).toEqual(["wav"]);
  });
});
