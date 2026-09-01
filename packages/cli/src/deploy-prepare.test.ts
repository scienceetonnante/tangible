import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadManifest } from "./manifest.js";
import { prepareSpace } from "./deploy-prepare.js";

const BASE = `id: example
title: Example lesson
promise: See how the example changes.
scene: ./scenes/scene.ts
defaults:
  anticipation: -0.2
  ease: linear
  transition: 1
`;

async function fixture(extra = "") {
  const dir = await mkdtemp(join(tmpdir(), "tangible-space-prepare-"));
  await writeFile(join(dir, "lesson.yaml"), BASE + extra);
  return dir;
}

describe("Space preparation", () => {
  it("prepares a static Space without contacting Hugging Face", async () => {
    const dir = await fixture();
    try {
      const result = await prepareSpace(dir, await loadManifest(dir), "example/my-lesson");
      expect(result.changed).toEqual(["lesson.yaml", "space/README.md", "space/.gitattributes"]);
      expect((await loadManifest(dir)).deployment?.space).toBe("example/my-lesson");
      const card = await readFile(join(dir, "space", "README.md"), "utf8");
      expect(card).toContain("sdk: static");
      expect(card).toContain("app_file: index.html");
      expect(card).toContain("header: default");
      const attributes = await readFile(join(dir, "space", ".gitattributes"), "utf8");
      expect(attributes).toContain("*.webm filter=lfs");
      expect(attributes).toContain("*.m4a filter=lfs");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prepares a Docker Space when the lesson has an assistant", async () => {
    const dir = await fixture(`assistant:
  provider: huggingface
  model: test/model:provider
  context: assistant.md
  commandable: []
`);
    try {
      await prepareSpace(dir, await loadManifest(dir), "example/assisted-lesson");
      const card = await readFile(join(dir, "space", "README.md"), "utf8");
      expect(card).toContain("sdk: docker");
      expect(card).toContain("app_port: 7860");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("preserves a valid custom card and completes existing LFS rules", async () => {
    const dir = await fixture(`deployment:
  provider: huggingface
  space: example/my-lesson
`);
    try {
      await mkdir(join(dir, "space"));
      const custom = `---\ntitle: Custom card\nsdk: static\napp_file: index.html\n---\n\nCustom body.\n`;
      await writeFile(join(dir, "space", "README.md"), custom);
      await writeFile(join(dir, "space", ".gitattributes"), "*.webm filter=lfs diff=lfs merge=lfs -text\n");
      const result = await prepareSpace(dir, await loadManifest(dir), "example/my-lesson");
      expect(result.changed).toEqual(["space/.gitattributes"]);
      expect(await readFile(join(dir, "space", "README.md"), "utf8")).toBe(custom);
      const attributes = await readFile(join(dir, "space", ".gitattributes"), "utf8");
      expect(attributes.match(/\*\.webm/g)).toHaveLength(1);
      expect(attributes).toContain("*.wav filter=lfs");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses to replace a different deployment target", async () => {
    const dir = await fixture(`deployment:
  provider: huggingface
  space: example/original
`);
    try {
      await expect(prepareSpace(dir, await loadManifest(dir), "example/replacement")).rejects.toThrow(
        "already targets",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
