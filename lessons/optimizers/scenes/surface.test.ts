import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { Problem } from "./model.js";
import { intersectLossSurface, normalizedLoss, SURFACE_HEIGHT } from "./surface.js";

const problem: Problem = { kappa: 12, startX: -1.65, startY: 1.15 };

describe("optimizer 3D surface", () => {
  it("intersects the rendered height field from above", () => {
    const ray = new THREE.Ray(new THREE.Vector3(-1, 5, -0.75), new THREE.Vector3(0, -1, 0));
    const hit = intersectLossSurface(ray, problem)!;

    expect(hit.x).toBeCloseTo(-1, 6);
    expect(hit.z).toBeCloseTo(-0.75, 6);
    expect(hit.y).toBeCloseTo(normalizedLoss(-1, 0.75, problem) * SURFACE_HEIGHT, 4);
  });

  it("does not pick outside the modeled domain", () => {
    const ray = new THREE.Ray(new THREE.Vector3(3, 5, 0), new THREE.Vector3(0, -1, 0));
    expect(intersectLossSurface(ray, problem)).toBeUndefined();
  });
});
