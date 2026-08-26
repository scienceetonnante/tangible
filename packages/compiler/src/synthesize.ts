// Stage 3: synthesize — run narration text through a TTS adapter, cached on the
// content of the stripped text and any provider-required speech boundaries, so
// editing directive parameters rebuilds with zero API calls or timing changes.

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { TtsAdapter, TtsResult, AudioFormat } from "@tangible/core";

export interface SynthesizeParams {
  voice: string;
  cacheDir: string; // lessons/<id>/.cache/tts
  speed?: number;
  segmentOffsets?: number[]; // exact narration boundaries for providers without alignment
}

/** Content-addressed cache key: provider settings + speech boundaries + stripped text. */
export function cacheKey(adapter: TtsAdapter, voice: string, text: string, speed?: number, segmentOffsets?: number[]): string {
  const h = createHash("sha256");
  h.update(`${adapter.id}|${voice}|${adapter.modelId ?? ""}|speed=${speed ?? ""}|segments=${segmentOffsets?.join(",") ?? ""}|${text}`);
  return h.digest("hex");
}

interface CachedTiming {
  format: AudioFormat;
  charTimes?: { start: number; end: number }[];
  wordTimes: TtsResult["wordTimes"];
  duration: number;
}

export async function synthesize(adapter: TtsAdapter, text: string, params: SynthesizeParams): Promise<TtsResult> {
  const segmentOffsets = adapter.synthesizeSegments && params.segmentOffsets ? normalizeOffsets(text, params.segmentOffsets) : undefined;
  const key = cacheKey(adapter, params.voice, text, params.speed, segmentOffsets);
  const jsonPath = join(params.cacheDir, `${key}.json`);
  const audioPath = join(params.cacheDir, `${key}.audio`);

  const cached = await readCache(jsonPath, audioPath);
  if (cached) return cached;

  const result = segmentOffsets
    ? await synthesizeAtBoundaries(adapter, text, params, segmentOffsets)
    : await adapter.synthesize({ text, voice: params.voice, speed: params.speed });
  await mkdir(params.cacheDir, { recursive: true });
  const timing: CachedTiming = { format: result.format, charTimes: result.charTimes, wordTimes: result.wordTimes, duration: result.duration };
  await writeFile(jsonPath, JSON.stringify(timing));
  await writeFile(audioPath, result.audio);
  return result;
}

/** Cue anchors plus sentence starts, suitable for natural, timing-safe TTS chunks. */
export function narrationSegmentOffsets(narration: string, directiveOffsets: number[]): number[] {
  const offsets = [...directiveOffsets];
  for (let i = 0; i < narration.length; i++) {
    if (!".!?…".includes(narration[i]!)) continue;
    let next = i + 1;
    while (next < narration.length && ".!?…".includes(narration[next]!)) next++;
    while (next < narration.length && /\s/.test(narration[next]!)) next++;
    offsets.push(next);
  }
  return normalizeOffsets(narration, offsets);
}

async function synthesizeAtBoundaries(
  adapter: TtsAdapter,
  text: string,
  params: SynthesizeParams,
  offsets: number[],
): Promise<TtsResult> {
  const boundaries = [0, ...offsets, text.length];
  const segments = boundaries.slice(0, -1).map((start, i) => text.slice(start, boundaries[i + 1]).trim());
  const result = await adapter.synthesizeSegments!({
    segments,
    voice: params.voice,
    speed: params.speed,
  });
  if (result.segmentStarts.length !== segments.length) throw new Error("TTS provider returned the wrong number of segment boundaries");

  const charTimes = Array.from({ length: text.length }, () => ({ start: 0, end: 0 }));
  for (let segment = 0; segment < segments.length; segment++) {
    const rawStart = boundaries[segment]!;
    const rawEnd = boundaries[segment + 1]!;
    const start = result.segmentStarts[segment]!;
    const end = result.segmentStarts[segment + 1] ?? result.duration;
    let contentStart = rawStart;
    let contentEnd = rawEnd;
    while (contentStart < contentEnd && /\s/.test(text[contentStart]!)) contentStart++;
    while (contentEnd > contentStart && /\s/.test(text[contentEnd - 1]!)) contentEnd--;
    const length = Math.max(1, contentEnd - contentStart);
    for (let i = rawStart; i < contentStart; i++) charTimes[i] = { start, end: start };
    for (let i = contentStart; i < contentEnd; i++) {
      charTimes[i] = {
        start: start + ((i - contentStart) / length) * (end - start),
        end: start + ((i - contentStart + 1) / length) * (end - start),
      };
    }
    for (let i = contentEnd; i < rawEnd; i++) charTimes[i] = { start: end, end };
  }

  const wordTimes = [...text.matchAll(/\S+/g)].map((match) => {
    const charOffset = match.index;
    const last = charOffset + match[0].length - 1;
    return {
      word: match[0],
      start: charTimes[charOffset]?.start ?? 0,
      end: charTimes[last]?.end ?? result.duration,
      charOffset,
    };
  });
  return { ...result, charTimes, wordTimes };
}

function normalizeOffsets(text: string, offsets: number[]): number[] {
  return [...new Set(offsets.filter((offset) => Number.isInteger(offset) && offset > 0 && offset < text.length))].sort((a, b) => a - b);
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
