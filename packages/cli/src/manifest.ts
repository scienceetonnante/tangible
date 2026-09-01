// Load and type the lesson.yaml manifest.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { DEFAULT_ASSISTANT_LIMITS, type AssistantLimits } from "@tangible/core";

export type TtsConfig =
  | { provider: "elevenlabs"; voice: string; model?: string; speed?: number }
  | { provider: "hf-endpoint"; voice: string };

export interface Manifest {
  id: string;
  title: string;
  promise: string;
  scene: string;
  defaults: { anticipation: number; ease: string; transition: number };
  tts: TtsConfig;
  deployment?: {
    provider: "huggingface";
    space: string;
  };
  assistant?: {
    provider: "huggingface";
    model: string;
    context: string;
    commandable: string[];
    limits: AssistantLimits;
  };
}

export interface SceneManifest {
  id: string;
  scene: string;
}

export async function loadManifest(lessonDir: string): Promise<Manifest> {
  const text = await readFile(join(lessonDir, "lesson.yaml"), "utf8");
  const manifest = parseYaml(text) as unknown;
  validateManifest(manifest);
  return manifest;
}

/** Load only the manifest fields needed for narration-free scene development. */
export async function loadSceneManifest(lessonDir: string): Promise<SceneManifest> {
  const text = await readFile(join(lessonDir, "lesson.yaml"), "utf8");
  const manifest = parseYaml(text) as Partial<SceneManifest> | undefined;
  if (!manifest || typeof manifest.id !== "string") throw new Error('lesson.yaml must define a string "id"');
  if (typeof manifest.scene !== "string") throw new Error('lesson.yaml must define a string "scene"');
  return { id: manifest.id, scene: manifest.scene };
}

function validateManifest(value: unknown): asserts value is Manifest {
  const manifest = object(value, "lesson.yaml");
  nonEmptyString(manifest.id, 'lesson.yaml field "id"');
  nonEmptyString(manifest.title, 'lesson.yaml field "title"');
  nonEmptyString(manifest.promise, 'lesson.yaml field "promise"');
  nonEmptyString(manifest.scene, 'lesson.yaml field "scene"');

  const defaults = object(manifest.defaults, 'lesson.yaml field "defaults"');
  finiteNumber(defaults.anticipation, 'lesson.yaml field "defaults.anticipation"');
  nonEmptyString(defaults.ease, 'lesson.yaml field "defaults.ease"');
  finiteNumber(defaults.transition, 'lesson.yaml field "defaults.transition"');

  const tts = object(manifest.tts, 'lesson.yaml field "tts"');
  if (tts.provider !== "elevenlabs" && tts.provider !== "hf-endpoint") {
    throw new Error('lesson.yaml field "tts.provider" must be "elevenlabs" or "hf-endpoint"');
  }
  nonEmptyString(tts.voice, 'lesson.yaml field "tts.voice"');
  if (tts.provider === "elevenlabs") {
    optionalString(tts.model, 'lesson.yaml field "tts.model"');
    optionalNumber(tts.speed, 'lesson.yaml field "tts.speed"');
  } else if (tts.model !== undefined || tts.speed !== undefined) {
    throw new Error('lesson.yaml fields "tts.model" and "tts.speed" are supported only by ElevenLabs');
  }

  if (manifest.deployment !== undefined) {
    const deployment = object(manifest.deployment, 'lesson.yaml field "deployment"');
    if (deployment.provider !== "huggingface") {
      throw new Error('lesson.yaml field "deployment.provider" must be "huggingface"');
    }
    spaceId(deployment.space, 'lesson.yaml field "deployment.space"');
  }

  if (manifest.assistant !== undefined) {
    const assistant = object(manifest.assistant, 'lesson.yaml field "assistant"');
    if (assistant.provider !== "huggingface") throw new Error('lesson.yaml field "assistant.provider" must be "huggingface"');
    nonEmptyString(assistant.model, 'lesson.yaml field "assistant.model"');
    nonEmptyString(assistant.context, 'lesson.yaml field "assistant.context"');
    if (!Array.isArray(assistant.commandable) || assistant.commandable.some((value) => typeof value !== "string" || !value)) {
      throw new Error('lesson.yaml field "assistant.commandable" must be a list of parameter names');
    }
    if (assistant.limits === undefined) assistant.limits = DEFAULT_ASSISTANT_LIMITS;
    else validateAssistantLimits(assistant.limits);
  }
}

function validateAssistantLimits(value: unknown): asserts value is AssistantLimits {
  const limits = object(value, 'lesson.yaml field "assistant.limits"');
  const request = object(limits.request, 'lesson.yaml field "assistant.limits.request"');
  positiveInteger(request.bodyBytes, 'lesson.yaml field "assistant.limits.request.bodyBytes"');
  positiveInteger(request.questionCharacters, 'lesson.yaml field "assistant.limits.request.questionCharacters"');
  positiveInteger(request.historyTurns, 'lesson.yaml field "assistant.limits.request.historyTurns"');
  positiveInteger(request.positionCharacters, 'lesson.yaml field "assistant.limits.request.positionCharacters"');

  const response = object(limits.response, 'lesson.yaml field "assistant.limits.response"');
  positiveInteger(response.outputTokens, 'lesson.yaml field "assistant.limits.response.outputTokens"');
  positiveInteger(response.beats, 'lesson.yaml field "assistant.limits.response.beats"');
  positiveInteger(response.beatCharacters, 'lesson.yaml field "assistant.limits.response.beatCharacters"');
  positiveInteger(response.answerCharacters, 'lesson.yaml field "assistant.limits.response.answerCharacters"');
  nonNegativeNumber(response.transitionSeconds, 'lesson.yaml field "assistant.limits.response.transitionSeconds"');

  const rate = object(limits.rate, 'lesson.yaml field "assistant.limits.rate"');
  positiveInteger(rate.browserRequestsPerTenMinutes, 'lesson.yaml field "assistant.limits.rate.browserRequestsPerTenMinutes"');
  positiveInteger(rate.ipRequestsPerTenMinutes, 'lesson.yaml field "assistant.limits.rate.ipRequestsPerTenMinutes"');
  positiveInteger(rate.globalRequestsPerHour, 'lesson.yaml field "assistant.limits.rate.globalRequestsPerHour"');
  positiveInteger(rate.globalRequestsPerDay, 'lesson.yaml field "assistant.limits.rate.globalRequestsPerDay"');
  positiveInteger(rate.concurrentProviderCalls, 'lesson.yaml field "assistant.limits.rate.concurrentProviderCalls"');

  const queue = object(limits.queue, 'lesson.yaml field "assistant.limits.queue"');
  nonNegativeInteger(queue.maxPendingRequests, 'lesson.yaml field "assistant.limits.queue.maxPendingRequests"');
  positiveNumber(queue.waitTimeoutSeconds, 'lesson.yaml field "assistant.limits.queue.waitTimeoutSeconds"');
  positiveNumber(limits.providerTimeoutSeconds, 'lesson.yaml field "assistant.limits.providerTimeoutSeconds"');
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string`);
}

function finiteNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
}

function positiveInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

function nonNegativeInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
}

function positiveNumber(value: unknown, name: string): asserts value is number {
  finiteNumber(value, name);
  if (value <= 0) throw new Error(`${name} must be positive`);
}

function nonNegativeNumber(value: unknown, name: string): asserts value is number {
  finiteNumber(value, name);
  if (value < 0) throw new Error(`${name} must be non-negative`);
}

function spaceId(value: unknown, name: string): asserts value is string {
  nonEmptyString(value, name);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new Error(`${name} must use the "namespace/name" form`);
  }
}

function optionalString(value: unknown, name: string): void {
  if (value !== undefined) nonEmptyString(value, name);
}

function optionalNumber(value: unknown, name: string): void {
  if (value !== undefined) finiteNumber(value, name);
}
