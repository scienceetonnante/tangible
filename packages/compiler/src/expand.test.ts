import { describe, it, expect } from "vitest";
import { parseScript } from "./parse.js";
import { resolve } from "./resolve.js";
import { expand } from "./expand.js";
import { buildIndex, evaluate, type ParamValue } from "@narrable/core";
import { SCRIPT_FR, SCENE } from "./fixtures.js";
import { evaluateAuthoredState } from "./authored-state.js";

const DEFAULTS = { ease: "inOutCubic", transition: 1.0 };

// Inline deterministic timing (60ms/char) so the compiler stays core-only.
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

async function compileFixture() {
  const parsed = parseScript(SCRIPT_FR);
  const timing = fakeTiming(parsed.narration);
  const cues = resolve(parsed.directives, parsed.narration, timing, { anticipation: -0.2 });
  const result = expand(cues, SCENE, { language: "fr", defaults: DEFAULTS });
  return { parsed, timing, cues, result };
}

describe("expand — worked example", () => {
  it("produces the expected track set with no warnings", async () => {
    const { result } = await compileFixture();
    expect(result.warnings).toEqual([]);
    expect(Object.keys(result.tracks).sort()).toEqual(
      ["board.cosdef", "scene", "show.cosLabel", "show.projection", "show.thetaLabel", "theta"].sort(),
    );
  });

  it("theta is animated: from-value + eased destination pairs", async () => {
    const { result } = await compileFixture();
    const theta = result.tracks.theta!;
    // Two animations (→6.2832 then →1.5708) → 4 keyframes, destinations carry easing.
    const eased = theta.filter((k) => k.ease);
    expect(eased.map((k) => k.v)).toEqual([6.2832, 1.5708]);
    expect(eased.every((k) => k.ease === "inOutCubic")).toBe(true);
  });

  it("show.thetaLabel snaps true at its cue and holds", async () => {
    const { result } = await compileFixture();
    const track = result.tracks["show.thetaLabel"]!;
    expect(track).toHaveLength(1);
    expect(track[0]!.v).toBe(true);
  });

  it("board item is defined and shown", async () => {
    const { result } = await compileFixture();
    expect(result.boardItems.cosdef).toEqual({ kind: "katex", source: { fr: "x = \\cos\\theta" } });
    expect(result.tracks["board.cosdef"]![0]!.v).toBe("shown");
  });

  it("emits the chapter and the pause", async () => {
    const { result } = await compileFixture();
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]!.title).toBe("Le cercle et l'angle");
    expect(result.pauses).toHaveLength(1);
    expect(result.pauses[0]!.prompt).toContain("Déplacez le point rouge");
    expect(result.pauses[0]!.tail).toBe(0);
  });

  it("does not let the next anticipated visual leak across a spoken pause", () => {
    const parsed = parseScript('Before. @pause(prompt: "Try it now.") @cue(theta -> 3, over: 1s) Here we continue.');
    const timing = fakeTiming(parsed.narration);
    const cues = resolve(parsed.directives, parsed.narration, timing, { anticipation: -0.2 });
    const pause = cues.find((cue) => cue.directive.kind === "pause")!;
    const next = cues.find((cue) => cue.directive.kind === "cue")!;
    const result = expand(cues, SCENE, { language: "en", defaults: DEFAULTS });

    expect(next.t).toBe(pause.t);
    expect(result.pauses[0]!.tail).toBe(0);
  });

  it("does not delay a silent pause into the following narration", () => {
    const parsed = parseScript('Before. @pause(prompt: "Try it", speak: false) After.');
    const timing = fakeTiming(parsed.narration);
    const cues = resolve(parsed.directives, parsed.narration, timing, { anticipation: 0 });
    const result = expand(cues, SCENE, { language: "en", defaults: DEFAULTS });

    expect(result.pauses[0]!.tail).toBe(0);
  });

  it("the compiled theta track is seekable and monotone through the sweep", async () => {
    const { result, timing } = await compileFixture();
    const idx = buildIndex(result.tracks, SCENE.schema);
    // Before any cue: schema default.
    expect(evaluate(idx, 0).theta).toBe(0);
    // At the end: holds the last scripted value.
    expect(evaluate(idx, timing.duration).theta).toBeCloseTo(1.5708, 6);
  });
});

describe("expand — conflict rule", () => {
  it("truncates an in-flight transition at the next cue and warns", () => {
    const scene = {
      schema: { x: { type: { kind: "scalar" as const }, default: 0, interpolate: "lerp" as const, ownership: "script" as const } },
    };
    // Two cues: animate to 10 over 10s starting at t=0, then set to 3 at t=5 (mid-flight).
    const cues = [
      { t: 0, directive: mkCue("x", "animate", "10", { over: 10, ease: "linear" }) },
      { t: 5, directive: mkCue("x", "set", "3", {}) },
    ];
    const result = expand(cues, scene, { language: "fr", defaults: DEFAULTS });
    expect(result.warnings.some((w) => w.message.includes("truncated"))).toBe(true);
    const x = result.tracks.x!;
    // The first transition's destination was cut to t=5 with its interpolated value (~5).
    const cut = x.find((k) => Math.abs(k.t - 5) < 1e-9 && k.ease === "linear")!;
    expect(cut.v).toBeCloseTo(5, 6);
  });
});

describe("expand — parameter groups", () => {
  it("fans a group cue out to its member params in order", () => {
    const scene = {
      schema: {
        a: { type: { kind: "scalar" as const }, default: 0, interpolate: "lerp" as const, ownership: "shared" as const },
        b: { type: { kind: "scalar" as const }, default: 0, interpolate: "lerp" as const, ownership: "shared" as const },
      },
      groups: { pair: ["a", "b"] },
    };
    const cues = [{ t: 1, directive: mkCue("pair", "set", "[0.5, -0.5]", {}) }];
    const result = expand(cues, scene, { language: "fr", defaults: DEFAULTS });
    expect(result.warnings).toEqual([]);
    expect(result.tracks.a![0]!.v).toBe(0.5);
    expect(result.tracks.b![0]!.v).toBe(-0.5);
  });
});

describe("expand — baked steps", () => {
  const scene = {
    schema: {
      x: { type: { kind: "scalar" as const }, default: 0, interpolate: "lerp" as const, ownership: "script" as const },
    },
    bakers: {
      advance: {
        reads: ["x"],
        writes: ["x"],
        run: (input: Readonly<Record<string, ParamValue>>, { steps }: { steps: number }) => {
          const start = input.x as number;
          return Array.from({ length: steps }, (_, i) => ({ x: start + i + 1 }));
        },
      },
    },
  };

  it("lays multi-step endpoints out evenly with easing on every segment", () => {
    const parsed = parseScript("Start @bake(advance, steps: 3, over: 6s, ease: linear) moving.");
    const authored = evaluateAuthoredState(parsed, scene);
    const timing = fakeTiming(parsed.narration);
    const cues = resolve(parsed.directives, parsed.narration, timing, { anticipation: -0.2 });
    const result = expand(cues, scene, { language: "en", defaults: DEFAULTS, bakes: authored.bakes });
    const start = cues[0]!.t;
    const endpoints = result.tracks.x!.filter((keyframe) => keyframe.ease);

    expect(endpoints.map(({ t, v, ease }) => ({ t, v, ease }))).toEqual([
      { t: start + 2, v: 1, ease: "linear" },
      { t: start + 4, v: 2, ease: "linear" },
      { t: start + 6, v: 3, ease: "linear" },
    ]);
  });

  it("defaults total duration to transition times step count", () => {
    const parsed = parseScript("Start @bake(advance, steps: 2) moving.");
    const authored = evaluateAuthoredState(parsed, scene);
    const timing = fakeTiming(parsed.narration);
    const cues = resolve(parsed.directives, parsed.narration, timing, { anticipation: 0 });
    const result = expand(cues, scene, {
      language: "en",
      defaults: { ...DEFAULTS, transition: 1.5 },
      bakes: authored.bakes,
    });
    const start = cues[0]!.t;

    expect(result.tracks.x!.filter((keyframe) => keyframe.ease).map((keyframe) => keyframe.t)).toEqual([
      start + 1.5,
      start + 3,
    ]);
  });

  it("uses the existing overlap truncation rule at bake start", () => {
    const bake = mkBake("advance", 1, { over: 2, ease: "linear" });
    const cues = [
      { t: 0, directive: mkCue("x", "animate", "10", { over: 10, ease: "linear" }) },
      { t: 5, directive: bake },
    ];
    const result = expand(cues, scene, {
      language: "en",
      defaults: DEFAULTS,
      bakes: new Map([[bake, [{ x: 6 }]]]),
    });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.message).toContain("x");
    expect(result.tracks.x!.at(-1)).toEqual({ t: 7, v: 6, ease: "linear" });
  });
});

function mkCue(param: string, mode: "animate" | "set", value: string, options: { over?: number; ease?: string }) {
  return {
    kind: "cue" as const,
    assignments: [{ param, mode, value }],
    options,
    anchorOffset: 0,
    block: false,
    loc: { line: 1, col: 1 },
    raw: "",
  };
}

function mkBake(name: string, steps: number, options: { over?: number; ease?: string }) {
  return {
    kind: "bake" as const,
    name,
    options: { ...options, steps },
    anchorOffset: 0,
    block: false,
    loc: { line: 2, col: 1 },
    raw: "",
  };
}
