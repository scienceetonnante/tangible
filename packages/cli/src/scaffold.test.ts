import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scaffold } from "./scaffold.js";

describe("scaffold", () => {
  it("creates a brief-first lesson skeleton", async () => {
    const root = await mkdtemp(join(tmpdir(), "narrable-scaffold-"));
    const dir = join(root, "my-lesson");
    try {
      await scaffold("my-lesson", { dir, lang: "fr" });

      expect(await readFile(join(dir, "brief.md"), "utf8")).toContain("## Explorable relationship");
      expect(await readFile(join(dir, "lesson.yaml"), "utf8")).toContain("languages: [fr]");
      expect(await readFile(join(dir, "script.fr.md"), "utf8")).toContain("[[Describe the visual change");
      expect((await stat(join(dir, "assets"))).isDirectory()).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
