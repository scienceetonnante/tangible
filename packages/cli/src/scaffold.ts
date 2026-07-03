// `lesson new <id>` — scaffold a lesson directory with a manifest, a template scene,
// and a script skeleton. Honors --lesson <dir> (target location) and --lang <code>.

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

Write the narration here. Directives like \\@show(something) are stripped
before speech synthesis and anchored to the word that follows them.
`;
