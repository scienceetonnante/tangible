import { buildIndex, type OrbitState, type PlainState } from "../../../packages/core/src/index.js";
import { Reconciler } from "../../../packages/player/src/reconciler.js";
import { StateStore } from "../../../packages/player/src/store.js";
import { describe, expect, it } from "vitest";
import { scene, schema } from "./scene.js";
import { algorithmGroupBox, landscapeBox, lossPlotBox, sliderBox, SLIDERS, stepBox } from "./view.js";

function recordingContext() {
  const calls: string[] = [];
  const texts: string[] = [];
  const textPositions: { text: string; x: number; y: number }[] = [];
  const segments: [number, number, number, number][] = [];
  const arcs: number[] = [];
  let start: [number, number] | undefined;
  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (_target, property) => (...args: unknown[]) => {
      calls.push(String(property));
      if (property === "fillText") {
        const text = String(args[0]);
        texts.push(text);
        textPositions.push({ text, x: Number(args[1]), y: Number(args[2]) });
      }
      if (property === "moveTo") start = [Number(args[0]), Number(args[1])];
      if (property === "lineTo" && start) {
        segments.push([start[0], start[1], Number(args[0]), Number(args[1])]);
      }
      if (property === "arc") arcs.push(Number(args[2]));
    },
    set: () => true,
  };
  return {
    context: new Proxy({}, handler) as unknown as CanvasRenderingContext2D,
    calls,
    texts,
    textPositions,
    segments,
    arcs,
  };
}

function defaultState(): PlainState {
  return Object.fromEntries(Object.entries(schema).map(([key, spec]) => [key, structuredClone(spec.default)]));
}

function instance(width = 1000, height = 600) {
  const { context, calls, texts, textPositions, segments, arcs } = recordingContext();
  const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;
  const created = scene.create({ canvas, overlay: {} as HTMLElement, viewport: () => ({ width, height }) });
  return { created, calls, texts, textPositions, segments, arcs };
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
    const moved: OrbitState = { target: [0, 0.65, 0], distance: 6.8, azimuth: 1.05, elevation: 0.36 };

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

  it("defines a near-top default camera", () => {
    expect((schema.camera.default as OrbitState).elevation).toBeGreaterThan(1.1);
  });

  it("widens the surface and narrows the algorithm column", () => {
    const view = { width: 1280, height: 720 };
    const landscape = landscapeBox(view);
    const algorithm = algorithmGroupBox(view, "sgd");

    expect(landscape.width / landscape.height).toBeCloseTo(1.3, 6);
    expect(algorithm.width).toBeCloseTo(view.width * 0.2, 6);
    expect(algorithm.x).toBeGreaterThan(landscape.x + landscape.width);
  });

  it("aligns the step slider with the loss graph", () => {
    const view = { width: 1000, height: 600 };
    const plot = lossPlotBox(view);
    const step = stepBox(view);

    expect(step.x0).toBe(plot.x);
    expect(step.x1).toBe(plot.x + plot.width);
  });

  it("renders the terrain, trajectories, plots, and controls", () => {
    const { created, calls, texts, arcs } = instance();
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
    expect(calls).toContain("rotate");
    expect(created.handles()).toHaveLength(12);
    expect(texts).toContain("Loss");
    expect(texts).toContain("step 24");
    expect(texts.some((text) => text.startsWith("matched step"))).toBe(false);
    expect(texts.some((text) => text.startsWith("stable while"))).toBe(false);
    expect(texts.some((text) => text.startsWith("L "))).toBe(false);
    expect(arcs.some((radius) => Math.abs(radius - 600 * 0.0112) < 1e-9)).toBe(true);
    expect(arcs.some((radius) => Math.abs(radius - 600 * 0.012) < 1e-9)).toBe(true);
  });

  it("shows script-ready camera values in degrees", () => {
    const { created, texts, textPositions } = instance();
    created.render(
      {
        ...defaultState(),
        camera: {
          target: [1, -0.5, 2.25],
          distance: 6.8,
          azimuth: Math.PI / 3,
          elevation: Math.PI / 6,
        },
      },
      0.016,
    );

    expect(texts).toContain(
      "[1.00,-0.50,2.25] · d=6.80 · az. 60° · el. 30°",
    );
    expect(texts).toContain("drag to orbit · scroll to zoom");
    const hint = textPositions.find((entry) => entry.text === "drag to orbit · scroll to zoom")!;
    const readout = textPositions.find((entry) => entry.text.startsWith("[1.00,-0.50,2.25]"))!;
    const landscape = landscapeBox({ width: 1000, height: 600 });
    expect(hint.x).toBe(landscape.x + landscape.width);
    expect(hint.y).toBe(readout.y);
  });

  it("separates the camera and interaction text in a compact viewport", () => {
    const { created, textPositions } = instance(390, 219);
    created.render(defaultState(), 0.016);
    const hint = textPositions.find((entry) => entry.text === "drag to orbit · scroll to zoom")!;
    const readout = textPositions.find((entry) => entry.text.startsWith("["))!;

    expect(hint.y).toBeLessThan(readout.y);
  });

  it("draws a vertical loss-plot guide every five steps", () => {
    const { created, segments } = instance();
    created.render(defaultState(), 0.016);
    const plot = lossPlotBox({ width: 1000, height: 600 });
    const firstGuide = plot.x + (5 / 60) * plot.width;

    expect(
      segments.some(
        ([x1, y1, x2, y2]) =>
          Math.abs(x1 - firstGuide) < 1e-6 &&
          Math.abs(x2 - firstGuide) < 1e-6 &&
          y1 === plot.y &&
          y2 === plot.y + plot.height,
      ),
    ).toBe(true);
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
