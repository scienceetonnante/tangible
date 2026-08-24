// `lesson new <id>` — scaffold the technical lesson files.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ScaffoldOptions {
  dir?: string; // target directory (default: <cwd>/<id>)
}

export async function scaffold(id: string, opts: ScaffoldOptions = {}): Promise<void> {
  const dir = opts.dir ?? join(process.cwd(), id);
  await mkdir(join(dir, "assets"), { recursive: true });
  await mkdir(join(dir, "scenes"), { recursive: true });

  await writeFile(join(dir, "lesson.yaml"), MANIFEST(id));
  await writeFile(join(dir, "scenes", "scene.ts"), SCENE);
  await writeFile(join(dir, "script.md"), SCRIPT);
  console.error(`scaffolded ${dir}/ (lesson.yaml, scenes/scene.ts, script.md)`);
}

const MANIFEST = (id: string) => `id: ${id}
title: ${id}
scene: ./scenes/scene.ts
defaults:
  anticipation: -0.2
  ease: inOutCubic
  transition: 1.0
tts:
  provider: elevenlabs
  voice: VOICE_ID
  model: eleven_multilingual_v2
`;

const SCENE = `import type { Schema } from "@narrable/core";

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["main"] }, default: "main", interpolate: "snap", ownership: "script" },
  // Add drivable parameters here.
};

export const constants: Record<string, number | number[]> = {};
`;

const SCRIPT = `---
title: Title
---

@scene(main)
@chapter(Introduction)

Write the spoken narration here.
[[Describe the visual change and the phrase it should support.]]
`;
