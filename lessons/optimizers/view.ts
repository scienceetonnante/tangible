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
}

export const SLIDERS: SliderDefinition[] = [
  { param: "kappa", label: "condition κ", range: [1, 40], digits: 0, y: 0.24 },
  { param: "roughness", label: "roughness", range: [0, 0.35], digits: 2, y: 0.34 },
  { param: "sgd.lr", label: "SGD · η", range: [0.02, 0.12], digits: 3, y: 0.48 },
  { param: "momentum.lr", label: "Momentum · η", range: [0.02, 0.25], digits: 3, y: 0.58 },
  { param: "momentum.beta", label: "Momentum · β", range: [0, 0.95], digits: 2, y: 0.68 },
  { param: "adamw.lr", label: "AdamW · η", range: [0.02, 0.16], digits: 3, y: 0.76 },
];

export const TOGGLES = [
  { param: "active.sgd", label: "SGD" },
  { param: "active.momentum", label: "MOM" },
  { param: "active.adamw", label: "AdamW" },
];

export function landscapeBox(view: View) {
  const size = Math.min(view.width * 0.46, view.height * 0.5);
  return { x: view.width * 0.04, y: view.height * 0.07, width: size, height: size };
}

export function lossPlotBox(view: View) {
  return { x: view.width * 0.04, y: view.height * 0.68, width: view.width * 0.46, height: view.height * 0.15 };
}

export function sliderBox(view: View, definition: SliderDefinition) {
  return { x0: view.width * 0.53, x1: view.width * 0.69, y: view.height * definition.y };
}

export function stepBox(view: View) {
  return { x0: view.width * 0.04, x1: view.width * 0.5, y: view.height * 0.61 };
}

export function toggleBox(view: View, index: number) {
  return {
    x: view.width * (0.53 + index * 0.058),
    y: view.height * 0.1,
    width: view.width * 0.052,
    height: view.height * 0.065,
  };
}
