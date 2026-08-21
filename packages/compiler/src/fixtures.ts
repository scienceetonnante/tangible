// Shared fixtures for compiler tests: a worked example and matching scene.

import type { SceneInfo } from "./check.js";

export const SCRIPT = `---
title: The unit circle
scene: ./scenes/scene.ts
voice: elevenlabs:voice
---

@scene(circle)
@chapter(The circle and the angle)

Here is a circle of radius one. The red point is located by an angle
we call @cue(show.thetaLabel = true) theta. Watch what happens when we
let it @cue(theta -> 6.2832, over: 4s, ease: inOutCubic) vary: the point
goes all the way around the circle.

@show(projection) Now let's project this point onto the horizontal axis.
The length we get is @cue(show.cosLabel = true) the cosine of theta.
@board(cosdef: $x = \\cos\\theta$)

@pause(prompt: "Drag the red point yourself and watch the cosine.")

@cue(theta -> 1.5708, over: 2s) Let's continue. At ninety degrees…
`;

export const SCENE: SceneInfo = {
  schema: {
    scene: { type: { kind: "enum", values: ["circle"] }, default: "circle", interpolate: "snap", ownership: "script" },
    theta: { type: { kind: "scalar", range: [0, 6.2832] }, default: 0, interpolate: "lerp", ownership: "script" },
    camera: {
      type: { kind: "orbit" },
      default: { target: [0, 0, 0], distance: 5, azimuth: 0, elevation: 0 },
      interpolate: "orbit",
      ownership: "viewer",
    },
    "show.thetaLabel": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
    "show.projection": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
    "show.cosLabel": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
  },
  presets: {
    sideView: { camera: { target: [0, 0, 0], distance: 5, azimuth: Math.PI / 2, elevation: 0 } },
  },
  constants: { HALF_PI: 1.5708, TWO_PI: 6.2832 },
};
