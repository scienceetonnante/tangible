// Player — composes the runtime: DOM layers, store, clock, timeline driver, scene
// host, and chrome. One Player per lesson page (ARCHITECTURE §5.1).

import { buildIndex, type LessonTracks, type Schema, type PlainState, type TrackIndex } from "@xv/core";
import { AudioClock } from "./clock.js";
import { StateStore } from "./store.js";
import { TimelineDriver } from "./timeline.js";
import { SceneHost, type SceneModule } from "./scene-host.js";
import { Chrome } from "./chrome.js";
import { Reconciler } from "./reconciler.js";
import { InteractionManager } from "./interaction.js";
import { parseDevParams } from "./url.js";

declare global {
  interface Window {
    __XV_STATE__?: PlainState;
  }
}

export interface PlayerOptions {
  mount: HTMLElement;
  scene: SceneModule;
  tracks: LessonTracks;
  audioSrc?: string[];
  baseUrl?: string;
  chrome?: boolean; // default true
}

export class Player {
  readonly store: StateStore;
  readonly clock: AudioClock;
  readonly driver: TimelineDriver;
  readonly host: SceneHost;
  readonly chrome?: Chrome;
  readonly reconciler: Reconciler;
  readonly interaction: InteractionManager;
  readonly audio: HTMLAudioElement;

  private canvas: HTMLCanvasElement;
  private container: HTMLElement;
  private index: TrackIndex;
  private lastFrameT = 0;
  private dumpState = false;
  private unbindKeys?: () => void;

  constructor(opts: PlayerOptions) {
    const schema: Schema = { ...opts.scene.schema, ...boardSchema(opts.tracks.tracks) };
    this.index = buildIndex(opts.tracks.tracks, schema);
    this.store = new StateStore(schema);

    // DOM layers, bottom to top (ARCHITECTURE §5.1).
    this.container = el("div", "xv-player");
    this.canvas = el("canvas", "") as HTMLCanvasElement;
    const overlay = el("div", "xv-overlay");
    const board = el("aside", "xv-board");
    const captions = el("div", "xv-captions");
    const gate = el("div", "xv-gate");
    this.audio = document.createElement("audio");
    for (const src of opts.audioSrc ?? []) {
      const s = document.createElement("source");
      s.src = (opts.baseUrl ?? "") + src;
      this.audio.append(s);
    }
    this.container.append(this.canvas, overlay, board, captions, gate, this.audio);
    opts.mount.append(this.container);
    this.resize();

    this.clock = new AudioClock(this.audio);
    this.host = new SceneHost(opts.scene, {
      canvas: this.canvas,
      overlay,
      viewport: () => ({ width: this.canvas.width, height: this.canvas.height }),
    });
    this.reconciler = new Reconciler(this.store, this.index, schema);
    this.driver = new TimelineDriver(this.clock, this.index, this.store, { onFrame: (t) => this.frame(t) }, this.reconciler);
    this.interaction = new InteractionManager(this.canvas, this.host, this.store, this.clock);

    const dev = parseDevParams(typeof location !== "undefined" ? location.search : "");
    if (opts.chrome !== false && !dev.nochrome) {
      this.chrome = new Chrome(this.clock, opts.tracks);
      this.container.append(this.chrome.el);
      this.unbindKeys = this.chrome.bindKeys();
    }
    if (dev.state) this.dumpState = true;
    if (dev.t !== undefined) {
      this.clock.seek(dev.t);
      this.clock.pause();
    }
  }

  start(): void {
    this.driver.tick(); // initial paint
    this.driver.start();
  }

  dispose(): void {
    this.driver.stop();
    this.interaction.dispose();
    this.unbindKeys?.();
    this.host.dispose();
    this.container.remove();
  }

  private frame(t: number): void {
    const dt = Math.max(0, t - this.lastFrameT);
    this.lastFrameT = t;
    this.host.render(this.store.plain, dt);
    this.chrome?.update(t);
    if (this.dumpState) window.__XV_STATE__ = { ...this.store.plain };
  }

  private resize(): void {
    const r = this.container.getBoundingClientRect();
    this.canvas.width = Math.round(r.width) || 640;
    this.canvas.height = Math.round(r.height) || 360;
  }
}

/** Derive interpolation specs for board.* tracks (not in the scene schema). */
export function boardSchema(tracks: Record<string, unknown>): Schema {
  const s: Schema = {};
  for (const key of Object.keys(tracks)) {
    if (!key.startsWith("board.")) continue;
    s[key] = key.includes(".highlight")
      ? { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" }
      : { type: { kind: "boardItem" }, default: "hidden", interpolate: "snap", ownership: "script" };
  }
  return s;
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
