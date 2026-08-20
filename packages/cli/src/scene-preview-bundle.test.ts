import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleScenePreview } from "./scene-preview-bundle.js";
import { loadSceneManifest } from "./manifest.js";

describe("scene preview bundle", () => {
  it("builds from a minimal manifest and scene without narration files", async () => {
    const lessonDir = await mkdtemp(join(tmpdir(), "narrable-scene-preview-"));
    await writeFile(join(lessonDir, "lesson.yaml"), "id: bare-scene\nscene: ./scene.ts\n");
    await writeFile(
      join(lessonDir, "scene.ts"),
      `export const schema = {};
export const scene = { schema, create: () => ({ render() {}, handles: () => [], dispose() {} }) };
`,
    );

    const manifest = await loadSceneManifest(lessonDir);
    const result = await bundleScenePreview(lessonDir, manifest.id, manifest.scene);

    expect(await readFile(join(result.siteDir, "index.html"), "utf8")).toContain("bare-scene scene preview");
    expect(await readFile(join(result.siteDir, "scene.js"), "utf8")).toContain("ScenePreview");
    expect(result.watchPaths).toEqual([join(lessonDir, "scene.ts")]);
  });
});
