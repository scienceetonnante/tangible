import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleScenePreview } from "./scene-preview-bundle.js";
import { loadSceneManifest } from "./manifest.js";

describe("scene preview bundle", () => {
  it("builds from a minimal manifest and scene without narration files", async () => {
    const lessonDir = await mkdtemp(join(tmpdir(), "tangible-scene-preview-"));
    await mkdir(join(lessonDir, "scenes"));
    await writeFile(join(lessonDir, "lesson.yaml"), "id: bare-scene\nscene: ./scenes/scene.ts\n");
    await writeFile(
      join(lessonDir, "scenes", "scene.ts"),
      `export const schema = {};
export const scene = { schema, create: () => ({ render() {}, handles: () => [], dispose() {} }) };
`,
    );

    const manifest = await loadSceneManifest(lessonDir);
    const result = await bundleScenePreview(lessonDir, manifest.id, manifest.scene);

    const html = await readFile(join(result.siteDir, "index.html"), "utf8");
    expect(html).toContain("bare-scene scene preview");
    expect(html).toContain("#app { width: 100%; }");
    expect(html).not.toContain("max-width");
    expect(await readFile(join(result.siteDir, "scene.js"), "utf8")).toContain("ScenePreview");
    expect(result.watchPaths).toEqual([join(lessonDir, "scenes", "scene.ts")]);
  });
});
