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
  slot?: 0 | 1;
}

export const SERIES: Record<OptimizerName, { color: string; wash: string; label: string }> = {
  sgd: { color: "#ff8a1f", wash: "rgba(255, 138, 31, 0.11)", label: "SGD" },
  momentum: { color: "#55a7ff", wash: "rgba(85, 167, 255, 0.11)", label: "Momentum" },
  adamw: { color: "#43d69e", wash: "rgba(67, 214, 158, 0.11)", label: "AdamW" },
};

export const PROBLEM_SLIDERS: SliderDefinition[] = [
  { param: "kappa", label: "condition κ", range: [1, 40], digits: 0, y: 0.065, section: "problem", slot: 0 },
  { param: "roughness", label: "roughness", range: [0, 0.35], digits: 2, y: 0.065, section: "problem", slot: 1 },
];

export const ALGORITHM_SLIDERS: SliderDefinition[] = [
  { param: "sgd.lr", label: "learning rate η", range: [0.02, 0.12], digits: 3, y: 0.19, section: "algorithm", optimizer: "sgd" },
  { param: "momentum.lr", label: "learning rate η", range: [0.02, 0.25], digits: 3, y: 0.35, section: "algorithm", optimizer: "momentum" },
  { param: "momentum.beta", label: "smoothing β", range: [0, 0.95], digits: 2, y: 0.42, section: "algorithm", optimizer: "momentum" },
  { param: "adamw.lr", label: "learning rate η", range: [0.02, 0.16], digits: 3, y: 0.56, section: "algorithm", optimizer: "adamw" },
];

export const SLIDERS = [...PROBLEM_SLIDERS, ...ALGORITHM_SLIDERS];

export const TOGGLES = [
  { param: "active.sgd", label: "SGD", optimizer: "sgd" as const },
  { param: "active.momentum", label: "MOM", optimizer: "momentum" as const },
  { param: "active.adamw", label: "AdamW", optimizer: "adamw" as const },
];

export function landscapeBox(view: View) {
  const size = Math.min(view.width * 0.44, view.height * 0.74);
  return { x: view.width * 0.015, y: view.height * 0.105, width: size, height: size };
}

export function lossPlotBox(view: View) {
  return { x: view.width * 0.48, y: view.height * 0.695, width: view.width * 0.505, height: view.height * 0.075 };
}

export function sliderBox(view: View, definition: SliderDefinition) {
  const problemX = definition.slot === 0 ? [0.015, 0.215] : [0.245, 0.445];
  const [x0, x1] = definition.section === "problem" ? problemX : [0.49, 0.725];
  return { x0: view.width * x0, x1: view.width * x1, y: view.height * definition.y };
}

export function stepBox(view: View) {
  return { x0: view.width * 0.48, x1: view.width * 0.985, y: view.height * 0.815 };
}

export function toggleBox(view: View, index: number) {
  return {
    x: view.width * (0.49 + index * 0.078),
    y: view.height * 0.035,
    width: view.width * 0.068,
    height: view.height * 0.055,
  };
}

export function algorithmGroupBox(view: View, optimizer: OptimizerName) {
  const vertical = {
    sgd: [0.11, 0.14],
    momentum: [0.27, 0.19],
    adamw: [0.48, 0.14],
  }[optimizer]!;
  return { x: view.width * 0.475, y: view.height * vertical[0], width: view.width * 0.265, height: view.height * vertical[1] };
}
