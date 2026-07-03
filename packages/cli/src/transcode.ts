// Transcode synthesized MP3 to AAC/MP4 (.m4a) via ffmpeg. ElevenLabs returns an
// MP3 stream whose frame headers browsers seek imprecisely (byte-offset estimation),
// which desyncs the voice from the animation after scrubbing. AAC-in-MP4 carries a
// per-frame sample index, so every browser seeks it exactly. Real-voice builds only;
// the fake adapter's WAV already seeks sample-accurately and keeps CI ffmpeg-free.

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** MP3 bytes → AAC/MP4 (.m4a) bytes. Throws (with ffmpeg's stderr) if ffmpeg is missing or fails. */
export function transcodeToM4a(mp3: Uint8Array): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), "narrable-"));
  try {
    const inp = join(dir, "in.mp3");
    const out = join(dir, "out.m4a");
    writeFileSync(inp, mp3);
    // +faststart moves the index to the front so HTTP range-seeking works from byte 0.
    const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", inp, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out]);
    if (r.error?.message.includes("ENOENT")) throw new Error("ffmpeg not found — install it (e.g. `brew install ffmpeg`) to build real-voice audio.");
    if (r.status !== 0) throw new Error(`ffmpeg transcode failed:\n${r.stderr?.toString() ?? r.error?.message ?? ""}`);
    return readFileSync(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
