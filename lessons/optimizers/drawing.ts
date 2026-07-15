import type { PlainState } from "@narrable/core";
import { drawControls, drawStep } from "./controls.js";
import {
  DOMAIN,
  MAX_STEPS,
  loss,
  sample,
  simulate,
  symmetricProblem,
  type OptimizerName,
  type OptimizerSettings,
  type Problem,
  type Trajectory,
} from "./model.js";
import { landscapeBox, lossPlotBox, SERIES, type View } from "./view.js";

const BACKGROUND = "#050609";
const FOREGROUND = "#f5f7fa";
const MUTED = "#9aa3af";
const OPTIMIZERS: OptimizerName[] = ["sgd", "momentum", "adamw"];

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
  const trajectories = OPTIMIZERS.filter((name) => state[`active.${name}`] as boolean).map((name) =>
    simulate(name, symmetricProblem(name, problem), settings),
  );
  const step = number(state, "step");

  g.clearRect(0, 0, view.width, view.height);
  g.fillStyle = BACKGROUND;
  g.fillRect(0, 0, view.width, view.height);
  g.lineJoin = "round";
  g.lineCap = "round";
  drawLandscape(g, view, state, problem, trajectories, step);
  drawLossPlot(g, view, trajectories, step);
  drawControls(g, view, state, trajectories);
  drawStep(g, view, step);
}

function drawLandscape(
  g: CanvasRenderingContext2D,
  view: View,
  state: Readonly<PlainState>,
  problem: Problem,
  trajectories: Trajectory[],
  step: number,
): void {
  const box = landscapeBox(view);
  const cells = 40;
  const cell = box.width / cells;
  const maxLoss = loss(DOMAIN, DOMAIN, problem);

  for (let row = 0; row < cells; row++) {
    for (let column = 0; column < cells; column++) {
      const x = -DOMAIN + ((column + 0.5) / cells) * DOMAIN * 2;
      const y = DOMAIN - ((row + 0.5) / cells) * DOMAIN * 2;
      const level = Math.log1p(loss(x, y, problem)) / Math.log1p(maxLoss);
      const lightness = 8 + (1 - level) ** 1.35 * 84;
      g.fillStyle = `hsl(212 58% ${lightness}%)`;
      g.fillRect(box.x + column * cell, box.y + row * cell, cell + 0.6, cell + 0.6);
    }
  }

  g.save();
  g.beginPath();
  g.rect(box.x, box.y, box.width, box.height);
  g.clip();
  drawGrid(g, box);
  for (const trajectory of trajectories) drawTrajectory(g, box, trajectory, step);
  g.restore();

  drawStartPucks(g, box, state, problem);
  g.strokeStyle = "rgba(255, 255, 255, 0.48)";
  g.lineWidth = box.width * 0.004;
  g.strokeRect(box.x, box.y, box.width, box.height);

  const unit = Math.min(view.width, view.height);
  const origin = screenPoint(box, 0, 0);
  g.fillStyle = FOREGROUND;
  g.font = `500 ${unit * 0.025}px sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "bottom";
  g.fillText("mirrored starts · equivalent loss", box.x, box.y - unit * 0.011);
  g.fillStyle = MUTED;
  g.font = `${unit * 0.019}px sans-serif`;
  g.fillText("w₁", box.x + box.width + unit * 0.007, origin.y);
  g.fillText("w₂", origin.x + unit * 0.007, box.y + unit * 0.022);
}

function drawGrid(g: CanvasRenderingContext2D, box: ReturnType<typeof landscapeBox>): void {
  g.strokeStyle = "rgba(255, 255, 255, 0.1)";
  g.lineWidth = box.width * 0.002;
  for (let index = 0; index <= 16; index++) {
    const value = -DOMAIN + (index / 16) * DOMAIN * 2;
    const point = screenPoint(box, value, value);
    line(g, point.x, box.y, point.x, box.y + box.height);
    line(g, box.x, point.y, box.x + box.width, point.y);
  }
  const origin = screenPoint(box, 0, 0);
  g.strokeStyle = "rgba(255, 255, 255, 0.48)";
  g.lineWidth = box.width * 0.004;
  line(g, box.x, origin.y, box.x + box.width, origin.y);
  line(g, origin.x, box.y, origin.x, box.y + box.height);
}

function drawStartPucks(
  g: CanvasRenderingContext2D,
  box: ReturnType<typeof landscapeBox>,
  state: Readonly<PlainState>,
  problem: Problem,
): void {
  for (const name of OPTIMIZERS) {
    const start = symmetricProblem(name, problem);
    const point = screenPoint(box, start.startX, start.startY);
    const active = state[`active.${name}`] as boolean;
    g.fillStyle = active ? FOREGROUND : "#171a20";
    g.strokeStyle = active ? SERIES[name].color : "#505660";
    g.lineWidth = box.width * 0.011;
    disc(g, point.x, point.y, box.width * 0.026);
    g.fill();
    g.stroke();
  }
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
  drawMarker(g, trajectory.name, head.x, head.y, box.width * 0.024);
  if (trajectory.divergedAt !== undefined && step >= trajectory.divergedAt) {
    g.fillStyle = FOREGROUND;
    g.font = `500 ${box.width * 0.065}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("×", head.x, head.y);
  }
}

function drawLossPlot(g: CanvasRenderingContext2D, view: View, trajectories: Trajectory[], step: number): void {
  const box = lossPlotBox(view);
  const unit = Math.min(view.width, view.height);
  const left = box.x + unit * 0.038;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height - unit * 0.018;
  const losses = trajectories.flatMap((trajectory) => trajectory.points.map((point) => point.loss));
  const logTop = Math.max(1, Math.ceil(Math.log10(Math.max(1, ...losses))));
  const logBottom = -5;
  const xAt = (value: number) => left + (value / MAX_STEPS) * (right - left);
  const yAt = (value: number) => {
    const log = clamp(Math.log10(Math.max(value, 10 ** logBottom)), logBottom, logTop);
    return bottom - ((log - logBottom) / (logTop - logBottom)) * (bottom - top);
  };

  g.strokeStyle = "#292e37";
  g.lineWidth = unit * 0.002;
  for (let exponent = logBottom; exponent <= logTop; exponent++) line(g, left, yAt(10 ** exponent), right, yAt(10 ** exponent));
  line(g, left, top, left, bottom);

  for (const trajectory of trajectories) {
    const count = Math.min(Math.floor(step), trajectory.points.length - 1);
    g.beginPath();
    g.moveTo(xAt(0), yAt(trajectory.points[0]!.loss));
    for (let index = 1; index <= count; index++) g.lineTo(xAt(index), yAt(trajectory.points[index]!.loss));
    g.strokeStyle = SERIES[trajectory.name].color;
    g.lineWidth = unit * 0.005;
    g.stroke();
  }

  g.strokeStyle = FOREGROUND;
  g.lineWidth = unit * 0.0025;
  line(g, xAt(step), top, xAt(step), bottom);
  g.fillStyle = MUTED;
  g.font = `${unit * 0.018}px sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "bottom";
  g.fillText("loss · log scale", box.x, box.y - unit * 0.008);
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
