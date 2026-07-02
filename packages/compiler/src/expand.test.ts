import { describe, it, expect } from "vitest";
import { parseScript } from "./parse.js";
import { resolve } from "./resolve.js";
import { expand } from "./expand.js";
import { buildIndex, evaluate } from "@xv/core";
import { SCRIPT_FR, SCENE } from "./fixtures.js";

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

describe("expand — worked example (DESIGN §6.5)", () => {
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
