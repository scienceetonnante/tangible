import { describe, expect, it } from "vitest";
import { gradient, loss, simulate, type OptimizerSettings, type Problem } from "./model.js";

const problem: Problem = { kappa: 1, roughness: 0, startX: -1.65, startY: 1.15 };
const settings: OptimizerSettings = {
  sgdLr: 0.075,
  momentumLr: 0.15,
  momentumBeta: 0.6,
  adamwLr: 0.1,
};

describe("optimizer lesson model", () => {
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
    expect(stable.points.at(-1)!.loss).toBeLessThan(1e-4);
    expect(unstable.divergedAt).toBeDefined();
  });

  it("shows momentum and AdamW crossing a ripple that traps SGD", () => {
    const rough = { ...problem, roughness: 0.28 };
    const sgd = simulate("sgd", rough, settings);
    const momentum = simulate("momentum", rough, settings);
    const adamw = simulate("adamw", rough, settings);

    expect(sgd.points.at(-1)!.loss).toBeGreaterThan(0.2);
    expect(momentum.points.at(-1)!.loss).toBeLessThan(1e-6);
    expect(adamw.points.at(-1)!.loss).toBeLessThan(1e-6);
  });
});
