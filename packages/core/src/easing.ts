// Easing registry — shared verbatim by compiler and player; easing names are part
// of the compiled format. Every curve satisfies f(0)=0 and f(1)=1 exactly, so a
// segment always lands on its target keyframe value (value-at-time correctness).

export type EasingFn = (t: number) => number;

// "spring" is an easeOutBack preset: a mild overshoot that settles exactly on 1.
// The constant is part of the format once published.
const BACK_C1 = 1.70158;

export const EASINGS: Record<string, EasingFn> = {
  linear: (t) => t,
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  spring: (t) => 1 + (BACK_C1 + 1) * Math.pow(t - 1, 3) + BACK_C1 * Math.pow(t - 1, 2),
};

export function isEasing(name: string): boolean {
  return name in EASINGS;
}

export function getEasing(name: string): EasingFn {
  const fn = EASINGS[name];
  if (!fn) throw new Error(`unknown easing: ${name}`);
  return fn;
}
