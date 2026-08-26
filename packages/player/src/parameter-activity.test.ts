import { describe, expect, it } from "vitest";
import type { Keyframe } from "@tangible/core";
import { ParameterActivityTracker, narrationActivityAt } from "./parameter-activity.js";
import type { InteractionMeta } from "./store.js";

const tracks: Record<string, Keyframe[]> = {
  animated: [
    { t: 2, v: 0 },
    { t: 6, v: 1, ease: "linear" },
  ],
  instant: [{ t: 4, v: true }],
};

function meta(dragging = false): InteractionMeta {
  return {
    holdT: -Infinity,
    touchT: -Infinity,
    touchedEver: dragging,
    modified: dragging,
    dragging,
  };
}

describe("parameter activity", () => {
  it("derives narration activity directly from lesson time", () => {
    expect(narrationActivityAt(tracks, 1.9)).toEqual({});
    expect(narrationActivityAt(tracks, 3)).toEqual({ animated: { source: "narration", strength: 1 } });
    expect(narrationActivityAt(tracks, 4)).toMatchObject({
      animated: { source: "narration", strength: 1 },
      instant: { source: "narration", strength: 1 },
    });
    expect(narrationActivityAt(tracks, 6.275).animated!.strength).toBeCloseTo(0.5);
    expect(narrationActivityAt(tracks, 7)).toEqual({});
  });

  it("keeps user activity active while dragging and fades after release", () => {
    let now = 10;
    const tracker = new ParameterActivityTracker({}, 0.5, () => now);
    const interaction = new Map<string, InteractionMeta>([["theta", meta(true)]]);

    expect(tracker.evaluate(0, interaction)).toEqual({ theta: { source: "user", strength: 1 } });
    now = 11;
    expect(tracker.evaluate(0, interaction)).toEqual({ theta: { source: "user", strength: 1 } });
    interaction.set("theta", meta(false));
    now = 11.25;
    expect(tracker.evaluate(0, interaction).theta!.strength).toBeCloseTo(0.5);
    now = 11.6;
    expect(tracker.evaluate(0, interaction)).toEqual({});
  });

  it("lets user activity take precedence over narration for the same parameter", () => {
    let now = 3;
    const tracker = new ParameterActivityTracker(tracks, 0.5, () => now);
    tracker.noteUser("animated");

    expect(tracker.evaluate(3, new Map()).animated).toEqual({ source: "user", strength: 1 });
    now = 3.25;
    expect(tracker.evaluate(3, new Map()).animated).toEqual({ source: "user", strength: 0.5 });
    now = 4;
    expect(tracker.evaluate(3, new Map()).animated).toEqual({ source: "narration", strength: 1 });
  });
});
