import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadScene } from "./scene-loader.js";
import { refSheet } from "./ref.js";

const SCENE_PATH = join(process.cwd(), "lessons/unit-circle/scenes/scene.ts");
const OPTIMIZER_SCENE_PATH = join(process.cwd(), "lessons/optimizers/scenes/scene.ts");

describe("loadScene", () => {
  it("transpiles and imports a scene.ts schema in Node", async () => {
    const scene = await loadScene(SCENE_PATH);
    expect(Object.keys(scene.schema)).toContain("theta");
    expect(scene.schema.theta!.type.kind).toBe("scalar");
    expect(scene.presets?.sideView).toBeDefined();
    expect(scene.constants?.HALF_PI).toBe(1.5708);
  });

  it("loads a Three.js scene without instantiating its renderer", async () => {
    const scene = await loadScene(OPTIMIZER_SCENE_PATH);
    expect(scene.schema.camera!.type.kind).toBe("orbit");
    expect(scene.schema.kappa!.type.kind).toBe("scalar");
  });

  it("rejects a schema-only module when runtime validation is required", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tangible-runtime-check-"));
    const path = join(dir, "scene.ts");
    await writeFile(path, `export const schema = { scene: { type: { kind: "enum", values: ["main"] }, default: "main", interpolate: "snap", ownership: "script" } };`);
    await expect(loadScene(path, { requireRuntime: true })).rejects.toThrow('does not export a runtime "scene"');
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
