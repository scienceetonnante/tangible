import { describe, it, expect } from "vitest";
import { parseScript } from "./parse.js";
import { check, type SceneInfo } from "./check.js";
import { formatDiagnostic } from "./diagnostics.js";
import { SCRIPT_FR, SCENE } from "./fixtures.js";

function diagnose(src: string) {
  return check(parseScript(src, "script.fr.md"), SCENE).map(formatDiagnostic);
}

describe("check — clean script", () => {
  it("produces no diagnostics for the worked example", () => {
    expect(check(parseScript(SCRIPT_FR, "script.fr.md"), SCENE)).toEqual([]);
  });
});

describe("check — diagnostics (snapshots)", () => {
  it("unknown parameter with did-you-mean", () => {
    expect(diagnose("Texte @cue(show.projectionn = true) fin.")).toMatchInlineSnapshot(`
      [
        "script.fr.md:1:7: error: unknown parameter "show.projectionn" — did you mean "show.projection"?",
      ]
    `);
  });

  it("out-of-range scalar", () => {
    expect(diagnose("Texte @cue(theta -> 99) fin.")).toMatchInlineSnapshot(`
      [
        "script.fr.md:1:7: error: theta: 99 is out of range [0, 6.2832]",
      ]
    `);
  });

  it("type mismatch", () => {
    expect(diagnose("Texte @cue(theta -> vrai) fin.")).toMatchInlineSnapshot(`
      [
        "script.fr.md:1:7: error: theta: expected a number, got "vrai"",
      ]
    `);
  });

  it("illegal easing name", () => {
    expect(diagnose("Texte @cue(theta -> 1, ease: wobble) fin.")).toMatchInlineSnapshot(`
      [
        "script.fr.md:1:7: error: unknown easing "wobble"",
      ]
    `);
  });

  it("unknown directive with did-you-mean", () => {
    expect(diagnose("Texte @shwo(projection) fin.")).toMatchInlineSnapshot(`
      [
        "script.fr.md:1:7: error: unknown directive "@shwo" — did you mean "@show"?",
      ]
    `);
  });

  it("unknown camera preset (no suggestion when too far)", () => {
    expect(diagnose("Texte @camera(topView) fin.")).toMatchInlineSnapshot(`
      [
        "script.fr.md:1:7: error: unknown camera preset "topView"",
      ]
    `);
  });

  it("highlight target not tagged in the board item", () => {
    const src = "@board(euler: $e^{i\\theta} = \\cos\\theta$) texte @highlight(euler.sin) fin.";
    expect(diagnose(src)).toMatchInlineSnapshot(`
      [
        "script.fr.md:1:49: error: @highlight target "euler.sin" is not tagged \\htmlClass{sin}{…} in board item "euler"",
      ]
    `);
  });

  it("accepts a properly tagged highlight target", () => {
    const src = "@board(euler: $\\htmlClass{cos}{\\cos\\theta}$) texte @highlight(euler.cos) fin.";
    expect(diagnose(src)).toEqual([]);
  });
});

describe("check — parameter groups", () => {
  const GROUP_SCENE: SceneInfo = {
    schema: {
      scene: { type: { kind: "enum", values: ["s"] }, default: "s", interpolate: "snap", ownership: "script" },
      a: { type: { kind: "scalar", range: [-1, 1] }, default: 0, interpolate: "lerp", ownership: "shared" },
      b: { type: { kind: "scalar", range: [-1, 1] }, default: 0, interpolate: "lerp", ownership: "shared" },
    },
    groups: { pair: ["a", "b"] },
  };
  const g = (src: string) => check(parseScript(src, "script.fr.md"), GROUP_SCENE).map(formatDiagnostic);

  it("accepts a well-formed group cue", () => {
    expect(check(parseScript("Texte @cue(pair -> [0.5, -0.5]) fin.", "script.fr.md"), GROUP_SCENE)).toEqual([]);
  });

  it("flags wrong arity", () => {
    expect(g("Texte @cue(pair -> [0.5]) fin.")).toEqual([
      'script.fr.md:1:7: error: group "pair" has 2 parameter(s) but got 1 value(s)',
    ]);
  });

  it("flags a non-list value", () => {
    expect(g("Texte @cue(pair -> 0.5) fin.")).toEqual([
      'script.fr.md:1:7: error: group "pair" expects a list value like [a, b, c], got "0.5"',
    ]);
  });

  it("flags an out-of-range member", () => {
    expect(g("Texte @cue(pair -> [0.5, 9]) fin.")).toEqual([
      'script.fr.md:1:7: error: b (in group pair): 9 is out of range [-1, 1]',
    ]);
  });
});
