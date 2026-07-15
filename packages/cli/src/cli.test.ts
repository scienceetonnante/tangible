import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { loadScene } from "./scene-loader.js";
import { refSheet } from "./ref.js";

const SCENE_PATH = join(process.cwd(), "lessons/unit-circle/scene.ts");

describe("loadScene", () => {
  it("transpiles and imports a scene.ts schema in Node", async () => {
    const scene = await loadScene(SCENE_PATH);
    expect(Object.keys(scene.schema)).toContain("theta");
    expect(scene.schema.theta!.type.kind).toBe("scalar");
    expect(scene.presets?.sideView).toBeDefined();
    expect(scene.constants?.HALF_PI).toBe(1.5708);
  });
});

describe("refSheet", () => {
  it("renders parameters, presets, and constants as Markdown", async () => {
    const scene = await loadScene(SCENE_PATH);
    const md = refSheet("unit-circle", scene);
    expect(md).toContain("| `theta` | scalar | [0, 6.2832] |");
    expect(md).toContain("- `sideView`");
    expect(md).toContain("- `HALF_PI` = `1.5708`");
  });

  it("renders baker dependencies as Markdown", async () => {
    const scene = await loadScene(SCENE_PATH);
    const md = refSheet("unit-circle", {
      ...scene,
      bakers: {
        advance: {
          reads: ["theta"],
          writes: ["theta"],
          run: (input) => [{ theta: input.theta! }],
        },
      },
    });
    expect(md).toContain("## Bakers");
    expect(md).toContain("- `advance`: reads [`theta`] → writes [`theta`]");
  });
});
