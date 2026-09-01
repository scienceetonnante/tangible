import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scaffold } from "./scaffold.js";

describe("scaffold", () => {
  it("creates a lesson skeleton", async () => {
    const root = await mkdtemp(join(tmpdir(), "tangible-scaffold-"));
    const dir = join(root, "my-lesson");
    try {
      await scaffold("my-lesson", { dir });

      const manifest = await readFile(join(dir, "lesson.yaml"), "utf8");
      expect(manifest).toContain('title: "My lesson"');
      expect(manifest).toContain("promise: Move the slider");
      expect(manifest).toContain("scene: ./scenes/scene.ts");
      expect(manifest).not.toContain("tts:");
      const scene = await readFile(join(dir, "scenes", "scene.ts"), "utf8");
      expect(scene).toContain("export const schema");
      expect(scene).toContain("export const scene");
      expect(scene).toContain('ctx.write("amount"');
      const script = await readFile(join(dir, "script.md"), "utf8");
      expect(script).toContain("@cue(amount -> 80");
      expect(script).toContain("@pause(");
      expect((await stat(join(dir, "assets"))).isDirectory()).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite an existing lesson directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "tangible-scaffold-existing-"));
    try {
      await expect(scaffold("existing", { dir: root })).rejects.toThrow("refuses to overwrite");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
