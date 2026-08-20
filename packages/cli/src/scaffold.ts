// `lesson new <id>` — scaffold the human brief and technical lesson files.

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

  await writeFile(join(dir, "brief.md"), BRIEF(id));
  await writeFile(join(dir, "lesson.yaml"), MANIFEST(id, lang));
  await writeFile(join(dir, "scene.ts"), SCENE);
  await writeFile(join(dir, `script.${lang}.md`), SCRIPT(lang));
  console.error(`scaffolded ${dir}/ (brief.md, lesson.yaml, scene.ts, script.${lang}.md)`);
}

const BRIEF = (id: string) => `# ${id}

## Learners and objective

- Intended learners and prior knowledge:
- After this lesson, learners should be able to explain:
- Common misconception or difficulty:
- Out of scope:

## Explorable relationship

- When the learner changes ___, ___ changes because ___:
- Primary learner action:
- Boundary or revealing case:
- What remains invariant:

## Guided story

1. Opening question:
2. Baseline:
3. Revealing contrast:
4. Prediction and exploration pause:
5. Formalization:
6. Transfer:

## Review criteria

- What response would demonstrate understanding:
- Why an ordinary figure or video is insufficient:
- Smallest useful version:
- Accessibility concerns:
`;

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
