import { describe, expect, it } from "vitest";
import { buildFrame } from "./frame.js";
import { gradient, loss, simulate, type OptimizerSettings, type Problem } from "./model.js";

const problem: Problem = { kappa: 1, startX: -1.65, startY: 1.15 };
const settings: OptimizerSettings = {
  sgdLr: 0.075,
  momentumLr: 0.15,
  momentumBeta: 0.6,
  adamwLr: 0.1,
};

describe("optimizer lesson model", () => {
  it("matches a numerical gradient on a conditioned bowl", () => {
    const conditioned = { kappa: 17 };
    const point = { x: -0.73, y: 0.41 };
    const analytic = gradient(point.x, point.y, conditioned);
    const epsilon = 1e-6;
    const dx =
      (loss(point.x + epsilon, point.y, conditioned) - loss(point.x - epsilon, point.y, conditioned)) /
      (2 * epsilon);
    const dy =
      (loss(point.x, point.y + epsilon, conditioned) - loss(point.x, point.y - epsilon, conditioned)) /
      (2 * epsilon);

    expect(analytic.x).toBeCloseTo(dx, 6);
    expect(analytic.y).toBeCloseTo(dy, 6);
  });

  it("keeps SGD's learning rate fixed as conditioning crosses its stability threshold", () => {
    const stable = simulate("sgd", { ...problem, kappa: 24 }, settings);
    const unstable = simulate("sgd", { ...problem, kappa: 32 }, settings);

    expect(stable.divergedAt).toBeUndefined();
    expect(stable.points.at(-1)!.loss).toBeLessThan(2e-4);
    expect(unstable.divergedAt).toBeDefined();
  });

  it("treats two divided by kappa as a strict SGD stability boundary", () => {
    const boundarySettings = { ...settings, sgdLr: 0.05 };
    const below = simulate("sgd", { ...problem, kappa: 40 }, { ...settings, sgdLr: 0.049 });
    const boundary = simulate("sgd", { ...problem, kappa: 40 }, boundarySettings);
    const above = simulate("sgd", { ...problem, kappa: 40 }, { ...settings, sgdLr: 0.051 });

    expect(Math.abs(below.points.at(-1)!.y)).toBeLessThan(Math.abs(problem.startY));
    expect(Math.abs(boundary.points.at(-1)!.y)).toBeCloseTo(Math.abs(problem.startY));
    expect(above.divergedAt).toBeDefined();
  });

  it("does not excite steep-direction instability from the ravine floor", () => {
    const trajectory = simulate(
      "sgd",
      { ...problem, kappa: 40, startY: 0 },
      { ...settings, sgdLr: 0.07 },
    );

    expect(trajectory.divergedAt).toBeUndefined();
    expect(trajectory.points.every((point) => point.y === 0)).toBe(true);
  });

  it("starts every active optimizer from one shared point", () => {
    const frame = buildFrame({
      kappa: problem.kappa,
      "start.x": problem.startX,
      "start.y": problem.startY,
      "sgd.lr": settings.sgdLr,
      "momentum.lr": settings.momentumLr,
      "momentum.beta": settings.momentumBeta,
      "adamw.lr": settings.adamwLr,
      "active.sgd": true,
      "active.momentum": true,
      "active.adamw": true,
      step: 0,
    });

    expect(frame.trajectories.map((trajectory) => trajectory.points[0])).toEqual([
      { x: -1.65, y: 1.15, loss: loss(problem.startX, problem.startY, problem), stepSize: 0 },
      { x: -1.65, y: 1.15, loss: loss(problem.startX, problem.startY, problem), stepSize: 0 },
      { x: -1.65, y: 1.15, loss: loss(problem.startX, problem.startY, problem), stepSize: 0 },
    ]);
  });
});
