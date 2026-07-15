import { describe, expect, it } from "vitest";
import { forward, gradients } from "./scene.js";

const INITIAL = {
  w11: 0.5,
  w12: -0.4,
  w21: -0.3,
  w22: 0.8,
  wo1: 0.6,
  wo2: -0.5,
};

const WEIGHTS = Object.keys(INITIAL) as (keyof typeof INITIAL)[];

describe("backpropagation maths", () => {
  it("matches the known initial forward pass", () => {
    const result = forward(INITIAL);
    expect(result.yhat).toBeCloseTo(0.1249535702, 9);
    expect(result.loss).toBeCloseTo(0.3828531272, 9);
  });

  it("matches numerical gradients", () => {
    const analytic = gradients(INITIAL);
    const epsilon = 1e-6;

    for (const weight of WEIGHTS) {
      const plus = { ...INITIAL, [weight]: INITIAL[weight] + epsilon };
      const minus = { ...INITIAL, [weight]: INITIAL[weight] - epsilon };
      const numerical = (forward(plus).loss - forward(minus).loss) / (2 * epsilon);
      expect(analytic[weight]).toBeCloseTo(numerical, 6);
    }
  });

  it("converges through the three scripted descent steps", () => {
    const weights = { ...INITIAL };
    const losses: number[] = [];

    for (let step = 0; step < 3; step++) {
      const grad = gradients(weights);
      for (const weight of WEIGHTS) weights[weight] -= 0.5 * grad[weight]!;
      losses.push(forward(weights).loss);
    }

    expect(losses[0]).toBeCloseTo(0.141508, 5);
    expect(losses[1]).toBeCloseTo(0.039595, 5);
    expect(losses[2]).toBeCloseTo(0.007681, 5);
  });
});
