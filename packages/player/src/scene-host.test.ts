import { describe, it, expect } from "vitest";
import { SceneHost, type SceneModule, type SceneContext } from "./scene-host.js";
import type { PlainState } from "@narrable/core";

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
    const seen: PlainState[] = [];
    let disposed = false;
    const module: SceneModule = {
      schema: {},
      create: () => ({
        render: (state) => seen.push({ ...state }),
        handles: () => [],
        dispose: () => {
          disposed = true;
        },
      }),
    };
    const host = new SceneHost(module, fakeCtx());
    host.render({ theta: 1 }, 0.016);
    expect(seen).toEqual([{ theta: 1 }]);
    expect(host.handles()).toEqual([]);
    host.dispose();
    expect(disposed).toBe(true);
  });
});
