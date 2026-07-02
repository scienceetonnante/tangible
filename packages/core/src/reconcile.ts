// Pure reconciliation math (ARCHITECTURE §3.3), consumed by the player's Reconciler
// (§5.5) and by CLI "state including a hypothetical interaction". Frame-rate
// independent: an exponential approach that composes over subdivided dt.

// Defaults from the exemplar; the player may override per-instance.
export const DEFAULT_HOLD = 3; // seconds the user value overrides scripted after last touch
export const DEFAULT_TAU = 0.2; // exponential time constant (≈ 0.92/frame at 60fps)

/** Fraction of the (prev − target) gap retained after dt seconds. */
export function blendRetain(dt: number, tau: number = DEFAULT_TAU): number {
  return Math.exp(-dt / tau);
}

/** Interpolation parameter u∈[0,1] to advance from prev toward target this frame;
 *  feed to a kernel (lerp/nlerp/orbit) so blends respect the parameter's geometry. */
export function approachU(dt: number, tau: number = DEFAULT_TAU): number {
  return 1 - Math.exp(-dt / tau);
}

/** Scalar exponential approach: displayed ← target + (prev − target)·e^(−dt/τ). */
export function approachScalar(prev: number, target: number, dt: number, tau: number = DEFAULT_TAU): number {
  const k = Math.exp(-dt / tau);
  return target + (prev - target) * k;
}

/** Whether the post-interaction hold window is still active. */
export function holdActive(now: number, lastTouched: number, hold: number = DEFAULT_HOLD): boolean {
  return now - lastTouched < hold;
}

/** Convergence test to snap-and-clear a continuous parameter's modified flag. */
export function convergedScalar(prev: number, target: number, eps: number): boolean {
  return Math.abs(prev - target) <= eps;
}

/** Max per-component absolute difference; convergence test for vectors/quaternions. */
export function maxAbsDiff(a: number[], b: number[]): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
}
