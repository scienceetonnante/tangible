// Unit-circle scene: a 2D canvas drawing of a point on the unit circle, its angle
// theta, and its projection (cosine) onto the horizontal axis. Renders as a pure
// function of state.

import type { Schema, ParamValue, PlainState, Handle } from "@xv/core";
import type { SceneModule, SceneInstance, SceneContext } from "@xv/player";

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["circle"] }, default: "circle", interpolate: "snap", ownership: "script" },
  theta: {
    type: { kind: "scalar", range: [0, 6.2832] },
    default: 0,
    interpolate: "lerp",
    ownership: "script",
    label: "angle of the point on the circle",
  },
  camera: {
    type: { kind: "orbit" },
    default: { target: [0, 0, 0], distance: 5, azimuth: 0, elevation: 0 },
    interpolate: "orbit",
    ownership: "viewer",
  },
  "show.thetaLabel": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
  "show.projection": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
  "show.cosLabel": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
};

export const presets: Record<string, Record<string, ParamValue>> = {
  sideView: { camera: { target: [0, 0, 0], distance: 5, azimuth: Math.PI / 2, elevation: 0 } },
};

export const constants: Record<string, number | number[]> = {
  HALF_PI: 1.5708,
  TWO_PI: 6.2832,
};

/** Pure geometry: point on the unit circle for angle theta (math convention, y up). */
export function pointOnCircle(theta: number): { x: number; y: number } {
  return { x: Math.cos(theta), y: Math.sin(theta) };
}

export const scene: SceneModule = {
  schema,
  presets,
  constants,
  create(ctx: SceneContext): SceneInstance {
    const c2d = ctx.canvas.getContext("2d")!;
    return {
      render(state: Readonly<PlainState>) {
        draw(c2d, ctx.viewport(), state);
      },
      handles: () => [pointHandle(ctx.viewport)],
      dispose: () => {},
    };
  },
};

/** Drag the red point around the circle → set theta = atan2. */
function pointHandle(viewport: () => { width: number; height: number }): Handle {
  const geom = () => {
    const { width: w, height: h } = viewport();
    return { cx: w / 2, cy: h / 2, R: Math.min(w, h) * 0.4 };
  };
  return {
    id: "point",
    params: ["theta"],
    hitTest(px, py, state) {
      const { cx, cy, R } = geom();
      const th = state.theta as number;
      return Math.hypot(px - (cx + Math.cos(th) * R), py - (cy - Math.sin(th) * R)) < 18;
    },
    onDrag(px, py) {
      const { cx, cy } = geom();
      let a = Math.atan2(cy - py, px - cx); // screen y is down
      if (a < 0) a += Math.PI * 2;
      return { theta: a };
    },
  };
}

function draw(g: CanvasRenderingContext2D, view: { width: number; height: number }, state: Readonly<PlainState>) {
  const { width: w, height: h } = view;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.4;
  const theta = state.theta as number;
  const p = pointOnCircle(theta);
  const px = cx + p.x * R;
  const py = cy - p.y * R; // screen y is down

  g.clearRect(0, 0, w, h);

  // Axes
  g.strokeStyle = "#888";
  g.lineWidth = 1;
  line(g, 0, cy, w, cy);
  line(g, cx, 0, cx, h);

  // Unit circle
  g.strokeStyle = "#333";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.stroke();

  // Projection (cosine) onto the x-axis
  if (state["show.projection"]) {
    g.strokeStyle = "#c0392b";
    g.setLineDash([4, 4]);
    line(g, px, py, px, cy);
    g.setLineDash([]);
    g.lineWidth = 4;
    line(g, cx, cy, px, cy); // the cosine segment
    g.lineWidth = 2;
  }

  // Radius + point
  g.strokeStyle = "#2c3e50";
  line(g, cx, cy, px, py);
  g.fillStyle = "#e74c3c";
  g.beginPath();
  g.arc(px, py, 7, 0, Math.PI * 2);
  g.fill();

  // Labels
  g.fillStyle = "#2c3e50";
  g.font = "16px sans-serif";
  if (state["show.thetaLabel"]) g.fillText("θ", cx + 24 * Math.cos(theta / 2), cy - 24 * Math.sin(theta / 2));
  if (state["show.cosLabel"]) g.fillText("cos θ", (cx + px) / 2 - 16, cy + 18);
}

function line(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}
