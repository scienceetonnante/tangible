// Load and type the lesson.yaml manifest.

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
  assistant?: {
    context: Record<string, string>;
    commandable: string[];
  };
}

export interface SceneManifest {
  id: string;
  scene: string;
}

export async function loadManifest(lessonDir: string): Promise<Manifest> {
  const text = await readFile(join(lessonDir, "lesson.yaml"), "utf8");
  return parseYaml(text) as Manifest;
}

/** Load only the manifest fields needed for narration-free scene development. */
export async function loadSceneManifest(lessonDir: string): Promise<SceneManifest> {
  const text = await readFile(join(lessonDir, "lesson.yaml"), "utf8");
  const manifest = parseYaml(text) as Partial<SceneManifest> | undefined;
  if (!manifest || typeof manifest.id !== "string") throw new Error('lesson.yaml must define a string "id"');
  if (typeof manifest.scene !== "string") throw new Error('lesson.yaml must define a string "scene"');
  return { id: manifest.id, scene: manifest.scene };
}
