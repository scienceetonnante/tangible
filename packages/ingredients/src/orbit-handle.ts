// Camera-orbit handle: a background drag that rotates an orbit camera's azimuth
// and elevation. Provided by ingredients so any 3D scene gets orbit for free.

import type { Handle, OrbitState } from "@narrable/core";

export interface OrbitHandleOptions {
  param?: string; // orbit parameter to drive; default "camera"
  speed?: number; // radians per pixel; default 0.01
  minElevation?: number; // default -1.5 (~ -86°)
  maxElevation?: number; // default 1.5
}

export function orbitHandle(opts: OrbitHandleOptions = {}): Handle {
  const param = opts.param ?? "camera";
  const speed = opts.speed ?? 0.01;
  const minEl = opts.minElevation ?? -1.5;
  const maxEl = opts.maxElevation ?? 1.5;

  let startX = 0;
  let startY = 0;
  let start: OrbitState = { target: [0, 0, 0], distance: 1, azimuth: 0, elevation: 0 };

  return {
    id: "camera-orbit",
    params: [param],
    hitTest: () => true, // background drag; scenes list specific handles before this
    onDown(px, py, state) {
      startX = px;
      startY = py;
      const o = state[param] as OrbitState;
      start = { target: [...o.target] as [number, number, number], distance: o.distance, azimuth: o.azimuth, elevation: o.elevation };
    },
    onDrag(px, py) {
      const azimuth = start.azimuth - (px - startX) * speed;
      const elevation = Math.min(maxEl, Math.max(minEl, start.elevation + (py - startY) * speed));
      return { [param]: { target: [...start.target], distance: start.distance, azimuth, elevation } };
    },
  };
}
