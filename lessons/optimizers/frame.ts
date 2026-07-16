import type { PlainState } from "@narrable/core";
import {
  simulate,
  symmetricProblem,
  type OptimizerName,
  type OptimizerSettings,
  type Problem,
  type Trajectory,
} from "./model.js";

const OPTIMIZERS: OptimizerName[] = ["sgd", "momentum", "adamw"];

export interface OptimizerFrame {
  problem: Problem;
  trajectories: Trajectory[];
  step: number;
}

/** Compute the shared state consumed by the 2D readouts and 3D viewport. */
export function buildFrame(state: Readonly<PlainState>): OptimizerFrame {
  const problem: Problem = {
    kappa: number(state, "kappa"),
    roughness: number(state, "roughness"),
    startX: number(state, "start.x"),
    startY: number(state, "start.y"),
  };
  const settings: OptimizerSettings = {
    sgdLr: number(state, "sgd.lr"),
    momentumLr: number(state, "momentum.lr"),
    momentumBeta: number(state, "momentum.beta"),
    adamwLr: number(state, "adamw.lr"),
  };
  const trajectories = OPTIMIZERS.filter((name) => state[`active.${name}`] as boolean).map((name) =>
    simulate(name, symmetricProblem(name, problem), settings),
  );
  return { problem, trajectories, step: number(state, "step") };
}

function number(state: Readonly<PlainState>, key: string): number {
  return state[key] as number;
}
