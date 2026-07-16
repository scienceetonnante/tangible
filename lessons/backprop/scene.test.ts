import { describe, expect, it } from "vitest";
import { bakers, forward, gradients, schema } from "./scene.js";

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
  it("returns every learner-controlled value to the narration", () => {
    for (const parameter of [...WEIGHTS, "lr"]) expect(schema[parameter]!.ownership).toBe("script");
  });

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

  it("the descent baker matches the previous authored targets and losses", () => {
    const steps = bakers.descent!.run({ ...INITIAL, lr: 0.5 }, { steps: 3 });
    const targets = [
      [0.74, -0.28, -0.517, 0.692, 0.727, -0.456],
      [0.878, -0.211, -0.635, 0.633, 0.87, -0.501],
      [0.949, -0.176, -0.698, 0.601, 0.962, -0.545],
    ];

    for (let i = 0; i < steps.length; i++) {
      expect(WEIGHTS.map((weight) => steps[i]![weight] as number)).toEqual(
        targets[i]!.map((target) => expect.closeTo(target, 3)),
      );
    }

    const losses = steps.map((step) =>
      forward(Object.fromEntries(WEIGHTS.map((weight) => [weight, step[weight] as number]))).loss,
    );

    expect(losses[0]).toBeCloseTo(0.141508, 5);
    expect(losses[1]).toBeCloseTo(0.039595, 5);
    expect(losses[2]).toBeCloseTo(0.007681, 5);
  });
});
