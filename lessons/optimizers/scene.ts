import type { Handle, ParamValue, PlainState, Schema } from "@narrable/core";
import type { SceneContext, SceneInstance, SceneModule } from "@narrable/player";
import { draw } from "./drawing.js";
import { DOMAIN, MAX_STEPS } from "./model.js";
import { landscapeBox, sliderBox, SLIDERS, stepBox, toggleBox, TOGGLES, type View } from "./view.js";

const sharedScalar = (range: [number, number], value: number, label: string) => ({
  type: { kind: "scalar" as const, range },
  default: value,
  interpolate: "lerp" as const,
  ownership: "shared" as const,
  label,
});

const sharedBoolean = (value: boolean, label: string) => ({
  type: { kind: "boolean" as const },
  default: value,
  interpolate: "snap" as const,
  ownership: "shared" as const,
  label,
});

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["landscape"] }, default: "landscape", interpolate: "snap", ownership: "script" },
  kappa: sharedScalar([1, 40], 1, "condition number κ"),
  roughness: sharedScalar([0, 0.35], 0, "ripple amplitude"),
  "start.x": sharedScalar([-DOMAIN, 0], -1.65, "mirrored start x-coordinate"),
  "start.y": sharedScalar([0, DOMAIN], 1.15, "mirrored start y-coordinate"),
  step: sharedScalar([0, MAX_STEPS], 0, "matched optimizer step"),
  "active.sgd": sharedBoolean(true, "show SGD"),
  "active.momentum": sharedBoolean(false, "show SGD with momentum"),
  "active.adamw": sharedBoolean(false, "show AdamW"),
  "sgd.lr": sharedScalar([0.02, 0.12], 0.075, "SGD learning rate"),
  "momentum.lr": sharedScalar([0.02, 0.25], 0.15, "momentum learning rate"),
  "momentum.beta": sharedScalar([0, 0.95], 0.3, "momentum smoothing β"),
  "adamw.lr": sharedScalar([0.02, 0.16], 0.1, "AdamW learning rate"),
};

export const groups: Record<string, string[]> = {
  problem: ["kappa", "roughness"],
  start: ["start.x", "start.y"],
  active: ["active.sgd", "active.momentum", "active.adamw"],
};

export const constants: Record<string, number | number[]> = { MAX_STEPS };

export const scene: SceneModule = {
  schema,
  create(ctx: SceneContext): SceneInstance {
    const canvas = ctx.canvas.getContext("2d")!;
    const removeTheme = applyNightTheme(ctx);
    return {
      render: (state) => draw(canvas, ctx.viewport(), state),
      handles: () => handles(ctx.viewport),
      dispose: removeTheme,
    };
  },
};

function handles(viewport: () => View): Handle[] {
  return [
    startHandle(viewport),
    ...SLIDERS.map((definition) => sliderHandle(viewport, definition.param, definition.range)),
    stepHandle(viewport),
    ...TOGGLES.map((toggle, index) => toggleHandle(viewport, toggle.param, index)),
  ];
}

function startHandle(viewport: () => View): Handle {
  return {
    id: "start",
    params: ["start.x", "start.y"],
    hitTest(px, py, state) {
      const box = landscapeBox(viewport());
      const point = toScreen(box, state["start.x"] as number, state["start.y"] as number);
      return Math.hypot(px - point.x, py - point.y) < box.width * 0.06;
    },
    onDrag(px, py) {
      const box = landscapeBox(viewport());
      return {
        "start.x": clamp(((px - box.x) / box.width) * DOMAIN * 2 - DOMAIN, -DOMAIN, 0),
        "start.y": clamp(DOMAIN - ((py - box.y) / box.height) * DOMAIN * 2, 0, DOMAIN),
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

function toScreen(box: { x: number; y: number; width: number; height: number }, x: number, y: number) {
  return { x: box.x + ((x + DOMAIN) / (DOMAIN * 2)) * box.width, y: box.y + ((DOMAIN - y) / (DOMAIN * 2)) * box.height };
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

const NIGHT_CSS = `
.xv-player.optimizers-night { background: #050609; color: #f5f7fa; }
.xv-player.optimizers-night .xv-board { color: #f5f7fa; }
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
