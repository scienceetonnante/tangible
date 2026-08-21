// `lesson new <id>` — scaffold the technical lesson files.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ScaffoldOptions {
  dir?: string; // target directory (default: <cwd>/<id>)
  lang?: string; // skeleton language (default: en)
}

export async function scaffold(id: string, opts: ScaffoldOptions = {}): Promise<void> {
  const lang = opts.lang ?? "en";
  const dir = opts.dir ?? join(process.cwd(), id);
  await mkdir(join(dir, "assets"), { recursive: true });

  await writeFile(join(dir, "lesson.yaml"), MANIFEST(id, lang));
  await writeFile(join(dir, "scene.ts"), SCENE);
  await writeFile(join(dir, `script.${lang}.md`), SCRIPT(lang));
  console.error(`scaffolded ${dir}/ (lesson.yaml, scene.ts, script.${lang}.md)`);
}

const MANIFEST = (id: string, lang: string) => `id: ${id}
title:
  ${lang}: ${id}
scene: ./scene.ts
languages: [${lang}]
voice:
  ${lang}: elevenlabs:VOICE_ID
defaults:
  anticipation: -0.2
  ease: inOutCubic
  transition: 1.0
`;

const SCENE = `import type { Schema } from "@narrable/core";

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["main"] }, default: "main", interpolate: "snap", ownership: "script" },
  // Add drivable parameters here.
};

export const constants: Record<string, number | number[]> = {};
`;

const SCRIPT = (lang: string) => `---
title: Title
language: ${lang}
---

@scene(main)
@chapter(Introduction)

Write the spoken narration here.
[[Describe the visual change and the phrase it should support.]]
`;
