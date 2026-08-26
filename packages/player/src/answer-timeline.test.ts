import { describe, expect, it } from "vitest";
import type { Schema } from "@tangible/core";
import { AnswerTimeline, timeAnswerBeats } from "./answer-timeline.js";

const schema: Schema = {
  theta: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
  visible: { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
};

describe("AnswerTimeline", () => {
  it("starts the first written beat immediately and spaces later beats for reading", () => {
    const beats = timeAnswerBeats([
      { say: "First.", set: { theta: 1 }, over: 0 },
      { say: "A longer second sentence.", set: { theta: 2 }, over: 0 },
    ]);
    expect(beats[0]!.t).toBe(0);
    expect(beats[1]!.t).toBe(1.5);
  });

  it("is inactive before a beat, transitions from the visible origin, then holds", () => {
    const timeline = new AnswerTimeline(schema, { theta: 2, visible: false }, [
      { t: 1, set: { theta: 6, visible: true }, over: 2 },
    ]);
    expect(timeline.evaluate(0)).toEqual({});
    expect(timeline.evaluate(1)).toEqual({ theta: 2, visible: true });
    expect(timeline.evaluate(2).theta).toBeCloseTo(4);
    expect(timeline.evaluate(4)).toEqual({ theta: 6, visible: true });
  });

  it("starts a later transition from the value already visible at that time", () => {
    const timeline = new AnswerTimeline(schema, { theta: 0 }, [
      { t: 0, set: { theta: 10 }, over: 2 },
      { t: 1, set: { theta: 0 }, over: 1 },
    ]);
    expect(timeline.evaluate(1).theta).toBeCloseTo(5);
    expect(timeline.evaluate(1.5).theta).toBeCloseTo(2.5);
    expect(timeline.evaluate(3).theta).toBe(0);
  });

  it("reports activity during an answer transition and briefly after it", () => {
    const timeline = new AnswerTimeline(schema, { theta: 0, visible: false }, [
      { t: 1, set: { theta: 6, visible: true }, over: 2 },
    ]);

    expect(timeline.activity(0)).toEqual({});
    expect(timeline.activity(2)).toEqual({ theta: 1 });
    expect(timeline.activity(1.25).visible).toBeCloseTo(1 - 0.25 / 0.55);
    expect(timeline.activity(3.275).theta).toBeCloseTo(0.5);
    expect(timeline.activity(4)).toEqual({});
  });
});
