// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { Handle, PlainState } from "@narrable/core";
import { ScenePreview } from "./scene-preview.js";
import type { SceneContext, SceneModule, SceneFrame } from "./scene-host.js";

function pointer(type: string, x: number, y: number): PointerEvent {
  return new MouseEvent(type, { clientX: x, clientY: y }) as unknown as PointerEvent;
}

function fixture() {
  const rendered: PlainState[] = [];
  const frames: SceneFrame[] = [];
  let context: SceneContext | undefined;
  let disposed = false;
  const handle: Handle = {
    id: "theta",
    params: ["theta"],
    hitTest: () => true,
    onDrag: (x) => ({ theta: x / 100 }),
  };
  const scene: SceneModule = {
    schema: {
      theta: { type: { kind: "scalar", range: [0, 10] }, default: 1, interpolate: "lerp", ownership: "script" },
    },
    create: (ctx) => {
      context = ctx;
      return {
        render: (state, frame) => {
          rendered.push({ ...state });
          frames.push(frame);
        },
        handles: () => [handle],
        dispose: () => {
          disposed = true;
        },
      };
    },
  };
  return { scene, rendered, frames, context: () => context!, disposed: () => disposed };
}

describe("ScenePreview", () => {
  it("renders schema defaults without lesson-only DOM", () => {
    const mount = document.createElement("main");
    const { scene, rendered } = fixture();
    const preview = new ScenePreview({ mount, scene });

    preview.render(0);

    expect(rendered).toEqual([{ theta: 1 }]);
    expect(mount.querySelector(".xv-player canvas")).toBeTruthy();
    expect(mount.querySelector("audio")).toBeNull();
    expect(mount.querySelector(".xv-chrome")).toBeNull();
    expect(mount.querySelector(".xv-board")).toBeNull();
    expect(mount.querySelector(".xv-captions")).toBeNull();
    preview.dispose();
  });

  it("keeps handle and scene-control writes until reset", () => {
    const mount = document.createElement("main");
    const data = fixture();
    const preview = new ScenePreview({ mount, scene: data.scene });
    const canvas = mount.querySelector("canvas")!;

    canvas.dispatchEvent(pointer("pointerdown", 200, 100));
    canvas.dispatchEvent(pointer("pointerup", 200, 100));
    expect(preview.store.plain.theta).toBe(2);
    preview.render();
    expect(data.frames.at(-1)!.activity.theta!.source).toBe("user");
    expect(data.frames.at(-1)!.activity.theta!.strength).toBeGreaterThan(0.99);

    data.context().write("theta", 7);
    expect(preview.store.plain.theta).toBe(7);
    data.context().reset("theta");
    expect(preview.store.plain.theta).toBe(1);

    preview.dispose();
    expect(data.disposed()).toBe(true);
    expect(mount.children).toHaveLength(0);
  });
});
