// Stage 6: emit — assemble the LessonTracks artifact, generate sentence-level VTT
// captions, and write {tracks.json,captions.vtt,audio.*}. Output is a
// pure function of (script, timing, scene, options) — verified by a repeatability test.

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LessonTracks, TtsResult } from "@tangible/core";
import { schemaHash } from "@tangible/core";
import { parseScript } from "./parse.js";
import { resolve } from "./resolve.js";
import { expand } from "./expand.js";
import type { SceneInfo } from "./check.js";
import type { Keyframe } from "@tangible/core";
import type { Diagnostic } from "./diagnostics.js";
import { formatDiagnostic } from "./diagnostics.js";
import { evaluateAuthoredState } from "./authored-state.js";

type Timing = Pick<TtsResult, "charTimes" | "wordTimes" | "duration">;

export interface CompileOptions {
  lessonId: string;
  file?: string; // source filename, so build-path warnings carry it (not "<script>")
  defaults: { anticipation: number; ease: string; transition: number };
  audioSrc: string[];
  audioHash: string;
  recorded?: Record<string, Keyframe[]>;
  recordedPaths?: Record<string, string>;
}

export interface Compiled {
  tracks: LessonTracks;
  vtt: string;
  warnings: Diagnostic[];
}

/** Full parse→resolve→expand→assemble, deterministic for fixed inputs. */
export function compile(script: string, timing: Timing, scene: SceneInfo, opts: CompileOptions): Compiled {
  const parsed = parseScript(script, opts.file);
  const authored = evaluateAuthoredState(parsed, scene);
  if (authored.diagnostics.length) throw new Error(formatDiagnostic(authored.diagnostics[0]!));
  const cues = resolve(parsed.directives, parsed.narration, timing, { anticipation: opts.defaults.anticipation });
  const ex = expand(cues, scene, {
    defaults: { ease: opts.defaults.ease, transition: opts.defaults.transition },
    recorded: opts.recorded,
    recordedPaths: opts.recordedPaths,
    bakes: authored.bakes,
  });

  const tracks: LessonTracks = {
    version: 1,
    lessonId: opts.lessonId,
    duration: timing.duration,
    audio: { src: opts.audioSrc, hash: opts.audioHash },
    schemaHash: schemaHash(scene.schema),
    tracks: ex.tracks,
    chapters: ex.chapters,
    pauses: ex.pauses,
    captions: { src: "captions.vtt" },
    boardItems: ex.boardItems,
    recorded: ex.recorded,
  };

  return { tracks, vtt: toVtt(parsed.narration, timing), warnings: ex.warnings };
}

/** Sentence-level WebVTT from the narration and its timing. */
export function toVtt(narration: string, timing: Timing): string {
  const lines = ["WEBVTT", ""];
  for (const { start, end, text } of sentences(narration, timing)) {
    lines.push(`${stamp(start)} --> ${stamp(end)}`, text, "");
  }
  return lines.join("\n");
}

interface Sentence {
  start: number;
  end: number;
  text: string;
}

function sentences(narration: string, timing: Timing): Sentence[] {
  const out: Sentence[] = [];
  let from = 0;
  const pushSentence = (lo: number, hi: number) => {
    const text = narration.slice(lo, hi).trim();
    if (!text) return;
    const firstChar = lo + (narration.slice(lo, hi).length - narration.slice(lo, hi).trimStart().length);
    out.push({ start: charStart(firstChar, timing), end: charEnd(hi - 1, timing), text });
  };
  for (let i = 0; i < narration.length; i++) {
    if (".!?…".includes(narration[i]!)) {
      // include trailing closing punctuation
      let j = i + 1;
      while (j < narration.length && ".!?…".includes(narration[j]!)) j++;
      pushSentence(from, j);
      from = j;
    }
  }
  if (from < narration.length) pushSentence(from, narration.length);
  return out;
}

function charStart(i: number, timing: Timing): number {
  if (timing.charTimes && timing.charTimes.length) return timing.charTimes[Math.max(0, Math.min(i, timing.charTimes.length - 1))]!.start;
  for (const w of timing.wordTimes) if (i < w.charOffset + w.word.length) return w.start;
  return 0;
}

function charEnd(i: number, timing: Timing): number {
  if (timing.charTimes && timing.charTimes.length) return timing.charTimes[Math.max(0, Math.min(i, timing.charTimes.length - 1))]!.end;
  let last = timing.duration;
  for (const w of timing.wordTimes) if (w.charOffset <= i) last = w.end;
  return last;
}

function stamp(t: number): string {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}.${p(millis, 3)}`;
}

/** Write the compiled artifacts to a build directory. */
export async function emit(outDir: string, compiled: Compiled, audio: Uint8Array): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "tracks.json"), JSON.stringify(compiled.tracks, null, 2));
  await writeFile(join(outDir, "captions.vtt"), compiled.vtt);
  for (const src of compiled.tracks.audio.src) await writeFile(join(outDir, src), audio);
}
