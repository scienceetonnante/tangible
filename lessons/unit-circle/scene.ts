// Unit-circle scene module. M0 exports only the parameter schema, presets, and
// constants (importable in Node without a DOM). The render function arrives in M1.

import type { Schema, ParamValue } from "@xv/core";

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["circle"] }, default: "circle", interpolate: "snap", ownership: "script" },
  theta: {
    type: { kind: "scalar", range: [0, 6.2832] },
    default: 0,
    interpolate: "lerp",
    ownership: "script",
    label: "angle of the point on the circle",
  },
  camera: {
    type: { kind: "orbit" },
    default: { target: [0, 0, 0], distance: 5, azimuth: 0, elevation: 0 },
    interpolate: "orbit",
    ownership: "viewer",
  },
  "show.thetaLabel": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
  "show.projection": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
  "show.cosLabel": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
};

export const presets: Record<string, Record<string, ParamValue>> = {
  sideView: { camera: { target: [0, 0, 0], distance: 5, azimuth: Math.PI / 2, elevation: 0 } },
};

export const constants: Record<string, number | number[]> = {
  HALF_PI: 1.5708,
  TWO_PI: 6.2832,
};
