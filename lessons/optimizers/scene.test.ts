import { buildIndex, type PlainState } from "../../packages/core/src/index.js";
import { Reconciler } from "../../packages/player/src/reconciler.js";
import { StateStore } from "../../packages/player/src/store.js";
import { describe, expect, it } from "vitest";
import { scene, schema } from "./scene.js";
import { landscapeBox, sliderBox, SLIDERS } from "./view.js";

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
  it("opens with a visible trajectory inside a sixty-step horizon", () => {
    expect(schema.step.default).toBe(40);
    expect(schema.step.type).toEqual({ kind: "scalar", range: [0, 60] });
  });

  it("lets the shared start point use the whole surface", () => {
    expect(schema["start.x"]!.type).toEqual({ kind: "scalar", range: [-2, 2] });
    expect(schema["start.y"]!.type).toEqual({ kind: "scalar", range: [-2, 2] });
  });

  it("returns learner changes to the narration even while paused at the beginning", () => {
    const scripted = defaultState();
    const store = new StateStore(schema);
    const reconciler = new Reconciler(store, buildIndex({}, schema), schema, { hold: 3, tau: 0.2 });

    store.touch("sgd.lr", 0.02, 0, 0);
    reconciler.reconcile(scripted, 0, 2, 0.016);
    expect(store.plain["sgd.lr"]).toBe(0.02);

    reconciler.reconcile(scripted, 0, 3.1, 0.1);
    expect(store.plain["sgd.lr"] as number).toBeGreaterThan(0.02);
    expect(store.plain["sgd.lr"] as number).toBeLessThan(schema["sgd.lr"]!.default as number);

    reconciler.reconcile(scripted, 0, 4, 0.9);
    expect(store.plain["sgd.lr"]).toBeCloseTo(schema["sgd.lr"]!.default as number, 3);
  });

  it("uses catch-up ownership for controls and persistent ownership only for the camera", () => {
    const { created } = instance();
    const parameters = new Set(created.handles().flatMap((handle) => handle.params));
    parameters.delete("camera");

    for (const parameter of parameters) expect(schema[parameter]!.ownership).toBe("script");
    expect(schema.camera.ownership).toBe("viewer");
  });

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
    expect(created.handles()).toHaveLength(12);
  });

  it("keeps the camera viewer-owned and confines navigation to the landscape", () => {
    const { created } = instance();
    const camera = created.handles().find((handle) => handle.id === "camera-orbit")!;
    const box = landscapeBox({ width: 1000, height: 600 });

    expect(schema.camera.ownership).toBe("viewer");
    expect(camera.hitTest(box.x + box.width / 2, box.y + box.height / 2, defaultState())).toBe(true);
    expect(camera.hitTest(900, 500, defaultState())).toBe(false);
    expect(camera.onWheel).toBeTypeOf("function");
  });

  it("turns an optimizer toggle into a stable click write", () => {
    const { created } = instance();
    const toggle = created.handles().find((handle) => handle.id === "active.momentum")!;
    const state = defaultState();

    toggle.onDown!(0, 0, state);
    expect(toggle.onDrag(0, 0, state)).toEqual({ "active.momentum": true });
    expect(toggle.onDrag(10, 10, state)).toEqual({ "active.momentum": true });
  });

  it("disables controls for inactive optimizers", () => {
    const { created } = instance();
    const slider = created.handles().find((handle) => handle.id === "momentum.lr")!;
    const definition = SLIDERS.find((candidate) => candidate.param === "momentum.lr")!;
    const box = sliderBox({ width: 1000, height: 600 }, definition);
    const state = defaultState();

    expect(slider.hitTest((box.x0 + box.x1) / 2, box.y, state)).toBe(false);
    expect(slider.hitTest((box.x0 + box.x1) / 2, box.y, { ...state, "active.momentum": true })).toBe(true);
  });
});
