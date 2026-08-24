import { describe, expect, it } from "vitest";
import { buildFrame } from "./frame.js";
import { gradient, loss, simulate, type OptimizerSettings, type Problem } from "./model.js";

const problem: Problem = { kappa: 1, roughness: 0, startX: -1.65, startY: 1.15 };
const settings: OptimizerSettings = {
  sgdLr: 0.075,
  momentumLr: 0.15,
  momentumBeta: 0.6,
  adamwLr: 0.1,
};

describe("optimizer lesson model", () => {
  it("uses double-frequency ripples in both coordinate directions", () => {
    const rough = { kappa: 1, roughness: 0.5 };
    const crest = Math.PI / 8;
    const nextTrough = Math.PI / 4;

    expect(loss(crest, 0, rough) - 0.5 * crest * crest).toBeCloseTo(1, 9);
    expect(loss(0, crest, rough) - 0.5 * crest * crest).toBeCloseTo(1, 9);
    expect(loss(nextTrough, 0, rough) - 0.5 * nextTrough * nextTrough).toBeCloseTo(0, 9);
    expect(loss(0, nextTrough, rough) - 0.5 * nextTrough * nextTrough).toBeCloseTo(0, 9);
  });

  it("matches a numerical gradient on a rough, conditioned bowl", () => {
    const rough = { kappa: 17, roughness: 0.23 };
    const point = { x: -0.73, y: 0.41 };
    const analytic = gradient(point.x, point.y, rough);
    const epsilon = 1e-6;
    const dx = (loss(point.x + epsilon, point.y, rough) - loss(point.x - epsilon, point.y, rough)) / (2 * epsilon);
    const dy = (loss(point.x, point.y + epsilon, rough) - loss(point.x, point.y - epsilon, rough)) / (2 * epsilon);

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

  it("starts every active optimizer from one shared point", () => {
    const frame = buildFrame({
      kappa: problem.kappa,
      roughness: problem.roughness,
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

  it("shows momentum and AdamW crossing a ripple that traps SGD", () => {
    const rough = { ...problem, roughness: 0.07 };
    const narratedSettings = { ...settings, momentumLr: 0.1, adamwLr: 0.12 };
    const sgd = simulate("sgd", rough, narratedSettings);
    const momentum = simulate("momentum", rough, narratedSettings);
    const adamw = simulate("adamw", rough, narratedSettings);

    expect(sgd.points.at(-1)!.loss).toBeGreaterThan(0.2);
    expect(momentum.points.at(-1)!.loss).toBeLessThan(1e-6);
    expect(adamw.points.at(-1)!.loss).toBeLessThan(1e-6);
  });
});
