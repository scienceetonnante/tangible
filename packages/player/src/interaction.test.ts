// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { Handle, Schema } from "@narrable/core";
import { StateStore } from "./store.js";
import { AudioClock, type MediaClockSource } from "./clock.js";
import { InteractionManager } from "./interaction.js";

class FakeMedia implements MediaClockSource {
  currentTime = 3;
  paused = true;
  duration = 20;
  play() {
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  addEventListener() {}
}

const schema: Schema = { theta: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" } };

const testHandle: Handle = {
  id: "t",
  params: ["theta"],
  hitTest: (px, py) => Math.hypot(px - 200, py - 200) < 20,
  onDrag: (px) => ({ theta: px / 100 }),
};

function ptr(type: string, x: number, y: number) {
  return new MouseEvent(type, { clientX: x, clientY: y }) as unknown as PointerEvent;
}

describe("InteractionManager", () => {
  it("starts a drag on hit, writes params on move, ends on up", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const store = new StateStore(schema);
    const clock = new AudioClock(new FakeMedia());
    new InteractionManager(canvas, { handles: () => [testHandle] }, store, clock, () => 1);

    canvas.dispatchEvent(ptr("pointerdown", 200, 200));
    const m = store.meta.get("theta")!;
    expect(m.dragging).toBe(true);
    expect(m.userValue).toBeCloseTo(2, 9); // 200/100
    expect(m.touchT).toBe(3); // clock time captured

    canvas.dispatchEvent(ptr("pointermove", 300, 200));
    expect(store.meta.get("theta")!.userValue).toBeCloseTo(3, 9);

    canvas.dispatchEvent(ptr("pointerup", 300, 200));
    expect(store.meta.get("theta")!.dragging).toBe(false);
  });

  it("ignores drags that miss every handle", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const store = new StateStore(schema);
    const clock = new AudioClock(new FakeMedia());
    new InteractionManager(canvas, { handles: () => [testHandle] }, store, clock, () => 1);
    canvas.dispatchEvent(ptr("pointerdown", 0, 0));
    canvas.dispatchEvent(ptr("pointermove", 50, 50));
    expect(store.meta.get("theta")!.touchedEver).toBe(false);
  });
});
