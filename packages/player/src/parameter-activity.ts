import type { Keyframe } from "@narrable/core";
import type { InteractionMeta } from "./store.js";

export type ParameterActivitySource = "narration" | "user" | "assistant";

export interface ParameterActivity {
  source: ParameterActivitySource;
  strength: number;
}

export type ParameterActivityMap = Readonly<Record<string, ParameterActivity>>;

const DEFAULT_FADE_SECONDS = 0.55;

/** Combines deterministic narration activity with temporary user activity. */
export class ParameterActivityTracker {
  private activity: Record<string, ParameterActivity> = {};
  private userTouchedAt = new Map<string, number>();

  constructor(
    private tracks: Record<string, Keyframe[]> = {},
    private fadeSeconds = DEFAULT_FADE_SECONDS,
    private now: () => number = () => performance.now() / 1000,
  ) {}

  noteUser(param: string): void {
    this.userTouchedAt.set(param, this.now());
  }

  evaluate(
    lessonTime: number,
    interaction: ReadonlyMap<string, InteractionMeta>,
    assistant: Readonly<Record<string, number>> = {},
  ): ParameterActivityMap {
    narrationActivityAt(this.tracks, lessonTime, this.fadeSeconds, this.activity);

    for (const [param, strength] of Object.entries(assistant)) {
      if (strength > 0) this.activity[param] = { source: "assistant", strength };
    }

    const now = this.now();
    for (const [param, meta] of interaction) {
      if (!meta.dragging) continue;
      this.userTouchedAt.set(param, now);
      this.activity[param] = { source: "user", strength: 1 };
    }
    for (const [param, touchedAt] of this.userTouchedAt) {
      if (interaction.get(param)?.dragging) continue;
      const strength = fadeStrength(now - touchedAt, this.fadeSeconds);
      if (strength > 0) this.activity[param] = { source: "user", strength };
      else this.userTouchedAt.delete(param);
    }

    return this.activity;
  }
}

/** Reports active transitions and recent keyframes directly from lesson time. */
export function narrationActivityAt(
  tracks: Record<string, Keyframe[]>,
  t: number,
  fadeSeconds = DEFAULT_FADE_SECONDS,
  out: Record<string, ParameterActivity> = {},
): ParameterActivityMap {
  for (const param of Object.keys(out)) delete out[param];
  for (const [param, keyframes] of Object.entries(tracks)) {
    const strength = trackStrengthAt(keyframes, t, fadeSeconds);
    if (strength > 0) out[param] = { source: "narration", strength };
  }
  return out;
}

function trackStrengthAt(keyframes: Keyframe[], t: number, fadeSeconds: number): number {
  const index = keyframeAtOrBefore(keyframes, t);
  if (index < 0) return 0;
  const current = keyframes[index]!;
  const next = keyframes[index + 1];
  if (next?.ease !== undefined && t < next.t) return 1;
  return fadeStrength(t - current.t, fadeSeconds);
}

function keyframeAtOrBefore(keyframes: Keyframe[], t: number): number {
  if (!keyframes.length || t < keyframes[0]!.t) return -1;
  let lo = 0;
  let hi = keyframes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (keyframes[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function fadeStrength(age: number, fadeSeconds: number): number {
  if (age < 0 || age >= fadeSeconds) return 0;
  return 1 - age / fadeSeconds;
}
