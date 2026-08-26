import { describe, it, expect } from "vitest";
import { SceneHost, type SceneModule, type SceneContext, type SceneFrame } from "./scene-host.js";
import type { PlainState } from "@tangible/core";

function fakeCtx(): SceneContext {
  return {
    canvas: {} as HTMLCanvasElement,
    overlay: {} as HTMLElement,
    viewport: () => ({ width: 800, height: 600 }),
    write: () => {},
    reset: () => {},
    pause: () => {},
  };
}

describe("SceneHost", () => {
  it("creates the instance and forwards render/handles/dispose", () => {
    const seen: { state: PlainState; frame: SceneFrame }[] = [];
    let disposed = false;
    const module: SceneModule = {
      schema: {},
      create: () => ({
        render: (state, frame) => seen.push({ state: { ...state }, frame }),
        handles: () => [],
        dispose: () => {
          disposed = true;
        },
      }),
    };
    const host = new SceneHost(module, fakeCtx());
    const frame = { dt: 0.016, activity: { theta: { source: "narration" as const, strength: 1 } } };
    host.render({ theta: 1 }, frame);
    expect(seen).toEqual([{ state: { theta: 1 }, frame }]);
    expect(host.handles()).toEqual([]);
    host.dispose();
    expect(disposed).toBe(true);
  });
});
