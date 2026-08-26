// Build the deterministic context consumed by the runtime lesson
// assistant. Layout/control semantics are authored; scene data is generated.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseScript, type SceneInfo } from "@tangible/compiler";
import type { AssistantContext } from "@tangible/core";
import type { Manifest } from "./manifest.js";

export async function emitAssistantContext(
  lessonDir: string,
  manifest: Manifest,
  scene: SceneInfo,
  script: string,
): Promise<void> {
  const context = await buildAssistantContext(lessonDir, manifest, scene, script);
  if (!context) return;
  await writeFile(join(lessonDir, "build", "lesson", "assistant.json"), JSON.stringify(context, null, 2) + "\n");
}

export async function buildAssistantContext(
  lessonDir: string,
  manifest: Manifest,
  scene: SceneInfo,
  script: string,
): Promise<AssistantContext | undefined> {
  const config = manifest.assistant;
  if (!config) return undefined;

  for (const param of config.commandable) {
    if (!scene.schema[param]) throw new Error(`assistant.commandable references unknown parameter "${param}"`);
  }

  return {
    version: 1,
    lessonId: manifest.id,
    title: manifest.title,
    provider: config.provider,
    model: config.model,
    guide: await readFile(join(lessonDir, config.context), "utf8"),
    script,
    narration: parseScript(script).narration,
    schema: scene.schema,
    presets: scene.presets ?? {},
    constants: scene.constants ?? {},
    groups: scene.groups ?? {},
    commandable: config.commandable,
  };
}
