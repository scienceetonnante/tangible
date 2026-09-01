// Prepare authored Hugging Face Space metadata without contacting the Hub.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDocument } from "yaml";
import type { Manifest } from "./manifest.js";
import { readSpaceCard } from "./deploy-release.js";

const LFS_RULES = [
  "*.webm filter=lfs diff=lfs merge=lfs -text",
  "*.m4a filter=lfs diff=lfs merge=lfs -text",
  "*.mp3 filter=lfs diff=lfs merge=lfs -text",
  "*.wav filter=lfs diff=lfs merge=lfs -text",
];

export interface PreparedSpace {
  space: string;
  changed: string[];
}

export async function prepareSpace(lessonDir: string, manifest: Manifest, space: string): Promise<PreparedSpace> {
  validateSpaceId(space);
  if (manifest.deployment && manifest.deployment.space !== space) {
    throw new Error(
      `lesson.yaml already targets "${manifest.deployment.space}"; change it explicitly before preparing "${space}"`,
    );
  }

  const preparedManifest: Manifest = {
    ...manifest,
    deployment: { provider: "huggingface", space },
  };
  const cardPath = join(lessonDir, "space", "README.md");
  if (existsSync(cardPath)) await readSpaceCard(lessonDir, preparedManifest);

  const manifestPath = join(lessonDir, "lesson.yaml");
  const manifestText = await readFile(manifestPath, "utf8");
  const doc = parseDocument(manifestText);
  if (doc.errors.length) throw new Error(`could not update lesson.yaml: ${doc.errors[0]!.message}`);

  const changed: string[] = [];
  if (!manifest.deployment) {
    doc.set("deployment", { provider: "huggingface", space });
    await writeFile(manifestPath, String(doc));
    changed.push("lesson.yaml");
  }

  await mkdir(join(lessonDir, "space"), { recursive: true });
  if (!existsSync(cardPath)) {
    await writeFile(cardPath, spaceCard(preparedManifest));
    changed.push("space/README.md");
  }

  const attributesPath = join(lessonDir, "space", ".gitattributes");
  const attributes = existsSync(attributesPath) ? await readFile(attributesPath, "utf8") : "";
  const lines = new Set(attributes.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  const missing = LFS_RULES.filter((rule) => !lines.has(rule));
  if (missing.length) {
    const prefix = attributes && !attributes.endsWith("\n") ? "\n" : "";
    await writeFile(attributesPath, `${attributes}${prefix}${missing.join("\n")}\n`);
    changed.push("space/.gitattributes");
  }

  return { space, changed };
}

function validateSpaceId(space: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(space)) {
    throw new Error('--space must use the "namespace/name" form');
  }
}

function spaceCard(manifest: Manifest): string {
  const runtime = manifest.assistant ? "sdk: docker\napp_port: 7860" : "sdk: static\napp_file: index.html";
  const shortDescription = `${manifest.promise.trim().replace(/\.$/, "")} — an interactive Tangible lesson`;
  const tags = [...new Set(["tangible", "education", "interactive-learning", ...(manifest.tags ?? [])])]
    .map((tag) => `  - ${JSON.stringify(tag)}`)
    .join("\n");
  return `---
title: ${JSON.stringify(manifest.title)}
emoji: 📚
colorFrom: blue
colorTo: indigo
${runtime}
fullWidth: true
header: default
pinned: false
short_description: ${JSON.stringify(shortDescription)}
tags:
${tags}
---

# ${manifest.title}

${manifest.promise}

This interactive narrated lesson was built with
[Tangible](https://github.com/scienceetonnante/tangible).
`;
}
