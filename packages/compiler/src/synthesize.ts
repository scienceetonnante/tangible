// Stage 3: synthesize — run narration text through a TTS adapter, cached on the
// content of the *stripped text* so editing a directive's parameters (not prose)
// rebuilds with zero API calls and zero timing changes.

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { TtsAdapter, TtsResult, AudioFormat } from "@narrable/core";

export interface SynthesizeParams {
  voice: string;
  language: string;
  cacheDir: string; // lessons/<id>/.cache/tts
  speed?: number;
}

/** Content-addressed cache key: adapter identity + voice + model + speed + stripped text. */
export function cacheKey(adapter: TtsAdapter, voice: string, text: string, speed?: number): string {
  const h = createHash("sha256");
  h.update(`${adapter.id}|${voice}|${adapter.modelId ?? ""}|speed=${speed ?? ""}|${text}`);
  return h.digest("hex");
}

interface CachedTiming {
  format: AudioFormat;
  charTimes?: { start: number; end: number }[];
  wordTimes: TtsResult["wordTimes"];
  duration: number;
}

export async function synthesize(adapter: TtsAdapter, text: string, params: SynthesizeParams): Promise<TtsResult> {
  const key = cacheKey(adapter, params.voice, text, params.speed);
  const jsonPath = join(params.cacheDir, `${key}.json`);
  const audioPath = join(params.cacheDir, `${key}.audio`);

  const cached = await readCache(jsonPath, audioPath);
  if (cached) return cached;

  const result = await adapter.synthesize({ text, voice: params.voice, language: params.language, speed: params.speed });
  await mkdir(params.cacheDir, { recursive: true });
  const timing: CachedTiming = { format: result.format, charTimes: result.charTimes, wordTimes: result.wordTimes, duration: result.duration };
  await writeFile(jsonPath, JSON.stringify(timing));
  await writeFile(audioPath, result.audio);
  return result;
}

async function readCache(jsonPath: string, audioPath: string): Promise<TtsResult | null> {
  let timing: CachedTiming;
  let audio: Uint8Array;
  try {
    timing = JSON.parse(await readFile(jsonPath, "utf8")) as CachedTiming;
    audio = new Uint8Array(await readFile(audioPath));
  } catch {
    return null; // cache miss
  }
  return { audio, format: timing.format, charTimes: timing.charTimes, wordTimes: timing.wordTimes, duration: timing.duration };
}
