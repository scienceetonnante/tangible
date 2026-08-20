// InteractionManager — pointer capture + hit-testing routed to scene handles.
// Drags write parameters through store.touch(); the Reconciler then owns catch-up.
// Implements the scene-change rule: changing the active scene while playing pauses.

import type { Handle, ParamValue } from "@narrable/core";
import type { StateStore } from "./store.js";
import type { AudioClock } from "./clock.js";

export interface InteractionTarget {
  handles(): Handle[];
}

export class InteractionManager {
  private active?: Handle;

  constructor(
    private canvas: HTMLCanvasElement,
    private target: InteractionTarget,
    private store: StateStore,
    private clock: AudioClock,
    private displayedState: () => Readonly<Record<string, ParamValue>> = () => store.plain,
    private onWrite?: (param: string) => void,
  ) {
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }

  private toCanvas(e: Pick<MouseEvent, "clientX" | "clientY">): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    const sx = r.width ? this.canvas.width / r.width : 1;
    const sy = r.height ? this.canvas.height / r.height : 1;
    return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
  }

  private onDown = (e: PointerEvent) => {
    const [px, py] = this.toCanvas(e);
    const state = this.displayedState();
    for (const h of this.target.handles()) {
      if (!h.hitTest(px, py, state)) continue;
      this.active = h;
      this.canvas.setPointerCapture?.(e.pointerId);
      for (const p of h.params) this.store.setDragging(p, true);
      h.onDown?.(px, py, state);
      this.write(h.onDrag(px, py, state));
      break;
    }
  };

  private onMove = (e: PointerEvent) => {
    if (!this.active) return;
    const [px, py] = this.toCanvas(e);
    this.write(this.active.onDrag(px, py, this.displayedState()));
  };

  private onUp = (e: PointerEvent) => {
    if (!this.active) return;
    for (const p of this.active.params) this.store.setDragging(p, false);
    this.canvas.releasePointerCapture?.(e.pointerId);
    this.active = undefined;
  };

  private onWheel = (e: WheelEvent) => {
    const [px, py] = this.toCanvas(e);
    const state = this.displayedState();
    for (const h of this.target.handles()) {
      if (!h.onWheel || !h.hitTest(px, py, state)) continue;
      e.preventDefault();
      this.write(h.onWheel(px, py, e.deltaY, state));
      break;
    }
  };

  private write(writes: Record<string, ParamValue>): void {
    const t = this.clock.t;
    for (const [param, value] of Object.entries(writes)) {
      this.store.touch(param, value, t);
      this.onWrite?.(param);
      // Scene-change rule: changing the active scene while playing pauses audio.
      if (param === "scene" && this.clock.playing) this.clock.pause();
    }
  }
}
