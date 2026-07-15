import type { PlainState } from "@narrable/core";
import { MAX_STEPS, sample, type OptimizerName, type Trajectory } from "./model.js";
import {
  algorithmGroupBox,
  ALGORITHM_SLIDERS,
  PROBLEM_SLIDERS,
  SERIES,
  sliderBox,
  stepBox,
  toggleBox,
  TOGGLES,
  type SliderDefinition,
  type View,
} from "./view.js";

const FOREGROUND = "#f5f7fa";
const MUTED = "#9aa3af";
const DISABLED = "#555b66";

export function drawControls(
  g: CanvasRenderingContext2D,
  view: View,
  state: Readonly<PlainState>,
  trajectories: Trajectory[],
): void {
  const unit = Math.min(view.width, view.height);
  drawAlgorithmGroups(g, view, state, trajectories, unit);
  drawToggles(g, view, state, unit);

  g.fillStyle = MUTED;
  g.font = `500 ${unit * 0.019}px sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "bottom";
  g.fillText("LANDSCAPE", view.width * 0.39, view.height * 0.13);

  for (const definition of [...PROBLEM_SLIDERS, ...ALGORITHM_SLIDERS]) {
    drawSlider(g, view, state, definition, unit);
  }

  const threshold = 2 / number(state, "sgd.lr");
  g.fillStyle = MUTED;
  g.font = `${unit * 0.017}px sans-serif`;
  g.textAlign = "left";
  g.fillText(`smooth SGD limit: κ < ${threshold.toFixed(1)}`, view.width * 0.39, view.height * 0.48);
}

export function drawStep(g: CanvasRenderingContext2D, view: View, step: number): void {
  const box = stepBox(view);
  const unit = Math.min(view.width, view.height);
  const x = box.x0 + (step / MAX_STEPS) * (box.x1 - box.x0);
  g.strokeStyle = "#343943";
  g.lineWidth = unit * 0.009;
  line(g, box.x0, box.y, box.x1, box.y);
  g.strokeStyle = FOREGROUND;
  line(g, box.x0, box.y, x, box.y);
  g.fillStyle = "#050609";
  g.strokeStyle = FOREGROUND;
  g.lineWidth = unit * 0.004;
  disc(g, x, box.y, unit * 0.015);
  g.fill();
  g.stroke();
  g.fillStyle = FOREGROUND;
  g.font = `500 ${unit * 0.021}px sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "bottom";
  g.fillText(`matched step ${Math.round(step)} / ${MAX_STEPS}`, box.x0, box.y - unit * 0.018);
}

function drawAlgorithmGroups(
  g: CanvasRenderingContext2D,
  view: View,
  state: Readonly<PlainState>,
  trajectories: Trajectory[],
  unit: number,
): void {
  const currentStep = number(state, "step");
  for (const name of ["sgd", "momentum", "adamw"] as OptimizerName[]) {
    const box = algorithmGroupBox(view, name);
    const active = state[`active.${name}`] as boolean;
    g.fillStyle = active ? SERIES[name].wash : "#0b0d11";
    g.strokeStyle = active ? SERIES[name].color : "#292d34";
    g.lineWidth = unit * 0.0025;
    g.fillRect(box.x, box.y, box.width, box.height);
    g.strokeRect(box.x, box.y, box.width, box.height);
    g.fillStyle = active ? SERIES[name].color : DISABLED;
    g.fillRect(box.x, box.y, unit * 0.007, box.height);
    g.fillStyle = active ? FOREGROUND : DISABLED;
    g.font = `500 ${unit * 0.018}px sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "top";
    g.fillText(SERIES[name].label, box.x + unit * 0.018, box.y + unit * 0.012);
    const trajectory = trajectories.find((candidate) => candidate.name === name);
    const current = trajectory && sample(trajectory, Math.min(currentStep, trajectory.points.length - 1));
    const value = trajectory?.divergedAt !== undefined && currentStep >= trajectory.divergedAt
      ? "diverged"
      : current
        ? `L ${current.loss.toExponential(1)}`
        : "off";
    g.fillStyle = active ? FOREGROUND : DISABLED;
    g.font = `${unit * 0.015}px sans-serif`;
    g.textAlign = "right";
    g.fillText(value, box.x + box.width - unit * 0.014, box.y + unit * 0.014);
  }
}

function drawToggles(g: CanvasRenderingContext2D, view: View, state: Readonly<PlainState>, unit: number): void {
  for (let index = 0; index < TOGGLES.length; index++) {
    const toggle = TOGGLES[index]!;
    const box = toggleBox(view, index);
    const active = state[toggle.param] as boolean;
    g.fillStyle = active ? SERIES[toggle.optimizer].color : "#15181e";
    g.strokeStyle = active ? SERIES[toggle.optimizer].color : "#343943";
    g.lineWidth = unit * 0.0025;
    g.fillRect(box.x, box.y, box.width, box.height);
    g.strokeRect(box.x, box.y, box.width, box.height);
    g.fillStyle = active ? "#050609" : "#6b7280";
    g.font = `500 ${unit * 0.02}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(toggle.label, box.x + box.width / 2, box.y + box.height / 2);
  }
}

function drawSlider(
  g: CanvasRenderingContext2D,
  view: View,
  state: Readonly<PlainState>,
  definition: SliderDefinition,
  unit: number,
): void {
  const box = sliderBox(view, definition);
  const value = number(state, definition.param);
  const t = (value - definition.range[0]) / (definition.range[1] - definition.range[0]);
  const knobX = box.x0 + t * (box.x1 - box.x0);
  const active = !definition.optimizer || (state[`active.${definition.optimizer}`] as boolean);
  const color = definition.optimizer ? SERIES[definition.optimizer].color : FOREGROUND;
  const liveColor = active ? color : DISABLED;

  g.strokeStyle = active ? "#343943" : "#202329";
  g.lineWidth = unit * 0.008;
  line(g, box.x0, box.y, box.x1, box.y);
  g.strokeStyle = liveColor;
  line(g, box.x0, box.y, knobX, box.y);
  g.fillStyle = "#050609";
  g.strokeStyle = liveColor;
  g.lineWidth = unit * 0.004;
  disc(g, knobX, box.y, unit * 0.014);
  g.fill();
  g.stroke();
  g.fillStyle = active ? FOREGROUND : DISABLED;
  g.font = `${unit * 0.019}px sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "bottom";
  g.fillText(definition.label, box.x0, box.y - unit * 0.017);
  g.textAlign = "right";
  g.fillText(value.toFixed(definition.digits), box.x1, box.y - unit * 0.017);
}

function number(state: Readonly<PlainState>, key: string): number {
  return state[key] as number;
}

function line(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

function disc(g: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
}
