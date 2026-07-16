// Build the deterministic, per-language context consumed by the runtime lesson
// assistant. Layout/control semantics are authored; scene data is generated.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseScript, type SceneInfo } from "@narrable/compiler";
import type { AssistantContext } from "@narrable/core";
import type { Manifest } from "./manifest.js";

export async function emitAssistantContext(
  lessonDir: string,
  manifest: Manifest,
  scene: SceneInfo,
  language: string,
  script: string,
): Promise<void> {
  const config = manifest.assistant;
  if (!config) return;

  const contextPath = config.context[language];
  if (!contextPath) throw new Error(`assistant.context is missing language "${language}"`);
  for (const param of config.commandable) {
    if (!scene.schema[param]) throw new Error(`assistant.commandable references unknown parameter "${param}"`);
  }

  const context: AssistantContext = {
    version: 1,
    lessonId: manifest.id,
    language,
    title: manifest.title[language] ?? manifest.id,
    guide: await readFile(join(lessonDir, contextPath), "utf8"),
    script,
    narration: parseScript(script).narration,
    schema: scene.schema,
    presets: scene.presets ?? {},
    constants: scene.constants ?? {},
    groups: scene.groups ?? {},
    commandable: config.commandable,
    voice: manifest.voice[language] ?? "",
    speed: manifest.tts?.speed,
  };
  await writeFile(join(lessonDir, "build", language, "assistant.json"), JSON.stringify(context, null, 2) + "\n");
}
