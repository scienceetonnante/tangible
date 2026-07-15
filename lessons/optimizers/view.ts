import type { OptimizerName } from "./model.js";

export interface View {
  width: number;
  height: number;
}

export interface SliderDefinition {
  param: string;
  label: string;
  range: [number, number];
  digits: number;
  y: number;
  section: "problem" | "algorithm";
  optimizer?: OptimizerName;
}

export const SERIES: Record<OptimizerName, { color: string; wash: string; label: string }> = {
  sgd: { color: "#ff8a1f", wash: "rgba(255, 138, 31, 0.11)", label: "SGD" },
  momentum: { color: "#55a7ff", wash: "rgba(85, 167, 255, 0.11)", label: "Momentum" },
  adamw: { color: "#43d69e", wash: "rgba(67, 214, 158, 0.11)", label: "AdamW" },
};

export const PROBLEM_SLIDERS: SliderDefinition[] = [
  { param: "kappa", label: "condition κ", range: [1, 40], digits: 0, y: 0.23, section: "problem" },
  { param: "roughness", label: "roughness", range: [0, 0.35], digits: 2, y: 0.39, section: "problem" },
];

export const ALGORITHM_SLIDERS: SliderDefinition[] = [
  { param: "sgd.lr", label: "learning rate η", range: [0.02, 0.12], digits: 3, y: 0.25, section: "algorithm", optimizer: "sgd" },
  { param: "momentum.lr", label: "learning rate η", range: [0.02, 0.25], digits: 3, y: 0.43, section: "algorithm", optimizer: "momentum" },
  { param: "momentum.beta", label: "smoothing β", range: [0, 0.95], digits: 2, y: 0.53, section: "algorithm", optimizer: "momentum" },
  { param: "adamw.lr", label: "learning rate η", range: [0.02, 0.16], digits: 3, y: 0.69, section: "algorithm", optimizer: "adamw" },
];

export const SLIDERS = [...PROBLEM_SLIDERS, ...ALGORITHM_SLIDERS];

export const TOGGLES = [
  { param: "active.sgd", label: "SGD", optimizer: "sgd" as const },
  { param: "active.momentum", label: "MOM", optimizer: "momentum" as const },
  { param: "active.adamw", label: "AdamW", optimizer: "adamw" as const },
];

export function landscapeBox(view: View) {
  const size = Math.min(view.width * 0.5, view.height * 0.6);
  return { x: view.width * 0.025, y: view.height * 0.055, width: size, height: size };
}

export function lossPlotBox(view: View) {
  return { x: view.width * 0.025, y: view.height * 0.75, width: view.width * 0.475, height: view.height * 0.07 };
}

export function sliderBox(view: View, definition: SliderDefinition) {
  const [x0, x1] = definition.section === "problem" ? [0.39, 0.5] : [0.545, 0.69];
  return { x0: view.width * x0, x1: view.width * x1, y: view.height * definition.y };
}

export function stepBox(view: View) {
  const landscape = landscapeBox(view);
  return { x0: landscape.x, x1: landscape.x + landscape.width, y: view.height * 0.69 };
}

export function toggleBox(view: View, index: number) {
  return {
    x: view.width * (0.54 + index * 0.055),
    y: view.height * 0.075,
    width: view.width * 0.049,
    height: view.height * 0.062,
  };
}

export function algorithmGroupBox(view: View, optimizer: OptimizerName) {
  const vertical = {
    sgd: [0.18, 0.13],
    momentum: [0.35, 0.23],
    adamw: [0.62, 0.14],
  }[optimizer]!;
  return { x: view.width * 0.525, y: view.height * vertical[0], width: view.width * 0.18, height: view.height * vertical[1] };
}
