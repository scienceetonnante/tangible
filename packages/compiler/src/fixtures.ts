// Shared fixtures for compiler tests: the original worked example and a
// matching scene description.

import type { SceneInfo } from "./check.js";

export const SCRIPT_FR = `---
title: Le cercle unité
scene: ./scene.ts
language: fr
voice: elevenlabs:antoine
---

@scene(circle)
@chapter(Le cercle et l'angle)

Voici un cercle de rayon un. Le point rouge est repéré par un angle,
qu'on appelle @cue(show.thetaLabel = true) thêta. Regardez ce qui se
passe quand on le fait @cue(theta -> 6.2832, over: 4s, ease: inOutCubic)
varier : le point fait le tour complet du cercle.

@show(projection) Projetons maintenant ce point sur l'axe horizontal.
La longueur obtenue, c'est @cue(show.cosLabel = true) le cosinus de
thêta. @board(cosdef: $x = \\cos\\theta$)

@pause(prompt: "Déplacez le point rouge vous-même et observez le cosinus.")

@cue(theta -> 1.5708, over: 2s) Reprenons. À quatre-vingt-dix degrés…
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
