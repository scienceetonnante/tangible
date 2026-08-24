import { describe, expect, it } from "vitest";
import type { SceneInfo } from "./check.js";
import { evaluateAuthoredState } from "./authored-state.js";
import { parseScript } from "./parse.js";

describe("evaluateAuthoredState", () => {
  it("applies every non-recorded scene-state writer in source order", () => {
    const camera = { target: [0, 0, 0] as [number, number, number], distance: 5, azimuth: 0, elevation: 0 };
    const side = { ...camera, azimuth: 1.5 };
    const scene: SceneInfo = {
      schema: {
        scene: { type: { kind: "enum", values: ["a", "b"] }, default: "a", interpolate: "snap", ownership: "script" },
        x: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
        y: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
        "show.loss": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
        camera: { type: { kind: "orbit" }, default: camera, interpolate: "orbit", ownership: "viewer" },
      },
      groups: { pair: ["x", "y"] },
      presets: { side: { camera: side } },
    };
    const parsed = parseScript(`
@cue(pair -> [3, 4], over: 100s)
@show(loss)
@camera(side, over: 20s)
@scene(b)
`);

    const result = evaluateAuthoredState(parsed, scene);

    expect(result.diagnostics).toEqual([]);
    expect(result.state).toMatchObject({ x: 3, y: 4, "show.loss": true, camera: side, scene: "b" });
  });

  it("feeds cue targets and prior baker output into later bakes without using timing", () => {
    const scene: SceneInfo = {
      schema: {
        x: { type: { kind: "scalar" }, default: 1, interpolate: "lerp", ownership: "script" },
        y: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
      },
      bakers: {
        setY: {
          reads: ["x"],
          writes: ["y"],
          run: (input) => [{ y: (input.x as number) * 2 }],
        },
        increment: {
          reads: ["y"],
          writes: ["y"],
          run: (input, { steps }) =>
            Array.from({ length: steps }, (_, i) => ({ y: (input.y as number) + i + 1 })),
        },
      },
    };
    const parsed = parseScript(`
@cue(x -> 3, over: 100s, at: +20s)
@bake(setY, at: -20s)
@bake(increment, steps: 2)
`);

    const result = evaluateAuthoredState(parsed, scene);
    const directives = parsed.directives.filter((directive) => directive.kind === "bake");

    expect(result.diagnostics).toEqual([]);
    expect(result.bakes.get(directives[0]!)).toEqual([{ y: 6 }]);
    expect(result.bakes.get(directives[1]!)).toEqual([{ y: 7 }, { y: 8 }]);
    expect(result.state.y).toBe(8);
  });

  it("merges partial inline cameras in source order", () => {
    const camera = { target: [0, 0, 0] as [number, number, number], distance: 5, azimuth: 0, elevation: 0 };
    const scene: SceneInfo = {
      schema: {
        camera: { type: { kind: "orbit" }, default: camera, interpolate: "orbit", ownership: "viewer" },
      },
    };
    const parsed = parseScript(`
@camera(target: [1, 2, 3], distance: 8, azimuth: 45, elevation: 20)
@camera(azimuth: 135°)
`);

    const result = evaluateAuthoredState(parsed, scene);

    expect(result.diagnostics).toEqual([]);
    expect(result.state.camera).toEqual({
      target: [1, 2, 3],
      distance: 8,
      azimuth: (135 * Math.PI) / 180,
      elevation: (20 * Math.PI) / 180,
    });
  });
});
