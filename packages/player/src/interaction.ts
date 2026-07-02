// InteractionManager — pointer capture + hit-testing routed to scene handles.
// Drags write parameters through store.touch(); the Reconciler then owns catch-up.
// Implements the scene-change rule: changing the active scene while playing pauses.

import type { Handle, ParamValue } from "@xv/core";
import type { StateStore } from "./store.js";
import type { AudioClock } from "./clock.js";

export interface InteractionTarget {
  handles(): Handle[];
}

export class InteractionManager {
  private active?: Handle;
  private now: () => number;

  constructor(
    private canvas: HTMLCanvasElement,
    private target: InteractionTarget,
    private store: StateStore,
    private clock: AudioClock,
    now?: () => number,
  ) {
    this.now = now ?? (() => performance.now() / 1000);
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
  }

  private toCanvas(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    const sx = r.width ? this.canvas.width / r.width : 1;
    const sy = r.height ? this.canvas.height / r.height : 1;
    return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
  }

  private onDown = (e: PointerEvent) => {
    const [px, py] = this.toCanvas(e);
    for (const h of this.target.handles()) {
      if (!h.hitTest(px, py, this.store.plain)) continue;
      this.active = h;
      this.canvas.setPointerCapture?.(e.pointerId);
      for (const p of h.params) this.store.setDragging(p, true);
      h.onDown?.(px, py, this.store.plain);
      this.write(h.onDrag(px, py, this.store.plain));
      break;
    }
  };

  private onMove = (e: PointerEvent) => {
    if (!this.active) return;
    const [px, py] = this.toCanvas(e);
    this.write(this.active.onDrag(px, py, this.store.plain));
  };

  private onUp = (e: PointerEvent) => {
    if (!this.active) return;
    for (const p of this.active.params) this.store.setDragging(p, false);
    this.canvas.releasePointerCapture?.(e.pointerId);
    this.active = undefined;
  };

  private write(writes: Record<string, ParamValue>): void {
    const now = this.now();
    const t = this.clock.t;
    for (const [param, value] of Object.entries(writes)) {
      this.store.touch(param, value, now, t);
      // Scene-change rule: changing the active scene while playing pauses audio.
      if (param === "scene" && this.clock.playing) this.clock.pause();
    }
  }
}
