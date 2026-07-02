// `lesson new <id>` — scaffold a lesson directory with a manifest, a template scene,
// and a script skeleton.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function scaffold(id: string): Promise<void> {
  const dir = join(process.cwd(), id);
  await mkdir(join(dir, "assets"), { recursive: true });

  await writeFile(join(dir, "lesson.yaml"), MANIFEST(id));
  await writeFile(join(dir, "scene.ts"), SCENE);
  await writeFile(join(dir, "script.fr.md"), SCRIPT);
  console.error(`scaffolded lessons/${id}/ (lesson.yaml, scene.ts, script.fr.md)`);
}

const MANIFEST = (id: string) => `id: ${id}
title:
  fr: ${id}
scene: ./scene.ts
languages: [fr]
voice:
  fr: elevenlabs:VOICE_ID_FR
defaults:
  anticipation: -0.2
  ease: inOutCubic
  transition: 1.0
`;

const SCENE = `import type { Schema } from "@xv/core";

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["main"] }, default: "main", interpolate: "snap", ownership: "script" },
  // Add drivable parameters here.
};

export const constants: Record<string, number | number[]> = {};
`;

const SCRIPT = `---
title: Titre
language: fr
---

@scene(main)
@chapter(Introduction)

Écrivez la narration ici. Les directives comme @show(quelque_chose) sont
retirées avant la synthèse vocale et ancrées au mot qui les suit.
`;
