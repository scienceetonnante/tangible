// Stage 4: resolve — map each directive's anchor offset to an absolute time using
// the TTS timing, then apply per-cue `at:` offsets and the default anticipation.

import type { TtsResult } from "@tangible/core";
import type { Directive } from "./parse.js";

export interface ResolvedCue {
  t: number;
  directive: Directive;
}

export interface ResolveOptions {
  anticipation: number; // seconds, applied to visual cues unless `at:` overrides
}

type Timing = Pick<TtsResult, "charTimes" | "wordTimes" | "duration">;

// Directives whose timing is nudged by the default anticipation.
const ANTICIPATED = new Set(["cue", "bake", "show", "hide", "camera", "board", "highlight", "dim", "clear"]);

export function resolve(directives: Directive[], narration: string, timing: Timing, opts: ResolveOptions): ResolvedCue[] {
  let pauseBarrier = 0;
  const cues = directives.map((d) => {
    let t = timeFor(d, narration, timing, opts);
    // A future visual must never anticipate across an authored checkpoint. The
    // player stops exactly at the spoken prompt boundary, before the next word.
    if (d.kind === "pause") pauseBarrier = Math.max(pauseBarrier, t);
    else t = Math.max(t, pauseBarrier);
    return { t, directive: d };
  });
  // Stable sort by time (preserves source order on ties).
  return cues
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.t - b.c.t || a.i - b.i)
    .map(({ c }) => c);
}

function timeFor(d: Directive, narration: string, timing: Timing, opts: ResolveOptions): number {
  let t = baseTime(d.anchorOffset, timing);
  const at = "options" in d ? d.options.at : undefined;
  if (at) {
    if (at.kind === "delta") t += at.seconds;
    else t = sentenceEndTime(d.anchorOffset, narration, timing);
  } else if (ANTICIPATED.has(d.kind)) {
    t += opts.anticipation;
  }
  return Math.max(0, Math.min(timing.duration, t));
}

/** Onset time of the character/word at an offset into the stripped narration. */
function baseTime(offset: number, timing: Timing): number {
  if (timing.charTimes && timing.charTimes.length > 0) {
    const i = Math.max(0, Math.min(timing.charTimes.length - 1, offset));
    return timing.charTimes[i]!.start;
  }
  for (const w of timing.wordTimes) {
    if (offset < w.charOffset + w.word.length) return w.start;
  }
  return timing.duration;
}

/** End time of the next sentence-ending punctuation at/after the offset. */
function sentenceEndTime(offset: number, narration: string, timing: Timing): number {
  let end = -1;
  for (let i = offset; i < narration.length; i++) {
    if (".!?…".includes(narration[i]!)) {
      end = i;
      break;
    }
  }
  if (end === -1 || !timing.charTimes) return timing.duration;
  return timing.charTimes[Math.min(end, timing.charTimes.length - 1)]?.end ?? timing.duration;
}
