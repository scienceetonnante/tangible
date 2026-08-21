import type { PlainState } from "@narrable/core";
import { drawControls, drawStep } from "./controls.js";
import type { OptimizerFrame } from "./frame.js";
import { MAX_STEPS, type Trajectory } from "./model.js";
import { landscapeBox, lossPlotBox, SERIES, type View } from "./view.js";

const BACKGROUND = "#050609";
const FOREGROUND = "#f5f7fa";
const MUTED = "#9aa3af";

export function draw(g: CanvasRenderingContext2D, view: View, state: Readonly<PlainState>, frame: OptimizerFrame): void {
  g.clearRect(0, 0, view.width, view.height);
  g.fillStyle = BACKGROUND;
  g.fillRect(0, 0, view.width, view.height);
  g.lineJoin = "round";
  g.lineCap = "round";
  drawLandscapeLabels(g, view);
  drawLossPlot(g, view, frame.trajectories, frame.step);
  drawControls(g, view, state, frame.trajectories);
  drawStep(g, view, frame.step);
}

function drawLandscapeLabels(g: CanvasRenderingContext2D, view: View): void {
  const box = landscapeBox(view);
  const unit = Math.min(view.width, view.height);
  g.fillStyle = MUTED;
  g.font = `${unit * 0.019}px sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "bottom";
  g.fillText("drag to orbit · scroll to zoom", box.x, box.y - unit * 0.014);
}

function drawLossPlot(g: CanvasRenderingContext2D, view: View, trajectories: Trajectory[], step: number): void {
  const box = lossPlotBox(view);
  const unit = Math.min(view.width, view.height);
  const left = box.x + unit * 0.038;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height;
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
}

function line(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}
