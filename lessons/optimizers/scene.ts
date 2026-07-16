import type { Handle, OrbitState, ParamValue, PlainState, Schema } from "@narrable/core";
import { orbitHandle } from "@narrable/ingredients";
import type { SceneContext, SceneInstance, SceneModule } from "@narrable/player";
import { draw } from "./drawing.js";
import { buildFrame } from "./frame.js";
import { DOMAIN, MAX_STEPS } from "./model.js";
import { OptimizerThreeView } from "./three-view.js";
import { landscapeBox, sliderBox, SLIDERS, stepBox, toggleBox, TOGGLES, type View } from "./view.js";

const scriptScalar = (range: [number, number], value: number, label: string) => ({
  type: { kind: "scalar" as const, range },
  default: value,
  interpolate: "lerp" as const,
  ownership: "script" as const,
  label,
});

const scriptBoolean = (value: boolean, label: string) => ({
  type: { kind: "boolean" as const },
  default: value,
  interpolate: "snap" as const,
  ownership: "script" as const,
  label,
});

const pathView: OrbitState = { target: [0, 0.4, 0], distance: 7.4, azimuth: -0.15, elevation: 1.22 };

export const presets: Record<string, Record<string, ParamValue>> = {
  pathView: { camera: pathView },
  roundBowlView: { camera: { target: [0, 0.55, 0], distance: 7, azimuth: -0.72, elevation: 0.48 } },
  ravineView: { camera: { target: [0, 0.65, 0], distance: 6.8, azimuth: 1.05, elevation: 0.36 } },
  roughnessView: { camera: { target: [0, 0.55, 0], distance: 6.8, azimuth: 0.05, elevation: 0.34 } },
};

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["landscape"] }, default: "landscape", interpolate: "snap", ownership: "script" },
  kappa: scriptScalar([1, 40], 1, "condition number κ"),
  roughness: scriptScalar([0, 0.35], 0, "ripple amplitude"),
  "start.x": scriptScalar([-DOMAIN, DOMAIN], -1.65, "shared start x-coordinate"),
  "start.y": scriptScalar([-DOMAIN, DOMAIN], 1.15, "shared start y-coordinate"),
  camera: {
    type: { kind: "orbit" },
    default: pathView,
    interpolate: "orbit",
    ownership: "script",
    label: "3D loss-surface camera",
  },
  step: scriptScalar([0, MAX_STEPS], 40, "optimizer step"),
  "active.sgd": scriptBoolean(true, "show SGD"),
  "active.momentum": scriptBoolean(false, "show SGD with momentum"),
  "active.adamw": scriptBoolean(false, "show AdamW"),
  "sgd.lr": scriptScalar([0.02, 0.12], 0.075, "SGD learning rate"),
  "momentum.lr": scriptScalar([0.02, 0.25], 0.15, "momentum learning rate"),
  "momentum.beta": scriptScalar([0, 0.95], 0.3, "momentum smoothing β"),
  "adamw.lr": scriptScalar([0.02, 0.16], 0.1, "AdamW learning rate"),
};

export const groups: Record<string, string[]> = {
  problem: ["kappa", "roughness"],
  start: ["start.x", "start.y"],
  active: ["active.sgd", "active.momentum", "active.adamw"],
};

export const constants: Record<string, number | number[]> = { MAX_STEPS };

export const scene: SceneModule = {
  schema,
  presets,
  create(ctx: SceneContext): SceneInstance {
    const g = ctx.canvas.getContext("2d")!;
    const threeView = ctx.canvas.ownerDocument ? new OptimizerThreeView(ctx.canvas, ctx.overlay) : undefined;
    const removeTheme = applyNightTheme(ctx);
    return {
      render(state) {
        const view = ctx.viewport();
        const frame = buildFrame(state);
        draw(g, view, state, frame);
        threeView?.render(frame, state, view);
      },
      handles: () => handles(ctx.viewport, threeView),
      dispose() {
        threeView?.dispose();
        removeTheme();
      },
    };
  },
};

function handles(viewport: () => View, threeView?: OptimizerThreeView): Handle[] {
  return [
    startHandle(viewport, threeView),
    ...SLIDERS.map((definition) => sliderHandle(viewport, definition.param, definition.range)),
    stepHandle(viewport),
    ...TOGGLES.map((toggle, index) => toggleHandle(viewport, toggle.param, index)),
    orbitHandle({
      speed: 0.004,
      minElevation: 0.12,
      maxElevation: 1.35,
      zoomSpeed: 0.0015,
      minDistance: 4.2,
      maxDistance: 10,
      hitTest(px, py) {
        const box = landscapeBox(viewport());
        return px >= box.x && px <= box.x + box.width && py >= box.y && py <= box.y + box.height;
      },
    }),
  ];
}

function startHandle(viewport: () => View, threeView?: OptimizerThreeView): Handle {
  return {
    id: "start",
    params: ["start.x", "start.y"],
    hitTest(px, py, state) {
      if (!threeView) return false;
      const point = threeView.projectStart(state, viewport());
      const box = landscapeBox(viewport());
      if (px < box.x || px > box.x + box.width || py < box.y || py > box.y + box.height) return false;
      return Math.hypot(px - point.x, py - point.y) < box.width * 0.06;
    },
    onDrag(px, py, state) {
      const point = threeView?.pickSurface(px, py, state, viewport());
      return {
        "start.x": point?.x ?? (state["start.x"] as number),
        "start.y": point?.y ?? (state["start.y"] as number),
      };
    },
  };
}

function sliderHandle(viewport: () => View, param: string, range: [number, number]): Handle {
  const definition = SLIDERS.find((candidate) => candidate.param === param)!;
  return {
    id: param,
    params: [param],
    hitTest(px, py, state) {
      if (definition.optimizer && !(state[`active.${definition.optimizer}`] as boolean)) return false;
      const box = sliderBox(viewport(), definition);
      const radius = Math.min(viewport().width, viewport().height) * 0.035;
      return px >= box.x0 - radius && px <= box.x1 + radius && Math.abs(py - box.y) <= radius;
    },
    onDrag(px) {
      const box = sliderBox(viewport(), definition);
      const t = clamp((px - box.x0) / (box.x1 - box.x0), 0, 1);
      return { [param]: range[0] + t * (range[1] - range[0]) };
    },
  };
}

function stepHandle(viewport: () => View): Handle {
  return {
    id: "step",
    params: ["step"],
    hitTest(px, py) {
      const box = stepBox(viewport());
      const radius = Math.min(viewport().width, viewport().height) * 0.035;
      return px >= box.x0 - radius && px <= box.x1 + radius && Math.abs(py - box.y) <= radius;
    },
    onDrag(px) {
      const box = stepBox(viewport());
      return { step: clamp((px - box.x0) / (box.x1 - box.x0), 0, 1) * MAX_STEPS };
    },
  };
}

function toggleHandle(viewport: () => View, param: string, index: number): Handle {
  let next = false;
  return {
    id: param,
    params: [param],
    hitTest(px, py) {
      const box = toggleBox(viewport(), index);
      return px >= box.x && px <= box.x + box.width && py >= box.y && py <= box.y + box.height;
    },
    onDown(_px, _py, state: Readonly<PlainState>) {
      next = !(state[param] as boolean);
    },
    onDrag(): Record<string, ParamValue> {
      return { [param]: next };
    },
  };
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

const NIGHT_CSS = `
.xv-player.optimizers-night { background: #050609; color: #f5f7fa; }
.xv-player.optimizers-night .xv-board { top: 2%; right: 1.5%; width: 23.5%; height: 63%; padding: 4px; color: #f5f7fa; font-size: 14px; }
.xv-player.optimizers-night .xv-board-inner { gap: 8px; }
.xv-player.optimizers-night .xv-captions { color: #fff; text-shadow: 0 1px 3px #000; }
.xv-player.optimizers-night .xv-chrome { background: rgba(5, 6, 9, 0.9); }
.xv-player.optimizers-night .xv-chrome button { color: #f5f7fa; }
.xv-player.optimizers-night .xv-chrome button:hover { background: rgba(255, 255, 255, 0.1); }
.xv-player.optimizers-night .xv-scrubber { accent-color: #f5f7fa; }
.xv-player.optimizers-night .xv-elapsed { color: #cbd0d8; }
body.optimizers-night-page { background: #050609; }
`;

function applyNightTheme(ctx: SceneContext): () => void {
  const root = ctx.canvas.parentElement;
  if (!root) return () => {};
  const style = ctx.canvas.ownerDocument.createElement("style");
  style.textContent = NIGHT_CSS;
  root.classList.add("optimizers-night");
  ctx.canvas.ownerDocument.body.classList.add("optimizers-night-page");
  root.append(style);
  return () => {
    root.classList.remove("optimizers-night");
    ctx.canvas.ownerDocument.body.classList.remove("optimizers-night-page");
    style.remove();
  };
}
