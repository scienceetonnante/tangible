import { describe, it, expect } from "vitest";
import { orbitHandle } from "./orbit-handle.js";
import type { OrbitState, PlainState } from "@tangible/core";

const start: OrbitState = { target: [0, 0, 0], distance: 5, azimuth: 0, elevation: 0 };

describe("orbitHandle", () => {
  it("maps horizontal drag to azimuth and vertical to elevation", () => {
    const h = orbitHandle({ speed: 0.01 });
    const state: PlainState = { camera: start };
    h.onDown!(100, 100, state);
    const out = h.onDrag(150, 130, state).camera as OrbitState;
    expect(out.azimuth).toBeCloseTo(-0.5, 9); // -(150-100)*0.01
    expect(out.elevation).toBeCloseTo(0.3, 9); // (130-100)*0.01
    expect(out.distance).toBe(5);
  });

  it("clamps elevation to its bounds", () => {
    const h = orbitHandle({ speed: 0.01, minElevation: -1, maxElevation: 1 });
    const state: PlainState = { camera: start };
    h.onDown!(0, 0, state);
    const out = h.onDrag(0, 100000, state).camera as OrbitState; // huge vertical drag
    expect(out.elevation).toBe(1);
  });

  it("does not mutate the starting orbit state", () => {
    const h = orbitHandle();
    const state: PlainState = { camera: start };
    h.onDown!(0, 0, state);
    h.onDrag(50, 50, state);
    expect(start.azimuth).toBe(0);
  });

  it("zooms within configured distance bounds", () => {
    const h = orbitHandle({ zoomSpeed: 0.01, minDistance: 3, maxDistance: 8 });
    const state: PlainState = { camera: start };

    const closer = h.onWheel!(0, 0, -100, state).camera as OrbitState;
    const farther = h.onWheel!(0, 0, 100, state).camera as OrbitState;

    expect(closer.distance).toBe(3);
    expect(farther.distance).toBe(8);
    expect(start.distance).toBe(5);
  });
});
