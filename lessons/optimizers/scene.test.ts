import { buildIndex, type PlainState } from "../../packages/core/src/index.js";
import { Reconciler } from "../../packages/player/src/reconciler.js";
import { StateStore } from "../../packages/player/src/store.js";
import { describe, expect, it } from "vitest";
import { presets, scene, schema } from "./scene.js";
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

  it("freezes learner changes while paused, then returns after a fresh resume hold", () => {
    const scripted = defaultState();
    const store = new StateStore(schema);
    const reconciler = new Reconciler(store, buildIndex({}, schema), schema, { hold: 3, tau: 0.2 });

    store.touch("sgd.lr", 0.02, 0);
    reconciler.reconcile(scripted, 0, 0.016, false);
    expect(store.plain["sgd.lr"]).toBe(0.02);

    reconciler.reconcile(scripted, 0, 30, false);
    expect(store.plain["sgd.lr"]).toBe(0.02);

    reconciler.resume(0);
    reconciler.reconcile(scripted, 2.99, 0.1);
    expect(store.plain["sgd.lr"]).toBe(0.02);

    reconciler.reconcile(scripted, 3.1, 0.1);
    expect(store.plain["sgd.lr"] as number).toBeGreaterThan(0.02);
    expect(store.plain["sgd.lr"] as number).toBeLessThan(schema["sgd.lr"]!.default as number);

    reconciler.reconcile(scripted, 4, 0.9);
    expect(store.plain["sgd.lr"]).toBeCloseTo(schema["sgd.lr"]!.default as number, 3);
  });

  it("returns a learner-moved camera to the scripted shot", () => {
    const scripted = defaultState();
    const store = new StateStore(schema);
    const reconciler = new Reconciler(store, buildIndex({}, schema), schema, { hold: 3, tau: 0.2 });
    const moved = presets.ravineView!.camera!;

    store.touch("camera", moved, 0);
    reconciler.reconcile(scripted, 2, 0.016);
    expect(store.plain.camera).toEqual(moved);

    reconciler.reconcile(scripted, 3.1, 0.1);
    const returning = store.plain.camera as { elevation: number };
    expect(returning.elevation).toBeGreaterThan((moved as { elevation: number }).elevation);
    expect(returning.elevation).toBeLessThan((schema.camera.default as { elevation: number }).elevation);

    reconciler.reconcile(scripted, 5.1, 2);
    expect((store.plain.camera as { elevation: number }).elevation).toBeCloseTo(
      (schema.camera.default as { elevation: number }).elevation,
      3,
    );
  });

  it("returns every learner-controlled value, including the camera, to the narration", () => {
    const { created } = instance();
    const parameters = new Set(created.handles().flatMap((handle) => handle.params));

    for (const parameter of parameters) expect(schema[parameter]!.ownership).toBe("script");
  });

  it("defines low terrain shots and a near-top path shot", () => {
    const camera = (name: string) => presets[name]!.camera as { elevation: number };

    expect(camera("pathView").elevation).toBeGreaterThan(1.1);
    for (const name of ["roundBowlView", "ravineView", "roughnessView"]) {
      expect(camera(name).elevation).toBeLessThan(0.6);
    }
    expect(scene.presets).toBe(presets);
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

  it("confines camera navigation to the landscape", () => {
    const { created } = instance();
    const camera = created.handles().find((handle) => handle.id === "camera-orbit")!;
    const box = landscapeBox({ width: 1000, height: 600 });

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
