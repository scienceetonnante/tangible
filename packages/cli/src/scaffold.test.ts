import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scaffold } from "./scaffold.js";

describe("scaffold", () => {
  it("creates a lesson skeleton", async () => {
    const root = await mkdtemp(join(tmpdir(), "narrable-scaffold-"));
    const dir = join(root, "my-lesson");
    try {
      await scaffold("my-lesson", { dir });

      expect(await readFile(join(dir, "lesson.yaml"), "utf8")).toContain("title: my-lesson");
      expect(await readFile(join(dir, "lesson.yaml"), "utf8")).toContain("scene: ./scenes/scene.ts");
      expect(await readFile(join(dir, "scenes", "scene.ts"), "utf8")).toContain("export const schema");
      expect(await readFile(join(dir, "script.md"), "utf8")).toContain("[[Describe the visual change");
      expect((await stat(join(dir, "assets"))).isDirectory()).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
