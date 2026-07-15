import type { PlainState } from "@narrable/core";
import {
  DOMAIN,
  MAX_STEPS,
  loss,
  sample,
  simulate,
  type OptimizerName,
  type OptimizerSettings,
  type Problem,
  type Trajectory,
} from "./model.js";
import { landscapeBox, lossPlotBox, sliderBox, SLIDERS, stepBox, toggleBox, TOGGLES, type View } from "./view.js";

const SERIES: Record<OptimizerName, { color: string; label: string }> = {
  sgd: { color: "#d95f02", label: "SGD" },
  momentum: { color: "#2563a6", label: "Momentum" },
  adamw: { color: "#16825d", label: "AdamW" },
};

export function draw(g: CanvasRenderingContext2D, view: View, state: Readonly<PlainState>): void {
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
  const trajectories = (["sgd", "momentum", "adamw"] as OptimizerName[])
    .filter((name) => state[`active.${name}`] as boolean)
    .map((name) => simulate(name, problem, settings));
  const step = number(state, "step");

  g.clearRect(0, 0, view.width, view.height);
  g.lineJoin = "round";
  g.lineCap = "round";
  drawLandscape(g, view, problem, trajectories, step);
  drawLossPlot(g, view, trajectories, step);
  drawControls(g, view, state, trajectories);
  drawStep(g, view, step);
}

function drawLandscape(
  g: CanvasRenderingContext2D,
  view: View,
  problem: Problem,
  trajectories: Trajectory[],
  step: number,
): void {
  const box = landscapeBox(view);
  const cells = 30;
  const cell = box.width / cells;
  const maxLoss = loss(DOMAIN, DOMAIN, problem);

  for (let row = 0; row < cells; row++) {
    for (let column = 0; column < cells; column++) {
      const x = -DOMAIN + ((column + 0.5) / cells) * DOMAIN * 2;
      const y = DOMAIN - ((row + 0.5) / cells) * DOMAIN * 2;
      const level = Math.log1p(loss(x, y, problem)) / Math.log1p(maxLoss);
      g.fillStyle = `hsl(211 42% ${97 - level * 38}%)`;
      g.fillRect(box.x + column * cell, box.y + row * cell, cell + 1, cell + 1);
    }
  }

  g.save();
  g.beginPath();
  g.rect(box.x, box.y, box.width, box.height);
  g.clip();

  const origin = screenPoint(box, 0, 0);
  g.strokeStyle = "rgba(31, 41, 55, 0.28)";
  g.lineWidth = box.width * 0.004;
  line(g, box.x, origin.y, box.x + box.width, origin.y);
  line(g, origin.x, box.y, origin.x, box.y + box.height);

  for (const trajectory of trajectories) drawTrajectory(g, box, trajectory, step);
  g.restore();

  const start = screenPoint(box, problem.startX, problem.startY);
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#111827";
  g.lineWidth = box.width * 0.012;
  disc(g, start.x, start.y, box.width * 0.027);
  g.fill();
  g.stroke();

  const unit = Math.min(view.width, view.height);
  g.fillStyle = "#374151";
  g.font = `500 ${unit * 0.027}px sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "bottom";
  g.fillText("same start · same landscape", box.x, box.y - unit * 0.012);
  g.font = `${unit * 0.022}px sans-serif`;
  g.fillText("w₁", box.x + box.width + unit * 0.008, origin.y);
  g.fillText("w₂", origin.x + unit * 0.008, box.y + unit * 0.025);
}

function drawTrajectory(
  g: CanvasRenderingContext2D,
  box: ReturnType<typeof landscapeBox>,
  trajectory: Trajectory,
  step: number,
): void {
  const shownStep = Math.min(step, trajectory.points.length - 1);
  const wholeSteps = Math.floor(shownStep);
  const first = screenPoint(box, trajectory.points[0]!.x, trajectory.points[0]!.y);
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (let index = 1; index <= wholeSteps; index++) {
    const point = trajectory.points[index]!;
    const screen = screenPoint(box, point.x, point.y);
    g.lineTo(screen.x, screen.y);
  }
  if (shownStep > wholeSteps) {
    const point = sample(trajectory, shownStep);
    const screen = screenPoint(box, point.x, point.y);
    g.lineTo(screen.x, screen.y);
  }
  g.strokeStyle = SERIES[trajectory.name].color;
  g.lineWidth = box.width * 0.014;
  g.stroke();

  const current = sample(trajectory, shownStep);
  const head = screenPoint(box, clamp(current.x, -DOMAIN, DOMAIN), clamp(current.y, -DOMAIN, DOMAIN));
  drawMarker(g, trajectory.name, head.x, head.y, box.width * 0.026);
  if (trajectory.divergedAt !== undefined && step >= trajectory.divergedAt) {
    g.fillStyle = SERIES[trajectory.name].color;
    g.font = `700 ${box.width * 0.07}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("×", head.x, head.y);
  }
}

function drawLossPlot(g: CanvasRenderingContext2D, view: View, trajectories: Trajectory[], step: number): void {
  const box = lossPlotBox(view);
  const unit = Math.min(view.width, view.height);
  const left = box.x + unit * 0.04;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height - unit * 0.025;
  const losses = trajectories.flatMap((trajectory) => trajectory.points.map((point) => point.loss));
  const logTop = Math.max(1, Math.ceil(Math.log10(Math.max(1, ...losses))));
  const logBottom = -5;
  const xAt = (value: number) => left + (value / MAX_STEPS) * (right - left);
  const yAt = (value: number) => {
    const log = clamp(Math.log10(Math.max(value, 10 ** logBottom)), logBottom, logTop);
    return bottom - ((log - logBottom) / (logTop - logBottom)) * (bottom - top);
  };

  g.strokeStyle = "#c7cdd4";
  g.lineWidth = unit * 0.0025;
  for (let exponent = logBottom; exponent <= logTop; exponent++) {
    const y = yAt(10 ** exponent);
    line(g, left, y, right, y);
  }
  line(g, left, top, left, bottom);

  for (const trajectory of trajectories) {
    const count = Math.min(Math.floor(step), trajectory.points.length - 1);
    g.beginPath();
    g.moveTo(xAt(0), yAt(trajectory.points[0]!.loss));
    for (let index = 1; index <= count; index++) g.lineTo(xAt(index), yAt(trajectory.points[index]!.loss));
    g.strokeStyle = SERIES[trajectory.name].color;
    g.lineWidth = unit * 0.006;
    g.stroke();
  }

  g.strokeStyle = "#4b5563";
  g.lineWidth = unit * 0.003;
  line(g, xAt(step), top, xAt(step), bottom);
  g.fillStyle = "#4b5563";
  g.font = `${unit * 0.021}px sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "bottom";
  g.fillText("loss (log scale)", box.x, box.y - unit * 0.01);
}

function drawControls(g: CanvasRenderingContext2D, view: View, state: Readonly<PlainState>, trajectories: Trajectory[]): void {
  const unit = Math.min(view.width, view.height);
  for (let index = 0; index < TOGGLES.length; index++) {
    const toggle = TOGGLES[index]!;
    const box = toggleBox(view, index);
    const name = toggle.param.replace("active.", "") as OptimizerName;
    const active = state[toggle.param] as boolean;
    g.fillStyle = active ? SERIES[name].color : "#e5e7eb";
    g.fillRect(box.x, box.y, box.width, box.height);
    g.fillStyle = active ? "#ffffff" : "#4b5563";
    g.font = `500 ${unit * 0.021}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(toggle.label, box.x + box.width / 2, box.y + box.height / 2);
  }

  for (const definition of SLIDERS) {
    const box = sliderBox(view, definition);
    const value = number(state, definition.param);
    const t = (value - definition.range[0]) / (definition.range[1] - definition.range[0]);
    const knobX = box.x0 + t * (box.x1 - box.x0);
    g.strokeStyle = "#d1d5db";
    g.lineWidth = unit * 0.009;
    line(g, box.x0, box.y, box.x1, box.y);
    g.strokeStyle = "#4b5563";
    line(g, box.x0, box.y, knobX, box.y);
    g.fillStyle = "#ffffff";
    g.strokeStyle = "#374151";
    g.lineWidth = unit * 0.004;
    disc(g, knobX, box.y, unit * 0.015);
    g.fill();
    g.stroke();
    g.fillStyle = "#374151";
    g.font = `${unit * 0.022}px sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "bottom";
    g.fillText(definition.label, box.x0, box.y - unit * 0.019);
    g.textAlign = "right";
    g.fillText(value.toFixed(definition.digits), box.x1, box.y - unit * 0.019);
  }

  const threshold = 2 / number(state, "sgd.lr");
  g.fillStyle = "#6b7280";
  g.font = `${unit * 0.018}px sans-serif`;
  g.textAlign = "left";
  g.fillText(`smooth-bowl SGD limit: κ < ${threshold.toFixed(1)}`, view.width * 0.53, view.height * 0.405);

  const currentStep = number(state, "step");
  let readoutY = view.height * 0.805;
  for (const trajectory of trajectories) {
    const current = sample(trajectory, Math.min(currentStep, trajectory.points.length - 1));
    g.fillStyle = SERIES[trajectory.name].color;
    g.font = `500 ${unit * 0.019}px sans-serif`;
    g.textAlign = "right";
    const value = trajectory.divergedAt !== undefined && currentStep >= trajectory.divergedAt ? "diverged" : `L ${current.loss.toExponential(1)}`;
    g.fillText(`${SERIES[trajectory.name].label}: ${value}`, view.width * 0.69, readoutY);
    readoutY += unit * 0.021;
  }
}

function drawStep(g: CanvasRenderingContext2D, view: View, step: number): void {
  const box = stepBox(view);
  const unit = Math.min(view.width, view.height);
  const x = box.x0 + (step / MAX_STEPS) * (box.x1 - box.x0);
  g.strokeStyle = "#c7cdd4";
  g.lineWidth = unit * 0.01;
  line(g, box.x0, box.y, box.x1, box.y);
  g.strokeStyle = "#111827";
  line(g, box.x0, box.y, x, box.y);
  g.fillStyle = "#111827";
  disc(g, x, box.y, unit * 0.016);
  g.fill();
  g.fillStyle = "#374151";
  g.font = `500 ${unit * 0.022}px sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "bottom";
  g.fillText(`matched step ${Math.round(step)} / ${MAX_STEPS}`, box.x0, box.y - unit * 0.02);
}

function drawMarker(g: CanvasRenderingContext2D, name: OptimizerName, x: number, y: number, radius: number): void {
  g.fillStyle = SERIES[name].color;
  g.beginPath();
  if (name === "sgd") g.arc(x, y, radius, 0, Math.PI * 2);
  else if (name === "momentum") g.rect(x - radius, y - radius, radius * 2, radius * 2);
  else {
    g.moveTo(x, y - radius * 1.3);
    g.lineTo(x + radius * 1.3, y);
    g.lineTo(x, y + radius * 1.3);
    g.lineTo(x - radius * 1.3, y);
    g.closePath();
  }
  g.fill();
}

function screenPoint(box: ReturnType<typeof landscapeBox>, x: number, y: number) {
  return { x: box.x + ((x + DOMAIN) / (DOMAIN * 2)) * box.width, y: box.y + ((DOMAIN - y) / (DOMAIN * 2)) * box.height };
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

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}
