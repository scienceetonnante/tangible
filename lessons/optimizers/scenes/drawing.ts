import type { OrbitState, PlainState } from "@tangible/core";
import type { ParameterActivityMap } from "@tangible/player";
import { drawControls, drawStep } from "./controls.js";
import type { OptimizerFrame } from "./frame.js";
import { MAX_STEPS, type Trajectory } from "./model.js";
import { cssPixels, cssWidth, landscapeBox, lossPlotBox, SERIES, type View } from "./view.js";

const BACKGROUND = "#050609";
const FOREGROUND = "#f5f7fa";
const CAMERA_READOUT = "#b8bec8";
const CAMERA_READOUT_BOTTOM_INSET = 76;

export function draw(
  g: CanvasRenderingContext2D,
  view: View,
  state: Readonly<PlainState>,
  frame: OptimizerFrame,
  activity: ParameterActivityMap,
): void {
  g.clearRect(0, 0, view.width, view.height);
  g.fillStyle = BACKGROUND;
  g.fillRect(0, 0, view.width, view.height);
  g.lineJoin = "round";
  g.lineCap = "round";
  drawLossPlot(g, view, frame.trajectories, frame.step);
  drawControls(g, view, state, activity);
  drawStep(g, view, frame.step, activity);
  drawCameraReadout(g, view, state);
}

function drawCameraReadout(g: CanvasRenderingContext2D, view: View, state: Readonly<PlainState>): void {
  const camera = state.camera as OrbitState;
  const unit = Math.min(view.width, view.height);
  const target = camera.target.map(formatCameraValue).join(",");

  g.fillStyle = CAMERA_READOUT;
  g.font = `${Math.max(cssPixels(view, 10), unit * 0.013)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  g.textAlign = "left";
  g.textBaseline = "middle";
  const y = view.height - cssPixels(view, CAMERA_READOUT_BOTTOM_INSET);
  const landscape = landscapeBox(view);
  if (cssWidth(view) < 900) {
    g.fillText("drag to orbit · scroll to zoom", landscape.x, y);
    return;
  }
  g.fillText(
    `[${target}] · d=${formatCameraValue(camera.distance)} · ` +
      `az. ${formatAngle(camera.azimuth)}° · el. ${formatAngle(camera.elevation)}°`,
    view.width * 0.015,
    y,
  );
  g.textAlign = "right";
  g.fillText("drag to orbit · scroll to zoom", landscape.x + landscape.width, y);
}

function formatCameraValue(value: number): string {
  return (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function formatAngle(radians: number): string {
  const degrees = Math.round(toDegrees(radians));
  return String(Object.is(degrees, -0) ? 0 : degrees);
}

function drawLossPlot(g: CanvasRenderingContext2D, view: View, trajectories: Trajectory[], step: number): void {
  const box = lossPlotBox(view);
  const unit = Math.min(view.width, view.height);
  const left = box.x;
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

  g.strokeStyle = "#454c58";
  g.lineWidth = unit * 0.0015;
  for (let gridStep = 5; gridStep <= MAX_STEPS; gridStep += 5) {
    line(g, xAt(gridStep), top, xAt(gridStep), bottom);
  }

  g.save();
  g.translate(left - unit * 0.012, (top + bottom) / 2);
  g.rotate(-Math.PI / 2);
  g.fillStyle = CAMERA_READOUT;
  g.font = `${Math.max(cssPixels(view, 10), unit * 0.014)}px sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "bottom";
  g.fillText("Loss", 0, 0);
  g.restore();

  for (const trajectory of trajectories) {
    const count = Math.min(Math.floor(step), trajectory.points.length - 1);
    g.beginPath();
    g.moveTo(xAt(0), yAt(trajectory.points[0]!.loss));
    for (let index = 1; index <= count; index++) g.lineTo(xAt(index), yAt(trajectory.points[index]!.loss));
    g.strokeStyle = SERIES[trajectory.name].color;
    g.lineWidth = unit * 0.005;
    g.setLineDash(SERIES[trajectory.name].dash.map((length) => length * unit));
    g.stroke();
  }

  g.setLineDash([]);
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
