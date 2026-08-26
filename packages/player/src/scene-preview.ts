// Narration-free browser composition for developing a scene from schema defaults.

import type { ParamValue } from "@tangible/core";
import { InteractionManager, type InteractionClock } from "./interaction.js";
import { SceneHost, type SceneModule } from "./scene-host.js";
import { StateStore } from "./store.js";
import { ParameterActivityTracker } from "./parameter-activity.js";

export interface ScenePreviewOptions {
  mount: HTMLElement;
  scene: SceneModule;
}

const FIXED_CLOCK: InteractionClock = {
  t: 0,
  playing: false,
  pause() {},
};

/** Render and manipulate one scene without audio, tracks, or lesson chrome. */
export class ScenePreview {
  readonly store: StateStore;
  readonly host: SceneHost;
  readonly interaction: InteractionManager;

  private shell: HTMLElement;
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;
  private animationFrame = 0;
  private lastNow?: number;
  private activityTracker = new ParameterActivityTracker();

  constructor(opts: ScenePreviewOptions) {
    this.shell = element("div", "xv-shell");
    this.container = element("div", "xv-player");
    this.canvas = element("canvas") as HTMLCanvasElement;
    const overlay = element("div", "xv-overlay");
    this.container.append(this.canvas, overlay);
    this.shell.append(this.container);
    opts.mount.append(this.shell);

    this.store = new StateStore(opts.scene.schema);
    this.resize();
    this.host = new SceneHost(opts.scene, {
      canvas: this.canvas,
      overlay,
      viewport: () => ({ width: this.canvas.width, height: this.canvas.height }),
      write: (param, value) => this.write(param, value, opts.scene),
      reset: (param) => this.reset(param, opts.scene),
      pause: () => {},
    });
    this.interaction = new InteractionManager(
      this.canvas,
      this.host,
      this.store,
      FIXED_CLOCK,
      () => this.store.plain,
      (param) => {
        this.activityTracker.noteUser(param);
        this.commitInteraction(param);
      },
    );

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
        this.render();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  start(): void {
    if (this.animationFrame) return;
    this.render();
    const loop = (now: number) => {
      this.render(now);
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  }

  /** Render one frame; useful for deterministic tests and resize handling. */
  render(now = performance.now()): void {
    const dt = this.lastNow === undefined ? 0 : Math.max(0, (now - this.lastNow) / 1000);
    this.lastNow = now;
    this.host.render(this.store.plain, {
      dt,
      activity: this.activityTracker.evaluate(0, this.store.meta),
    });
  }

  dispose(): void {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.interaction.dispose();
    this.host.dispose();
    this.shell.remove();
  }

  private write(param: string, value: ParamValue, scene: SceneModule): void {
    if (!(param in scene.schema)) throw new Error(`scene wrote unknown parameter: ${param}`);
    this.store.set(param, value);
    this.activityTracker.noteUser(param);
  }

  private reset(param: string, scene: SceneModule): void {
    const spec = scene.schema[param];
    if (!spec) throw new Error(`scene reset unknown parameter: ${param}`);
    this.store.resetInteraction(param);
    this.store.set(param, spec.default);
    this.activityTracker.noteUser(param);
  }

  private commitInteraction(param: string): void {
    const value = this.store.meta.get(param)?.userValue;
    if (value !== undefined) this.store.set(param, value);
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const bounds = this.container.getBoundingClientRect();
    const width = Math.round(bounds.width) || 640;
    const height = Math.round(bounds.height) || 360;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
  }
}

function element(tag: string, className = ""): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
