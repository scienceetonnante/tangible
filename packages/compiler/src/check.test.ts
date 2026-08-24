import { describe, it, expect } from "vitest";
import { parseScript } from "./parse.js";
import { check, type SceneInfo } from "./check.js";
import { formatDiagnostic } from "./diagnostics.js";
import { SCRIPT, SCENE } from "./fixtures.js";
import type { BakerDefinition } from "@narrable/core";

function diagnose(src: string) {
  return check(parseScript(src, "script.md"), SCENE).map(formatDiagnostic);
}

describe("check — clean script", () => {
  it("produces no diagnostics for the worked example", () => {
    expect(check(parseScript(SCRIPT, "script.md"), SCENE)).toEqual([]);
  });
});

describe("check — diagnostics (snapshots)", () => {
  it("unknown parameter with did-you-mean", () => {
    expect(diagnose("Words @cue(show.projectionn = true) end.")).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: unknown parameter "show.projectionn" — did you mean "show.projection"?",
      ]
    `);
  });

  it("out-of-range scalar", () => {
    expect(diagnose("Words @cue(theta -> 99) end.")).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: theta: 99 is out of range [0, 6.2832]",
      ]
    `);
  });

  it("type mismatch", () => {
    expect(diagnose("Words @cue(theta -> wrong) end.")).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: theta: expected a number, got "wrong"",
      ]
    `);
  });

  it("illegal easing name", () => {
    expect(diagnose("Words @cue(theta -> 1, ease: wobble) end.")).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: unknown easing "wobble"",
      ]
    `);
  });

  it("unknown directive with did-you-mean", () => {
    expect(diagnose("Words @shwo(projection) end.")).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: unknown directive "@shwo" — did you mean "@show"?",
      ]
    `);
  });

  it("unknown camera preset (no suggestion when too far)", () => {
    expect(diagnose("Words @camera(topView) end.")).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: unknown camera preset "topView"",
      ]
    `);
  });

  it("accepts inline camera values for an orbit camera", () => {
    expect(diagnose("Words @camera(target: [0, 1, 0], distance: 4, azimuth: 90°, elevation: 30) end.")).toEqual([]);
  });

  it("rejects inline camera values for a non-orbit camera parameter", () => {
    const scene: SceneInfo = {
      schema: {
        camera: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
      },
    };
    const diagnostics = check(parseScript("Words @camera(azimuth: 90) end.", "script.md"), scene).map(formatDiagnostic);
    expect(diagnostics).toEqual([
      'script.md:1:7: error: inline @camera values require parameter "camera" to have type "orbit"',
    ]);
  });

  it("highlight target not tagged in the board item", () => {
    const src = "@board(euler: $e^{i\\theta} = \\cos\\theta$) words @highlight(euler.sin) end.";
    expect(diagnose(src)).toMatchInlineSnapshot(`
      [
        "script.md:1:49: error: @highlight target "euler.sin" is not tagged \\htmlClass{sin}{…} in board item "euler"",
      ]
    `);
  });

  it("accepts a properly tagged highlight target", () => {
    const src = "@board(euler: $\\htmlClass{cos}{\\cos\\theta}$) words @highlight(euler.cos) end.";
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
  const g = (src: string) => check(parseScript(src, "script.md"), GROUP_SCENE).map(formatDiagnostic);

  it("accepts a well-formed group cue", () => {
    expect(check(parseScript("Words @cue(pair -> [0.5, -0.5]) end.", "script.md"), GROUP_SCENE)).toEqual([]);
  });

  it("flags wrong arity", () => {
    expect(g("Words @cue(pair -> [0.5]) end.")).toEqual([
      'script.md:1:7: error: group "pair" has 2 parameter(s) but got 1 value(s)',
    ]);
  });

  it("flags a non-list value", () => {
    expect(g("Words @cue(pair -> 0.5) end.")).toEqual([
      'script.md:1:7: error: group "pair" expects a list value like [a, b, c], got "0.5"',
    ]);
  });

  it("flags an out-of-range member", () => {
    expect(g("Words @cue(pair -> [0.5, 9]) end.")).toEqual([
      'script.md:1:7: error: b (in group pair): 9 is out of range [-1, 1]',
    ]);
  });
});

describe("check — bakers", () => {
  const schema: SceneInfo["schema"] = {
    x: { type: { kind: "scalar", range: [0, 10] }, default: 1, interpolate: "lerp", ownership: "script" },
    y: { type: { kind: "scalar", range: [0, 10] }, default: 2, interpolate: "lerp", ownership: "script" },
  };
  const good: BakerDefinition = {
    reads: ["x"],
    writes: ["x"],
    run: (input, { steps }) => Array.from({ length: steps }, () => ({ x: input.x! })),
  };
  const diagnoseBaker = (baker: BakerDefinition, source = "Words @bake(advance) end.") =>
    check(parseScript(source, "script.md"), { schema, bakers: { advance: baker } }).map(formatDiagnostic);

  it("accepts a deterministic baker and passes only its declared reads", () => {
    let inputKeys: string[] = [];
    const baker: BakerDefinition = {
      reads: ["x"],
      writes: ["x"],
      run: (input) => {
        inputKeys = Object.keys(input);
        return [{ x: input.x! }];
      },
    };
    expect(diagnoseBaker(baker)).toEqual([]);
    expect(inputKeys).toEqual(["x"]);
  });

  it("reports an unknown baker with a suggestion", () => {
    const scene = { schema, bakers: { advance: good } };
    expect(check(parseScript("Words @bake(advnce) end.", "script.md"), scene).map(formatDiagnostic)).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: unknown baker "advnce" — did you mean "advance"?",
      ]
    `);
  });

  it("reports unknown declared reads and writes", () => {
    expect(diagnoseBaker({ ...good, reads: ["missing"] })).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: baker "advance" reads unknown parameter "missing"",
      ]
    `);
    expect(diagnoseBaker({ ...good, writes: ["missing"] })).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: baker "advance" writes unknown parameter "missing"",
      ]
    `);
  });

  it("reports a non-array result and the wrong number of steps", () => {
    expect(diagnoseBaker({ ...good, run: () => "nope" as never })).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: baker "advance" must return an array of steps",
      ]
    `);
    expect(diagnoseBaker({ ...good, run: () => [] })).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: baker "advance" returned 0 step(s), expected 1",
      ]
    `);
  });

  it("reports missing and undeclared writes", () => {
    expect(diagnoseBaker({ ...good, run: () => [{}] })).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: baker "advance" step 1 is missing write "x"",
      ]
    `);
    expect(diagnoseBaker({ ...good, run: () => [{ x: 1, extra: 2 }] })).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: baker "advance" step 1 contains undeclared write "extra"",
      ]
    `);
  });

  it("reports invalid and out-of-range values", () => {
    expect(diagnoseBaker({ ...good, run: () => [{ x: "bad" }] })).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: baker "advance" step 1, x: expected a finite number",
      ]
    `);
    expect(diagnoseBaker({ ...good, run: () => [{ x: 11 }] })).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: baker "advance" step 1, x: 11 is out of range [0, 10]",
      ]
    `);
  });

  it("reports thrown errors", () => {
    expect(
      diagnoseBaker({
        ...good,
        run: () => {
          throw new Error("boom");
        },
      }),
    ).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: baker "advance" threw: boom",
      ]
    `);
  });

  it("reports output that changes between identical runs", () => {
    let value = 0;
    expect(diagnoseBaker({ ...good, run: () => [{ x: value++ }] })).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: baker "advance" returned different output for identical input",
      ]
    `);
  });

  it("validates easing like an ordinary cue", () => {
    expect(diagnoseBaker(good, "Words @bake(advance, ease: wobble) end.")).toMatchInlineSnapshot(`
      [
        "script.md:1:7: error: unknown easing "wobble"",
      ]
    `);
  });
});
