import * as THREE from "three";
import { DOMAIN, loss, type Problem } from "./model.js";

export const SURFACE_HEIGHT = 1.8;

export function surfacePoint(x: number, y: number, problem: Problem, lift = 0): THREE.Vector3 {
  return new THREE.Vector3(x, normalizedLoss(x, y, problem) * SURFACE_HEIGHT + lift, -y);
}

export function normalizedLoss(x: number, y: number, problem: Problem): number {
  return Math.log1p(loss(x, y, problem)) / Math.log1p(loss(DOMAIN, DOMAIN, problem));
}

/** Find the first ray crossing of the rendered loss height field. */
export function intersectLossSurface(ray: THREE.Ray, problem: Problem): THREE.Vector3 | undefined {
  let previous: { t: number; offset: number } | undefined;
  for (let index = 0; index <= 320; index++) {
    const t = (index / 320) * 20;
    const point = ray.at(t, new THREE.Vector3());
    if (Math.abs(point.x) > DOMAIN || Math.abs(point.z) > DOMAIN) {
      previous = undefined;
      continue;
    }
    const offset = point.y - normalizedLoss(point.x, -point.z, problem) * SURFACE_HEIGHT;
    if (previous && previous.offset >= 0 && offset <= 0) return refineIntersection(ray, problem, previous.t, t);
    previous = { t, offset };
  }
  return undefined;
}

function refineIntersection(ray: THREE.Ray, problem: Problem, start: number, end: number): THREE.Vector3 {
  let lo = start;
  let hi = end;
  for (let iteration = 0; iteration < 12; iteration++) {
    const mid = (lo + hi) / 2;
    const point = ray.at(mid, new THREE.Vector3());
    const offset = point.y - normalizedLoss(point.x, -point.z, problem) * SURFACE_HEIGHT;
    if (offset > 0) lo = mid;
    else hi = mid;
  }
  return ray.at((lo + hi) / 2, new THREE.Vector3());
}
