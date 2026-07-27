// A model answer is a second, temporary value-at-time timeline. It is composed
// over the paused lesson state and never enters the lesson reconciler.

import { blend, type AnswerBeat, type ParamValue, type PlainState, type Schema, type TimedAnswerBeat } from "@narrable/core";

interface Segment {
  start: number;
  end: number;
  from: ParamValue;
  to: ParamValue;
}

/** Schedule visual beats at a comfortable reading pace without waiting for TTS. */
export function timeAnswerBeats(beats: AnswerBeat[]): TimedAnswerBeat[] {
  let t = 0;
  return beats.map((beat) => {
    const timed = { t, set: beat.set, over: beat.over };
    t += Math.max(1.5, Math.min(5, beat.say.length / 18));
    return timed;
  });
}

export class AnswerTimeline {
  private tracks = new Map<string, Segment[]>();

  constructor(
    private schema: Schema,
    origin: Readonly<PlainState>,
    beats: TimedAnswerBeat[],
  ) {
    for (const beat of beats) {
      for (const [param, target] of Object.entries(beat.set)) {
        const spec = schema[param];
        if (!spec) continue;
        const segments = this.tracks.get(param) ?? [];
        const from = this.valueFromSegments(segments, beat.t, origin[param] ?? spec.default, spec.interpolate);
        const duration = spec.interpolate === "snap" ? 0 : beat.over;
        segments.push({ start: beat.t, end: beat.t + duration, from: clone(from), to: clone(target) });
        this.tracks.set(param, segments);
      }
    }
  }

  /** Writes only parameters whose first answer command has begun. */
  evaluate(t: number, out: PlainState = {}): PlainState {
    for (const [param, segments] of this.tracks) {
      if (t < segments[0]!.start) continue;
      const spec = this.schema[param]!;
      out[param] = this.valueFromSegments(segments, t, spec.default, spec.interpolate);
    }
    return out;
  }

  private valueFromSegments(
    segments: Segment[],
    t: number,
    fallback: ParamValue,
    mode: Schema[string]["interpolate"],
  ): ParamValue {
    let active: Segment | undefined;
    for (const segment of segments) {
      if (t < segment.start) break;
      active = segment;
    }
    if (!active) return clone(fallback);
    if (active.end > active.start && t < active.end) {
      return blend(mode, active.from, active.to, (t - active.start) / (active.end - active.start));
    }
    return clone(active.to);
  }
}

function clone(value: ParamValue): ParamValue {
  if (Array.isArray(value)) return value.slice();
  if (typeof value === "object" && value !== null) {
    const orbit = value as { target: [number, number, number]; distance: number; azimuth: number; elevation: number };
    return { ...orbit, target: [...orbit.target] as [number, number, number] };
  }
  return value;
}
