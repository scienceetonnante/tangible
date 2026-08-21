import { describe, it, expect } from "vitest";
import { pointOnCircle, scene } from "./scene.js";

describe("unit-circle geometry", () => {
  it("pointOnCircle follows the math convention", () => {
    expect(pointOnCircle(0)).toEqual({ x: 1, y: 0 });
    const q = pointOnCircle(Math.PI / 2);
    expect(q.x).toBeCloseTo(0, 12);
    expect(q.y).toBeCloseTo(1, 12);
  });
});

// A recording 2D-context stub (jsdom has no canvas implementation).
function recordingCtx() {
  const calls: string[] = [];
  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (_t, prop) => () => calls.push(String(prop)),
    set: () => true,
  };
  const g = new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
  return { g, calls };
}

describe("unit-circle render smoke", () => {
  it("renders without error and issues drawing calls", () => {
    const { g, calls } = recordingCtx();
    const canvas = { getContext: () => g } as unknown as HTMLCanvasElement;
    const inst = scene.create({ canvas, overlay: {} as HTMLElement, viewport: () => ({ width: 400, height: 400 }) });
    inst.render({ theta: 1, "show.projection": true, "show.thetaLabel": true, "show.cosLabel": true }, 0.016);
    expect(calls).toContain("clearRect");
    expect(calls).toContain("arc"); // the circle + point
    expect(calls).toContain("fillText"); // labels
    expect(inst.handles()).toHaveLength(1); // draggable point
  });
});

describe("unit-circle point handle", () => {
  const canvas = { getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) } as unknown as HTMLCanvasElement;
  const inst = scene.create({ canvas, overlay: {} as HTMLElement, viewport: () => ({ width: 400, height: 400 }) });
  const handle = inst.handles()[0]!;

  it("hit-tests near the point at the current theta", () => {
    // theta=0 → point at (cx+R, cy) = (200+160, 200) = (360, 200)
    expect(handle.hitTest(360, 200, { theta: 0 })).toBe(true);
    expect(handle.hitTest(200, 200, { theta: 0 })).toBe(false);
  });

  it("maps a drag to theta = atan2 (0..2π)", () => {
    // straight up from center (200,120) → theta = π/2
    expect((handle.onDrag(200, 120, { theta: 0 }).theta as number)).toBeCloseTo(Math.PI / 2, 6);
    // straight down → theta = 3π/2 (normalized positive)
    expect((handle.onDrag(200, 280, { theta: 0 }).theta as number)).toBeCloseTo((3 * Math.PI) / 2, 6);
  });
});
