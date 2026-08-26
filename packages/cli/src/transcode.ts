// Convert provider audio into two compact browser delivery formats. WebM/Opus
// covers Chromium and Firefox builds without platform codecs. AAC-LC in M4A
// covers Safari and iOS. The player downloads only the first format that the
// current browser reports it can play.

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AudioFormat, TtsResult } from "@tangible/core";

export interface BrowserAudioArtifact {
  format: AudioFormat;
  audio: Uint8Array;
}

/** Keep hermetic fake builds as WAV; compress every actual TTS provider result. */
export function browserAudioArtifacts(adapterId: string, result: Pick<TtsResult, "audio" | "format">): BrowserAudioArtifact[] {
  return adapterId === "fake" ? [{ format: result.format, audio: result.audio }] : transcodeForBrowsers(result.audio, result.format);
}

/** Provider audio bytes → deterministic WebM/Opus and M4A/AAC-LC bytes. */
export function transcodeForBrowsers(input: Uint8Array, inputFormat: AudioFormat): BrowserAudioArtifact[] {
  const dir = mkdtempSync(join(tmpdir(), "tangible-audio-"));
  try {
    const source = join(dir, `input.${inputFormat}`);
    writeFileSync(source, input);

    const webm = join(dir, "audio.webm");
    runFfmpeg(source, webm, ["-c:a", "libopus", "-b:a", "64k", "-vbr", "on"]);

    const m4a = join(dir, "audio.m4a");
    runFfmpeg(source, m4a, ["-c:a", "aac", "-profile:a", "aac_low", "-b:a", "96k", "-movflags", "+faststart"]);

    return [
      { format: "webm", audio: readFileSync(webm) },
      { format: "m4a", audio: readFileSync(m4a) },
    ];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runFfmpeg(source: string, output: string, encoding: string[]): void {
  const result = spawnSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    source,
    "-map",
    "0:a:0",
    "-vn",
    "-map_metadata",
    "-1",
    "-fflags",
    "+bitexact",
    "-flags:a",
    "+bitexact",
    ...encoding,
    output,
  ]);
  if (result.error?.message.includes("ENOENT")) {
    throw new Error("ffmpeg not found — install it (for example, `brew install ffmpeg`) to build narrated audio. Use --silent for a build without ffmpeg.");
  }
  if (result.status !== 0) {
    throw new Error(`ffmpeg transcode failed:\n${result.stderr?.toString() ?? result.error?.message ?? ""}`);
  }
}
