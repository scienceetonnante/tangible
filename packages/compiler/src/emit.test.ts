import { describe, it, expect } from "vitest";
import { compile, toVtt } from "./emit.js";
import { SCRIPT, SCENE } from "./fixtures.js";
import { parseScript } from "./parse.js";
import type { SceneInfo } from "./check.js";

function fakeTiming(text: string) {
  const charTimes = Array.from({ length: text.length }, (_, i) => ({ start: i * 0.06, end: (i + 1) * 0.06 }));
  const wordTimes = [...text.matchAll(/\S+/g)].map((m) => ({
    word: m[0],
    start: m.index * 0.06,
    end: (m.index + m[0].length) * 0.06,
    charOffset: m.index,
  }));
  return { audio: new Uint8Array(), charTimes, wordTimes, duration: text.length * 0.06 };
}

const OPTS = {
  lessonId: "unit-circle",
  defaults: { anticipation: -0.2, ease: "inOutCubic", transition: 1.0 },
  audioSrc: ["audio.wav"],
  audioHash: "deadbeef",
};

describe("compile — LessonTracks assembly", () => {
  it("assembles a version-1 artifact with schemaHash and all sections", () => {
    const timing = fakeTiming(parseScript(SCRIPT).narration);
    const { tracks } = compile(SCRIPT, timing, SCENE, OPTS);
    expect(tracks.version).toBe(1);
    expect(tracks.lessonId).toBe("unit-circle");
    expect(tracks.duration).toBeCloseTo(timing.duration, 9);
    expect(tracks.schemaHash).toMatch(/^[0-9a-f]+$/);
    expect(tracks.captions.src).toBe("captions.vtt");
    expect(Object.keys(tracks.tracks)).toContain("theta");
    expect(tracks.boardItems.cosdef).toBeDefined();
  });
});

describe("compile — determinism", () => {
  it("is byte-identical across runs for the same inputs", () => {
    const timing = fakeTiming(parseScript(SCRIPT).narration);
    const a = compile(SCRIPT, timing, SCENE, OPTS);
    const b = compile(SCRIPT, timing, SCENE, OPTS);
    expect(JSON.stringify(a.tracks)).toBe(JSON.stringify(b.tracks));
    expect(a.vtt).toBe(b.vtt);
  });

  it("is byte-identical when compilation executes a baker", () => {
    const scene: SceneInfo = {
      schema: {
        x: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
      },
      bakers: {
        advance: {
          reads: ["x"],
          writes: ["x"],
          run: (input, { steps }) =>
            Array.from({ length: steps }, (_, i) => ({ x: (input.x as number) + i + 1 })),
        },
      },
    };
    const script = "Now @bake(advance, steps: 3, over: 6s) advance.";
    const timing = fakeTiming(parseScript(script).narration);
    const a = compile(script, timing, scene, OPTS);
    const b = compile(script, timing, scene, OPTS);

    expect(JSON.stringify(a.tracks)).toBe(JSON.stringify(b.tracks));
    expect(a.tracks.tracks.x!.filter((keyframe) => keyframe.ease).map((keyframe) => keyframe.v)).toEqual([1, 2, 3]);
  });
});

describe("toVtt", () => {
  it("emits WEBVTT with well-formed timestamps and sentence text", () => {
    const text = "Hello world. This is a test.";
    const vtt = toVtt(text, fakeTiming(text));
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("Hello world.");
    expect(vtt).toContain("This is a test.");
    expect(vtt).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/);
  });
});
