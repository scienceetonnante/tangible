import { describe, expect, it } from "vitest";
import type { Schema } from "@narrable/core";
import { AnswerTimeline } from "./answer-timeline.js";

const schema: Schema = {
  theta: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
  visible: { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
};

describe("AnswerTimeline", () => {
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
});
