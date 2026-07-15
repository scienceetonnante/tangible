import type { PlainState } from "@narrable/core";
import { describe, expect, it } from "vitest";
import { scene, schema } from "./scene.js";
import { landscapeBox } from "./view.js";

function recordingContext() {
  const calls: string[] = [];
  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (_target, property) => () => calls.push(String(property)),
    set: () => true,
  };
  return { context: new Proxy({}, handler) as unknown as CanvasRenderingContext2D, calls };
}

function defaultState(): PlainState {
  return Object.fromEntries(Object.entries(schema).map(([key, spec]) => [key, structuredClone(spec.default)]));
}

function instance(width = 1000, height = 600) {
  const { context, calls } = recordingContext();
  const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;
  const created = scene.create({ canvas, overlay: {} as HTMLElement, viewport: () => ({ width, height }) });
  return { created, calls };
}

describe("optimizer scene", () => {
  it("renders the terrain, trajectories, plots, and controls", () => {
    const { created, calls } = instance();
    const state = {
      ...defaultState(),
      step: 24,
      kappa: 24,
      "active.momentum": true,
      "active.adamw": true,
    };

    created.render(state, 0.016);

    expect(calls).toContain("clearRect");
    expect(calls).toContain("fillRect");
    expect(calls).toContain("lineTo");
    expect(calls).toContain("fillText");
    expect(created.handles()).toHaveLength(11);
  });

  it("maps a landscape drag to the shared start coordinates", () => {
    const { created } = instance();
    const start = created.handles().find((handle) => handle.id === "start")!;
    const box = landscapeBox({ width: 1000, height: 600 });
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    expect(start.onDrag(centerX, centerY, defaultState())).toEqual({ "start.x": 0, "start.y": 0 });
  });

  it("turns an optimizer toggle into a stable click write", () => {
    const { created } = instance();
    const toggle = created.handles().find((handle) => handle.id === "active.momentum")!;
    const state = defaultState();

    toggle.onDown!(0, 0, state);
    expect(toggle.onDrag(0, 0, state)).toEqual({ "active.momentum": true });
    expect(toggle.onDrag(10, 10, state)).toEqual({ "active.momentum": true });
  });
});
