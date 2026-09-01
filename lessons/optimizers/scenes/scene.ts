import type { Handle, OrbitState, ParamValue, PlainState, Schema } from "@tangible/core";
import { orbitHandle } from "@tangible/ingredients";
import type { SceneContext, SceneInstance, SceneModule } from "@tangible/player";
import { draw } from "./drawing.js";
import { buildFrame } from "./frame.js";
import { DOMAIN, MAX_STEPS } from "./model.js";
import { OptimizerThreeView } from "./three-view.js";
import { cssPixels, landscapeBox, sliderBox, SLIDERS, stepBox, toggleBox, TOGGLES, type View } from "./view.js";

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

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["landscape"] }, default: "landscape", interpolate: "snap", ownership: "script" },
  kappa: scriptScalar([1, 40], 1, "condition number κ"),
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
  start: ["start.x", "start.y"],
  active: ["active.sgd", "active.momentum", "active.adamw"],
};

export const constants: Record<string, number | number[]> = { MAX_STEPS };

export const scene: SceneModule = {
  schema,
  create(ctx: SceneContext): SceneInstance {
    const g = ctx.canvas.getContext("2d")!;
    const threeView = ctx.canvas.ownerDocument ? new OptimizerThreeView(ctx.canvas, ctx.overlay) : undefined;
    const removeTheme = applyNightTheme(ctx);
    ctx.canvas.setAttribute?.("role", "img");
    ctx.canvas.setAttribute?.(
      "aria-label",
      "Interactive 3D loss landscape comparing SGD, momentum, and AdamW. Drag the white starting point or the camera, and use the labeled sliders and optimizer toggles.",
    );
    return {
      render(state, { activity }) {
        const view = responsiveView(ctx.viewport(), ctx.canvas);
        const frame = buildFrame(state);
        draw(g, view, state, frame, activity);
        threeView?.render(frame, state, view);
      },
      handles: () => handles(ctx.viewport, ctx.canvas, threeView),
      dispose() {
        threeView?.dispose();
        removeTheme();
      },
    };
  },
};

function handles(viewport: () => View, canvas: HTMLCanvasElement, threeView?: OptimizerThreeView): Handle[] {
  const view = () => responsiveView(viewport(), canvas);
  return [
    startHandle(view, threeView),
    ...SLIDERS.map((definition) => sliderHandle(view, definition.param, definition.range)),
    stepHandle(view),
    ...TOGGLES.map((toggle, index) => toggleHandle(view, toggle.param, index)),
    orbitHandle({
      speed: 0.004,
      minElevation: 0.12,
      maxElevation: 1.35,
      zoomSpeed: 0.0015,
      minDistance: 4.2,
      maxDistance: 10,
      hitTest(px, py) {
        const box = landscapeBox(view());
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
      return Math.hypot(px - point.x, py - point.y) < Math.max(box.width * 0.06, touchRadius(viewport()));
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
      const view = viewport();
      const box = sliderBox(view, definition);
      const radius = touchRadius(view);
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
      const radius = touchRadius(viewport());
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
      const view = viewport();
      const box = toggleBox(view, index);
      const halfWidth = Math.max(box.width / 2, touchRadius(view));
      const halfHeight = Math.max(box.height / 2, touchRadius(view));
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      return Math.abs(px - centerX) <= halfWidth && Math.abs(py - centerY) <= halfHeight;
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

function responsiveView(view: View, canvas: HTMLCanvasElement): View {
  const bounds = canvas.getBoundingClientRect?.();
  const pixelRatio = bounds?.width ? view.width / bounds.width : 1;
  return { ...view, pixelRatio };
}

function touchRadius(view: View): number {
  return Math.max(Math.min(view.width, view.height) * 0.035, cssPixels(view, 22));
}

const NIGHT_CSS = `
.xv-player.optimizers-night { background: #050609; color: #f5f7fa; }
.xv-player.optimizers-night .xv-board { top: 2%; right: 1.5%; width: 23%; height: 63%; padding: 4px; color: #f5f7fa; font-size: clamp(12px, 1.25vw, 16px); }
.xv-player.optimizers-night .xv-board-inner { gap: 30px; }
.xv-player.optimizers-night .xv-board-item { width: 100%; text-align: center; }
.xv-player.optimizers-night .xv-captions { color: #fff; background: rgba(5, 6, 9, 0.74); border-radius: 5px; text-shadow: 0 1px 3px #000; }
.xv-player.optimizers-night .xv-chrome { background: rgba(5, 6, 9, 0.9); }
.xv-player.optimizers-night .xv-chrome button { color: #f5f7fa; }
.xv-player.optimizers-night .xv-chrome button:hover { background: rgba(255, 255, 255, 0.1); }
.xv-player.optimizers-night .xv-chrome button:focus-visible,
.xv-player.optimizers-night .xv-scrubber:focus-visible { outline-color: #78c7ff; }
.xv-player.optimizers-night .xv-scrubber { accent-color: #f5f7fa; }
.xv-player.optimizers-night .xv-elapsed { color: #cbd0d8; }
.xv-shell.optimizers-night-shell .xv-assistant { border-color: #2b313b; background: #0b0d12; color: #f5f7fa; }
.xv-shell.optimizers-night-shell .xv-assistant-body { border-color: #2b313b; }
.xv-shell.optimizers-night-shell .xv-assistant-input { border-color: #515967; background: #141821; color: #f5f7fa; }
.xv-shell.optimizers-night-shell .xv-assistant-input:disabled { background: #11141a; color: #8e96a3; }
.xv-shell.optimizers-night-shell .xv-assistant button:not(.xv-assistant-toggle) { border-color: #515967; background: #171b23; }
.xv-shell.optimizers-night-shell .xv-assistant-footer { color: #aeb6c2; }
.xv-shell.optimizers-night-shell .xv-assistant-turn { border-color: #515967; }
body.optimizers-night-page { background: #050609; }
`;

function applyNightTheme(ctx: SceneContext): () => void {
  const root = ctx.canvas.parentElement;
  if (!root) return () => {};
  const shell = root.closest(".xv-shell");
  const style = ctx.canvas.ownerDocument.createElement("style");
  style.textContent = NIGHT_CSS;
  root.classList.add("optimizers-night");
  shell?.classList.add("optimizers-night-shell");
  ctx.canvas.ownerDocument.body.classList.add("optimizers-night-page");
  root.append(style);
  return () => {
    root.classList.remove("optimizers-night");
    shell?.classList.remove("optimizers-night-shell");
    ctx.canvas.ownerDocument.body.classList.remove("optimizers-night-page");
    style.remove();
  };
}
