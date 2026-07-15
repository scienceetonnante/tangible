export type OptimizerName = "sgd" | "momentum" | "adamw";

export interface Point {
  x: number;
  y: number;
  loss: number;
  stepSize: number;
}

export interface Problem {
  kappa: number;
  roughness: number;
  startX: number;
  startY: number;
}

export interface OptimizerSettings {
  sgdLr: number;
  momentumLr: number;
  momentumBeta: number;
  adamwLr: number;
}

export interface Trajectory {
  name: OptimizerName;
  points: Point[];
  divergedAt?: number;
}

export const MAX_STEPS = 60;
export const DOMAIN = 2;
export const ADAM_BETA_1 = 0.7;
export const ADAM_BETA_2 = 0.95;
export const WEIGHT_DECAY = 0.01;

const RIPPLE_FREQUENCY = 4;
const DIVERGENCE_RADIUS = DOMAIN * 3;
const EPSILON = 1e-8;

/** A conditioned quadratic bowl with an independent ripple along its flat direction. */
export function loss(x: number, y: number, problem: Pick<Problem, "kappa" | "roughness">): number {
  const ripple = problem.roughness * (1 - Math.cos(RIPPLE_FREQUENCY * x));
  return 0.5 * (x * x + problem.kappa * y * y) + ripple;
}

/** Analytic gradient of the lesson's loss surface. */
export function gradient(
  x: number,
  y: number,
  problem: Pick<Problem, "kappa" | "roughness">,
): { x: number; y: number } {
  return {
    x: x + RIPPLE_FREQUENCY * problem.roughness * Math.sin(RIPPLE_FREQUENCY * x),
    y: problem.kappa * y,
  };
}

/** Reflect one shared upper-left anchor into equivalent optimizer start positions. */
export function symmetricProblem(name: OptimizerName, problem: Problem): Problem {
  if (name === "momentum") return { ...problem, startX: -problem.startX };
  if (name === "adamw") return { ...problem, startY: -problem.startY };
  return problem;
}

/** Run one optimizer from the shared start point until it converges or leaves the view. */
export function simulate(
  name: OptimizerName,
  problem: Problem,
  settings: OptimizerSettings,
  steps = MAX_STEPS,
): Trajectory {
  let x = problem.startX;
  let y = problem.startY;
  let vx = 0;
  let vy = 0;
  let mx = 0;
  let my = 0;
  let sx = 0;
  let sy = 0;
  const points: Point[] = [{ x, y, loss: loss(x, y, problem), stepSize: 0 }];

  for (let step = 1; step <= steps; step++) {
    const previousX = x;
    const previousY = y;
    const g = gradient(x, y, problem);

    if (name === "sgd") {
      x -= settings.sgdLr * g.x;
      y -= settings.sgdLr * g.y;
    } else if (name === "momentum") {
      vx = settings.momentumBeta * vx + (1 - settings.momentumBeta) * g.x;
      vy = settings.momentumBeta * vy + (1 - settings.momentumBeta) * g.y;
      x -= settings.momentumLr * vx;
      y -= settings.momentumLr * vy;
    } else {
      mx = ADAM_BETA_1 * mx + (1 - ADAM_BETA_1) * g.x;
      my = ADAM_BETA_1 * my + (1 - ADAM_BETA_1) * g.y;
      sx = ADAM_BETA_2 * sx + (1 - ADAM_BETA_2) * g.x * g.x;
      sy = ADAM_BETA_2 * sy + (1 - ADAM_BETA_2) * g.y * g.y;
      const correctedM = { x: mx / (1 - ADAM_BETA_1 ** step), y: my / (1 - ADAM_BETA_1 ** step) };
      const correctedS = { x: sx / (1 - ADAM_BETA_2 ** step), y: sy / (1 - ADAM_BETA_2 ** step) };
      x -= settings.adamwLr * (correctedM.x / (Math.sqrt(correctedS.x) + EPSILON) + WEIGHT_DECAY * x);
      y -= settings.adamwLr * (correctedM.y / (Math.sqrt(correctedS.y) + EPSILON) + WEIGHT_DECAY * y);
    }

    points.push({
      x,
      y,
      loss: loss(x, y, problem),
      stepSize: Math.hypot(x - previousX, y - previousY),
    });
    if (Math.hypot(x, y) > DIVERGENCE_RADIUS) return { name, points, divergedAt: step };
  }

  return { name, points };
}

/** Position and loss at a fractional matched step. */
export function sample(trajectory: Trajectory, step: number): Point {
  const bounded = Math.max(0, Math.min(step, trajectory.points.length - 1));
  const index = Math.floor(bounded);
  const a = trajectory.points[index]!;
  const b = trajectory.points[Math.min(index + 1, trajectory.points.length - 1)]!;
  const t = bounded - index;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    loss: a.loss + (b.loss - a.loss) * t,
    stepSize: a.stepSize + (b.stepSize - a.stepSize) * t,
  };
}
