// Backpropagation scene: a tiny MLP (2 inputs -> 2 hidden -> 1 output -> scalar loss)
// drawn in 2D as nodes + weighted edges. Activations, gradients and the loss are all
// pure functions of the six weights, so dragging a weight recomputes everything for free.

import type { Schema, ParamValue, PlainState, Handle } from "@narrable/core";
import type { SceneModule, SceneInstance, SceneContext } from "@narrable/player";

// Fixed inputs and training target (also exported as constants for the cue sheet).
const X1 = 1.0;
const X2 = 0.5;
const TARGET = 1.0;

const W: [number, number] = [-2, 2]; // weight range

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["net"] }, default: "net", interpolate: "snap", ownership: "script" },

  // Six weights. `shared`: the script animates them (gradient-descent steps) AND the
  // learner can grab them; a grabbed weight holds, then glides back to the timeline.
  w11: { type: { kind: "scalar", range: W }, default: 0.5, interpolate: "lerp", ownership: "shared", label: "input1 -> hidden1" },
  w12: { type: { kind: "scalar", range: W }, default: -0.4, interpolate: "lerp", ownership: "shared", label: "input2 -> hidden1" },
  w21: { type: { kind: "scalar", range: W }, default: -0.3, interpolate: "lerp", ownership: "shared", label: "input1 -> hidden2" },
  w22: { type: { kind: "scalar", range: W }, default: 0.8, interpolate: "lerp", ownership: "shared", label: "input2 -> hidden2" },
  wo1: { type: { kind: "scalar", range: W }, default: 0.6, interpolate: "lerp", ownership: "shared", label: "hidden1 -> output" },
  wo2: { type: { kind: "scalar", range: W }, default: -0.5, interpolate: "lerp", ownership: "shared", label: "hidden2 -> output" },

  // Learning rate: learner-owned, so it sticks once they touch it.
  lr: { type: { kind: "scalar", range: [0, 1] }, default: 0.5, interpolate: "lerp", ownership: "viewer", label: "learning rate" },

  // Sweep progress: script-driven scalars that reveal the two passes left->right / right->left.
  forward: { type: { kind: "scalar", range: [0, 1] }, default: 0, interpolate: "lerp", ownership: "script", label: "forward-pass reveal" },
  backward: { type: { kind: "scalar", range: [0, 1] }, default: 0, interpolate: "lerp", ownership: "script", label: "backward-pass reveal" },

  "show.loss": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
};

export const constants: Record<string, number | number[]> = { X1, X2, TARGET };

// --- the maths, as pure functions of the weight state ---

interface Fwd { z1: number; z2: number; h1: number; h2: number; yhat: number; loss: number; }

export function forward(w: Record<string, number>): Fwd {
  const z1 = w.w11! * X1 + w.w12! * X2;
  const z2 = w.w21! * X1 + w.w22! * X2;
  const h1 = Math.tanh(z1);
  const h2 = Math.tanh(z2);
  const yhat = w.wo1! * h1 + w.wo2! * h2;
  return { z1, z2, h1, h2, yhat, loss: 0.5 * (yhat - TARGET) ** 2 };
}

/** Gradient of the loss w.r.t. each weight (backprop). */
export function gradients(w: Record<string, number>): Record<string, number> {
  const { h1, h2, yhat } = forward(w);
  const dy = yhat - TARGET;
  const dz1 = dy * w.wo1! * (1 - h1 * h1);
  const dz2 = dy * w.wo2! * (1 - h2 * h2);
  return { w11: dz1 * X1, w12: dz1 * X2, w21: dz2 * X1, w22: dz2 * X2, wo1: dy * h1, wo2: dy * h2 };
}

// --- layout: node positions and the weighted edges between them ---

interface Node { x: number; y: number; act: number; col: number; }
interface Edge { w: string; from: Node; to: Node; }

function layout(view: { width: number; height: number }, s: Record<string, number>) {
  const { width: wd, height: ht } = view;
  const f = forward(s);
  const col = [0.15, 0.42, 0.68].map((c) => c * wd);
  const yTop = 0.34 * ht, yBot = 0.66 * ht, yMid = 0.5 * ht;
  const nodes = {
    i0: { x: col[0]!, y: yTop, act: X1, col: 0 },
    i1: { x: col[0]!, y: yBot, act: X2, col: 0 },
    h0: { x: col[1]!, y: yTop, act: f.h1, col: 1 },
    h1: { x: col[1]!, y: yBot, act: f.h2, col: 1 },
    o: { x: col[2]!, y: yMid, act: f.yhat, col: 2 },
  };
  const edges: Edge[] = [
    { w: "w11", from: nodes.i0, to: nodes.h0 },
    { w: "w12", from: nodes.i1, to: nodes.h0 },
    { w: "w21", from: nodes.i0, to: nodes.h1 },
    { w: "w22", from: nodes.i1, to: nodes.h1 },
    { w: "wo1", from: nodes.h0, to: nodes.o },
    { w: "wo2", from: nodes.h1, to: nodes.o },
  ];
  return { nodes, edges, f };
}

export const scene: SceneModule = {
  schema,
  constants,
  create(ctx: SceneContext): SceneInstance {
    const g = ctx.canvas.getContext("2d")!;
    return {
      render: (state: Readonly<PlainState>) => draw(g, ctx.viewport(), state as Record<string, number | boolean>),
      handles: () => [...["w11", "w12", "w21", "w22", "wo1", "wo2"].map((w) => weightHandle(w, ctx.viewport)), lrHandle(ctx.viewport)],
      dispose: () => {},
    };
  },
};

// --- drawing ---

/** Diverging colour for a signed value: teal (+) / orange (-), intensity by magnitude. */
function signColor(v: number, alpha = 1): string {
  const m = Math.min(1, Math.abs(v) / 1.5);
  const [r, gg, b] = v >= 0 ? [26, 160, 160] : [230, 126, 34];
  const bl = (x: number) => Math.round(245 + (x - 245) * m);
  return `rgba(${bl(r)},${bl(gg)},${bl(b)},${alpha})`;
}

/** Smooth 0->1 ramp; used to fade each column in as the sweep passes it. */
function ramp(prog: number, lo: number, hi: number): number {
  const t = Math.max(0, Math.min(1, (prog - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

function draw(g: CanvasRenderingContext2D, view: { width: number; height: number }, state: Record<string, number | boolean>) {
  const { width: w, height: h } = view;
  const s = state as Record<string, number>;
  const R = Math.min(w, h) * 0.4;
  const nodeR = R * 0.13;
  const { nodes, edges, f } = layout(view, s);
  const grads = gradients(s);
  const fwd = s.forward ?? 0;
  const bwd = s.backward ?? 0;

  g.clearRect(0, 0, w, h);
  g.lineJoin = "round";
  g.textAlign = "center";
  g.textBaseline = "middle";

  // Weighted edges: width by |w|, colour by sign.
  for (const e of edges) {
    g.strokeStyle = signColor(s[e.w]!, 0.9);
    g.lineWidth = Math.max(R * 0.006, Math.abs(s[e.w]!) * R * 0.03);
    line(g, e.from.x, e.from.y, e.to.x, e.to.y);
  }

  // Backward pass: gradient arrows flowing right->left, revealed by `backward`.
  for (const e of edges) {
    const colReveal = e.to.col === 2 ? ramp(bwd, 0, 0.5) : ramp(bwd, 0.5, 1);
    if (colReveal <= 0.01) continue;
    const gr = grads[e.w]!;
    g.strokeStyle = `rgba(200,60,180,${0.9 * colReveal})`;
    g.lineWidth = Math.max(R * 0.008, Math.min(R * 0.05, Math.abs(gr) * R * 0.12));
    arrow(g, e.to.x, e.to.y, e.from.x, e.from.y, nodeR, R * 0.05 * colReveal);
    g.fillStyle = `rgba(150,30,140,${colReveal})`;
    g.font = `600 ${R * 0.05}px sans-serif`;
    // 2/3 along the edge, so the two crossing edges' labels don't stack at the shared midpoint.
    const gx = e.from.x + 0.66 * (e.to.x - e.from.x), gy = e.from.y + 0.66 * (e.to.y - e.from.y);
    g.fillText(`∂L/∂${e.w} = ${gr.toFixed(2)}`, gx, gy - R * 0.09);
  }

  // Weight labels, 1/3 along each edge (offset from the gradient labels and the crossing point).
  g.font = `${R * 0.05}px sans-serif`;
  g.fillStyle = "#555";
  for (const e of edges) {
    const lx = e.from.x + 0.34 * (e.to.x - e.from.x), ly = e.from.y + 0.34 * (e.to.y - e.from.y);
    g.fillText(s[e.w]!.toFixed(2), lx, ly + R * 0.08);
  }

  // Nodes: fill by activation, faded in as the forward sweep reaches each column.
  const colLo = [0, 0.35, 0.7];
  for (const n of Object.values(nodes)) {
    const lit = ramp(fwd, colLo[n.col]!, colLo[n.col]! + 0.3);
    g.fillStyle = signColor(n.act, 0.25 + 0.75 * lit);
    g.strokeStyle = "#333";
    g.lineWidth = R * 0.01;
    disc(g, n.x, n.y, nodeR);
    g.fill();
    g.stroke();
    g.fillStyle = "#111";
    g.font = `600 ${R * 0.06}px sans-serif`;
    g.fillText(n.act.toFixed(2), n.x, n.y);
  }

  // Column captions.
  g.fillStyle = "#888";
  g.font = `${R * 0.055}px sans-serif`;
  g.fillText("inputs", nodes.i0.x, nodes.i0.y - nodeR - R * 0.09);
  g.fillText("hidden", nodes.h0.x, nodes.h0.y - nodeR - R * 0.09);
  g.fillText("output ŷ", nodes.o.x, nodes.o.y - nodeR - R * 0.09);

  // Loss + target panel to the right of the output.
  if (state["show.loss"]) {
    const lx = 0.87 * w, ly = 0.5 * h;
    g.fillStyle = f.loss < 0.05 ? "#1a8a3a" : "#c0392b";
    g.font = `700 ${R * 0.08}px sans-serif`;
    g.fillText(`L = ${f.loss.toFixed(3)}`, lx, ly - R * 0.08);
    g.fillStyle = "#555";
    g.font = `${R * 0.06}px sans-serif`;
    g.fillText(`target t = ${TARGET.toFixed(1)}`, lx, ly + R * 0.06);
    g.strokeStyle = "#999";
    g.lineWidth = R * 0.006;
    line(g, nodes.o.x + nodeR, ly, lx - R * 0.32, ly);
  }

  // Learning-rate slider (learner-draggable).
  const sl = sliderGeom(view);
  g.strokeStyle = "#bbb";
  g.lineWidth = R * 0.01;
  line(g, sl.x0, sl.y, sl.x1, sl.y);
  const lr = s.lr ?? 0.5;
  g.fillStyle = "#2c3e50";
  disc(g, sl.x0 + (sl.x1 - sl.x0) * lr, sl.y, R * 0.035);
  g.fill();
  g.fillStyle = "#555";
  g.font = `${R * 0.055}px sans-serif`;
  g.fillText(`learning rate η = ${lr.toFixed(2)}`, (sl.x0 + sl.x1) / 2, sl.y - R * 0.08);
}

// --- interaction handles ---

/** Drag a weight up/down: above centre = positive, below = negative, full range over ~half R. */
function weightHandle(param: string, viewport: () => { width: number; height: number }): Handle {
  return {
    id: param,
    params: [param],
    hitTest(px, py, state) {
      const v = viewport();
      const { edges } = layout(v, state as Record<string, number>);
      const e = edges.find((ed) => ed.w === param)!;
      const R = Math.min(v.width, v.height) * 0.4;
      return Math.hypot(px - (e.from.x + e.to.x) / 2, py - (e.from.y + e.to.y) / 2) < R * 0.11;
    },
    onDrag(_px, py, _state) {
      const v = viewport();
      const R = Math.min(v.width, v.height) * 0.4;
      const val = ((v.height / 2 - py) / (R * 0.55)) * 2;
      return { [param]: Math.max(W[0], Math.min(W[1], val)) };
    },
  };
}

function sliderGeom(view: { width: number; height: number }) {
  return { x0: 0.32 * view.width, x1: 0.68 * view.width, y: 0.8 * view.height };
}

function lrHandle(viewport: () => { width: number; height: number }): Handle {
  return {
    id: "lr",
    params: ["lr"],
    hitTest(px, py) {
      const v = viewport();
      const sl = sliderGeom(v);
      const R = Math.min(v.width, v.height) * 0.4;
      return py > sl.y - R * 0.1 && py < sl.y + R * 0.1 && px > sl.x0 - R * 0.05 && px < sl.x1 + R * 0.05;
    },
    onDrag(px) {
      const sl = sliderGeom(viewport());
      return { lr: Math.max(0, Math.min(1, (px - sl.x0) / (sl.x1 - sl.x0))) };
    },
  };
}

// --- tiny canvas helpers ---

function line(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

function disc(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
}

/** Arrow from (x1,y1) toward (x2,y2), stopping short of the node radius, with a head. */
function arrow(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, pad: number, head: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const sx = x1 + Math.cos(a) * pad, sy = y1 + Math.sin(a) * pad;
  const ex = x2 - Math.cos(a) * pad, ey = y2 - Math.sin(a) * pad;
  line(g, sx, sy, ex, ey);
  g.beginPath();
  g.moveTo(ex, ey);
  g.lineTo(ex - Math.cos(a - 0.4) * head, ey - Math.sin(a - 0.4) * head);
  g.moveTo(ex, ey);
  g.lineTo(ex - Math.cos(a + 0.4) * head, ey - Math.sin(a + 0.4) * head);
  g.stroke();
}
