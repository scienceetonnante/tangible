// Load and type the lesson.yaml manifest (ARCHITECTURE §2.5).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export interface Manifest {
  id: string;
  title: Record<string, string>;
  scene: string;
  languages: string[];
  voice: Record<string, string>;
  defaults: { anticipation: number; ease: string; transition: number };
  tts?: { speed?: number };
}

export async function loadManifest(lessonDir: string): Promise<Manifest> {
  const text = await readFile(join(lessonDir, "lesson.yaml"), "utf8");
  return parseYaml(text) as Manifest;
}
