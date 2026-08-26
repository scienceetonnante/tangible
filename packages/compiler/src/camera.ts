import type { OrbitState } from "@tangible/core";

export type CameraPatch = Partial<OrbitState>;

/** Merge an inline camera patch into the latest authored camera target. */
export function applyCameraPatch(base: OrbitState, patch: CameraPatch): OrbitState {
  return {
    target: patch.target ? [...patch.target] : [...base.target],
    distance: patch.distance ?? base.distance,
    azimuth: patch.azimuth ?? base.azimuth,
    elevation: patch.elevation ?? base.elevation,
  };
}
