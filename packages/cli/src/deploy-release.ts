// Validate the Space card and stage the exact local release artifact.

import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Manifest } from "./manifest.js";

export interface SpaceCard {
  sdk: "docker" | "static";
}

export interface StagedRelease {
  root: string;
  path: string;
  files: number;
  bytes: number;
}

const BUILD_SECRET_NAMES = ["HF_TOKEN", "HF_TTS_TOKEN", "TTS_ENDPOINT_URL", "ELEVENLABS_API_KEY"];

export async function readSpaceCard(lessonDir: string, manifest: Manifest): Promise<SpaceCard> {
  const path = join(lessonDir, "space", "README.md");
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    throw new Error("lesson deploy requires space/README.md");
  }
  const frontMatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontMatter) throw new Error("space/README.md must begin with YAML front matter");
  const data = parseYaml(frontMatter[1]!) as Record<string, unknown> | null;
  const expected = manifest.assistant ? "docker" : "static";
  if (data?.sdk !== expected) {
    throw new Error(`space/README.md must declare "sdk: ${expected}" for this lesson`);
  }
  if (expected === "docker" && data.app_port !== 7860) {
    throw new Error("a Docker lesson Space must declare \"app_port: 7860\"");
  }
  if (expected === "static" && data.app_file !== "index.html") {
    throw new Error("a static lesson Space must declare \"app_file: index.html\"");
  }
  return { sdk: expected };
}

export async function stageRelease(lessonDir: string): Promise<StagedRelease> {
  const siteDir = join(lessonDir, "build", "site");
  const root = await mkdtemp(join(tmpdir(), "tangible-space-"));
  const path = join(root, "release");
  await mkdir(path);
  try {
    const siteEntries = await readdir(siteDir, { withFileTypes: true });
    if (!siteEntries.some((entry) => entry.name === "index.html" && entry.isFile())) {
      throw new Error("real lesson build did not produce build/site/index.html");
    }
    for (const entry of siteEntries) {
      await cp(join(siteDir, entry.name), join(path, entry.name), { recursive: true });
    }
    await copyFile(join(lessonDir, "space", "README.md"), join(path, "README.md"));
    await copyFile(join(lessonDir, "space", ".gitattributes"), join(path, ".gitattributes"));
    const summary = await inspectRelease(path);
    return { root, path, ...summary };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function inspectRelease(root: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const secrets = BUILD_SECRET_NAMES.flatMap((name) => {
    const value = process.env[name];
    return value && value.length >= 8 ? [{ name, value: Buffer.from(value) }] : [];
  });

  async function visit(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const rel = relative(root, path);
      if (entry.isSymbolicLink()) throw new Error(`release artifact must not contain symbolic link "${rel}"`);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === ".cache") throw new Error(`release artifact must not contain "${rel}"`);
        await visit(path);
        continue;
      }
      if (!entry.isFile()) throw new Error(`release artifact contains unsupported entry "${rel}"`);
      if (entry.name === ".env" || entry.name.startsWith(".env.")) throw new Error(`release artifact must not contain "${rel}"`);
      const content = await readFile(path);
      for (const secret of secrets) {
        if (content.includes(secret.value)) throw new Error(`release artifact "${rel}" contains the local ${secret.name} value`);
      }
      files += 1;
      bytes += (await stat(path)).size;
    }
  }

  await visit(root);
  return { files, bytes };
}
