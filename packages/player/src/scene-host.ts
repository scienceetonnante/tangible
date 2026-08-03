// SceneHost and the scene-module contract (DESIGN §5.2). A scene renders as
// a pure function of state — it may cache expensive geometry but must not keep
// mutable state that affects output across frames (that would break value-at-time).

import type { Schema, ParamValue, PlainState, Handle } from "@narrable/core";

export type { Handle };

export interface SceneContext {
  canvas: HTMLCanvasElement;
  overlay: HTMLElement; // for DOM labels / in-scene KaTeX
  viewport(): { width: number; height: number };
  write(param: string, value: ParamValue): void; // DOM controls enter normal reconciliation
  reset(param: string): void;
  pause(): void;
}

export interface SceneInstance {
  render(state: Readonly<PlainState>, dt: number): void;
  handles(): Handle[];
  dispose(): void;
}

export interface SceneModule {
  schema: Schema;
  presets?: Record<string, Record<string, ParamValue>>;
  constants?: Record<string, ParamValue>;
  create(ctx: SceneContext): SceneInstance;
}

/** Owns a scene instance and drives its imperative render from plain state. */
export class SceneHost {
  readonly instance: SceneInstance;

  constructor(module: SceneModule, ctx: SceneContext) {
    this.instance = module.create(ctx);
  }

  render(state: Readonly<PlainState>, dt: number): void {
    this.instance.render(state, dt);
  }

  handles(): Handle[] {
    return this.instance.handles();
  }

  dispose(): void {
    this.instance.dispose();
  }
}
