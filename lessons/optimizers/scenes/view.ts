import type { OptimizerName } from "./model.js";

export interface View {
  width: number;
  height: number;
  pixelRatio?: number;
}

export interface SliderDefinition {
  param: string;
  label: string;
  range: [number, number];
  digits: number;
  y: number;
  compactY?: number;
  section: "problem" | "algorithm";
  optimizer?: OptimizerName;
  slot?: 0 | 1;
}

export const SERIES: Record<OptimizerName, { color: string; wash: string; label: string; dash: number[] }> = {
  sgd: { color: "#ff8a1f", wash: "rgba(255, 138, 31, 0.11)", label: "SGD", dash: [] },
  momentum: { color: "#55a7ff", wash: "rgba(85, 167, 255, 0.11)", label: "Momentum", dash: [0.014, 0.009] },
  adamw: { color: "#43d69e", wash: "rgba(67, 214, 158, 0.11)", label: "AdamW", dash: [0.003, 0.008] },
};

export const PROBLEM_SLIDERS: SliderDefinition[] = [
  { param: "kappa", label: "condition κ", range: [1, 40], digits: 0, y: 0.065, section: "problem", slot: 0 },
  { param: "roughness", label: "roughness", range: [0, 0.5], digits: 2, y: 0.065, section: "problem", slot: 1 },
];

export const ALGORITHM_SLIDERS: SliderDefinition[] = [
  { param: "sgd.lr", label: "learning rate η", range: [0.02, 0.12], digits: 3, y: 0.19, compactY: 0.225, section: "algorithm", optimizer: "sgd" },
  { param: "momentum.lr", label: "learning rate η", range: [0.02, 0.25], digits: 3, y: 0.33, compactY: 0.37, section: "algorithm", optimizer: "momentum" },
  { param: "momentum.beta", label: "smoothing β", range: [0, 0.95], digits: 2, y: 0.43, compactY: 0.507, section: "algorithm", optimizer: "momentum" },
  { param: "adamw.lr", label: "learning rate η", range: [0.02, 0.16], digits: 3, y: 0.56, compactY: 0.65, section: "algorithm", optimizer: "adamw" },
];

export const SLIDERS = [...PROBLEM_SLIDERS, ...ALGORITHM_SLIDERS];

export const TOGGLES = [
  { param: "active.sgd", label: "SGD", optimizer: "sgd" as const },
  { param: "active.momentum", label: "MOM", optimizer: "momentum" as const },
  { param: "active.adamw", label: "AdamW", optimizer: "adamw" as const },
];

const ALGORITHM_X = 0.56;
const ALGORITHM_WIDTH = 0.2;

export function landscapeBox(view: View) {
  const height = Math.min(view.width * 0.44, view.height * 0.74);
  const width = Math.min(height * 1.3, view.width * 0.545);
  return { x: view.width * 0.015, y: view.height * 0.105, width, height };
}

export function lossPlotBox(view: View) {
  return { x: view.width * 0.57, y: view.height * 0.685, width: view.width * 0.415, height: view.height * 0.115 };
}

export function sliderBox(view: View, definition: SliderDefinition) {
  const problemX = definition.slot === 0 ? [0.015, 0.215] : [0.245, 0.445];
  const [x0, x1] = definition.section === "problem" ? problemX : [0.568, 0.756];
  const y = isCompactHeight(view) ? (definition.compactY ?? definition.y) : definition.y;
  return { x0: view.width * x0, x1: view.width * x1, y: view.height * y };
}

export function stepBox(view: View) {
  const plot = lossPlotBox(view);
  return { x0: plot.x, x1: plot.x + plot.width, y: view.height * 0.825 };
}

export function toggleBox(view: View, index: number) {
  return {
    x: view.width * (0.568 + index * 0.0624),
    y: view.height * 0.035,
    width: view.width * 0.0544,
    height: view.height * 0.055,
  };
}

export function algorithmGroupBox(view: View, optimizer: OptimizerName) {
  const vertical = (isCompactHeight(view)
    ? {
        sgd: [0.115, 0.14],
        momentum: [0.265, 0.27],
        adamw: [0.545, 0.13],
      }
    : {
        sgd: [0.115, 0.13],
        momentum: [0.265, 0.21],
        adamw: [0.49, 0.125],
      })[optimizer]!;
  return {
    x: view.width * ALGORITHM_X,
    y: view.height * vertical[0],
    width: view.width * ALGORITHM_WIDTH,
    height: view.height * vertical[1],
  };
}

export function cssPixels(view: View, value: number): number {
  return value * (view.pixelRatio ?? 1);
}

export function cssWidth(view: View): number {
  return view.width / (view.pixelRatio ?? 1);
}

function isCompactHeight(view: View): boolean {
  return view.height / (view.pixelRatio ?? 1) < 440;
}
