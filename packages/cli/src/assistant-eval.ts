// Reproducible lesson-assistant evaluation across model configurations.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildIndex,
  evaluate,
  validateValue,
  type AnswerBeat,
  type AssistantContext,
  type AssistantHistoryTurn,
  type AssistantRequest,
  type LessonTracks,
  type ParamValue,
  type PlainState,
  type Schema,
} from "@tangible/core";
import { lessonPositionAt, latestCue, parseVtt } from "@tangible/player";
import { parse as parseYaml } from "yaml";
import { loadManifest } from "./manifest.js";
import { loadScene } from "./scene-loader.js";
import {
  AssistantProviderError,
  AssistantProviderTimeoutError,
  answerQuestion,
  buildAssistantProviderRequest,
  validateAssistantProviderRequestConfig,
  type AssistantProviderMetrics,
  type AssistantProviderRequestConfig,
} from "./assistant-service.js";
import type { AssistantPromptStyle } from "./assistant-prompt.js";

export interface AssistantEvalFile {
  configurations?: AssistantEvalConfiguration[];
  repeats?: number;
  cases: AssistantEvalCase[];
}

export interface AssistantEvalConfiguration {
  id: string;
  model: string;
  systemPrefix?: string;
  request?: Record<string, unknown>;
}

export interface AssistantEvalCase {
  id: string;
  at: number;
  state?: PlainState;
  turns: string[];
}

export interface AssistantEvalOptions {
  lessonDir: string;
  variant: AssistantPromptStyle | "both";
  real: boolean;
  out?: string;
  configurationIds?: string[];
  caseIds?: string[];
  repeats?: number;
}

export type AssistantEvalErrorCategory =
  | "missing_credentials"
  | "provider_timeout"
  | "provider_failure"
  | "invalid_response";

interface EvalTurnResult {
  question: string;
  providerRequest?: Record<string, unknown>;
  simulatedAnswer?: string;
  simulatedBeats?: AnswerBeat[];
  answer?: string;
  beats?: AnswerBeat[];
  latencyMs?: number;
  metrics?: AssistantProviderMetrics;
  error?: {
    category: AssistantEvalErrorCategory;
    message: string;
    status?: number;
  };
  skipped?: string;
}

interface EvalResult {
  lessonId: string;
  caseId: string;
  configurationId: string;
  model: string;
  variant: AssistantPromptStyle;
  repetition: number;
  at: number;
  turns: EvalTurnResult[];
}

export async function runAssistantEval(opts: AssistantEvalOptions): Promise<void> {
  const manifest = await loadManifest(opts.lessonDir);
  if (!manifest.assistant) throw new Error("assistant-eval requires an assistant-enabled lesson");
  const variants: AssistantPromptStyle[] =
    opts.variant === "both" ? ["legacy", "structured"] : [opts.variant];
  const evalPath = join(opts.lessonDir, "assistant.eval.yaml");
  if (!existsSync(evalPath)) throw new Error("assistant-eval found no assistant.eval.yaml file");
  const buildDir = join(opts.lessonDir, "build", "lesson");
  const contextPath = join(buildDir, "assistant.json");
  const tracksPath = join(buildDir, "tracks.json");
  if (!existsSync(contextPath) || !existsSync(tracksPath)) {
    throw new Error("assistant-eval requires a lesson build; run lesson build --silent or --offline first");
  }

  const data = parseYaml(await readFile(evalPath, "utf8")) as AssistantEvalFile;
  const context = JSON.parse(await readFile(contextPath, "utf8")) as AssistantContext;
  const tracks = JSON.parse(await readFile(tracksPath, "utf8")) as LessonTracks;
  const captions = await readFile(join(buildDir, "captions.vtt"), "utf8");
  const scene = await loadScene(join(opts.lessonDir, manifest.scene));
  validateAssistantEvalFile(data, evalPath, scene.schema, tracks.duration);

  const configurations = selectedConfigurations(data, context.model, opts.configurationIds, evalPath);
  const cases = selectById(data.cases, opts.caseIds, "case", evalPath);
  const repeats = opts.repeats ?? data.repeats ?? 1;
  validateRepeats(repeats, `${evalPath}: repeats`);
  const requests =
    cases.reduce((count, test) => count + test.turns.length, 0) *
    configurations.length *
    variants.length *
    repeats;
  console.error(`${opts.real ? "running" : "rendering"} ${requests} assistant evaluation request(s)`);

  const results: EvalResult[] = [];
  const sceneTracks = Object.fromEntries(
    Object.entries(tracks.tracks).filter(([param]) => param in scene.schema),
  );
  const index = buildIndex(sceneTracks, scene.schema);
  const cues = parseVtt(captions);

  // Interleaving configurations limits the effect of provider conditions changing over time.
  for (let repetition = 1; repetition <= repeats; repetition++) {
    for (const test of cases) {
      for (const configuration of configurations) {
        for (const variant of variants) {
          const state = { ...evaluate(index, test.at), ...test.state };
          let temporaryAssistantState: PlainState = {};
          const history: AssistantHistoryTurn[] = [];
          const turns: EvalTurnResult[] = [];
          let failedTurn: string | undefined;

          for (const question of test.turns) {
            if (failedTurn) {
              turns.push({ question, skipped: `previous turn failed: ${failedTurn}` });
              continue;
            }
            const request = assistantRequest(
              manifest.id,
              question,
              test.at,
              state,
              temporaryAssistantState,
              history,
              context,
              tracks,
              cues,
            );
            const requestConfig = providerRequestConfig(configuration);
            if (!opts.real) {
              const response = await answerQuestion(request, context, { fake: true });
              turns.push({
                question,
                providerRequest: buildAssistantProviderRequest(request, context, variant, requestConfig),
                simulatedAnswer: response.answer,
                simulatedBeats: response.beats,
              });
              updateConversation(state, response.beats, history, question, response.answer);
              temporaryAssistantState = finalAnswerState(response.beats);
              continue;
            }

            const started = Date.now();
            let metrics: AssistantProviderMetrics | undefined;
            try {
              const response = await answerQuestion(request, context, {
                promptStyle: variant,
                requestConfig,
                onProviderMetrics: (value) => {
                  metrics = value;
                },
              });
              turns.push({
                question,
                answer: response.answer,
                beats: response.beats,
                latencyMs: Date.now() - started,
                ...(metrics ? { metrics } : {}),
              });
              updateConversation(state, response.beats, history, question, response.answer);
              temporaryAssistantState = finalAnswerState(response.beats);
            } catch (error) {
              const failure = classifyAssistantEvalError(error);
              turns.push({ question, latencyMs: Date.now() - started, error: failure });
              failedTurn = failure.category;
            }
          }

          results.push({
            lessonId: manifest.id,
            caseId: test.id,
            configurationId: configuration.id,
            model: configuration.model,
            variant,
            repetition,
            at: test.at,
            turns,
          });
        }
      }
    }
  }

  const output = `${JSON.stringify(results, null, 2)}\n`;
  if (opts.out) await writeFile(opts.out, output);
  else process.stdout.write(output);
}

export function validateAssistantEvalFile(
  data: AssistantEvalFile,
  path: string,
  schema: Schema,
  duration: number,
): void {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${path}: evaluation must be an object`);
  }
  if (data.repeats !== undefined) validateRepeats(data.repeats, `${path}: repeats`);
  if (data.configurations !== undefined) {
    if (!Array.isArray(data.configurations) || !data.configurations.length) {
      throw new Error(`${path}: configurations must be a non-empty array`);
    }
    const configurationIds = new Set<string>();
    for (const configuration of data.configurations) {
      if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
        throw new Error(`${path}: every configuration must be an object`);
      }
      validateId(configuration.id, "configuration", path);
      if (configurationIds.has(configuration.id)) {
        throw new Error(`${path}: duplicate configuration id "${configuration.id}"`);
      }
      configurationIds.add(configuration.id);
      if (typeof configuration.model !== "string" || !configuration.model.trim()) {
        throw new Error(`${path}: configuration "${configuration.id}" needs a model`);
      }
      if (configuration.systemPrefix !== undefined && typeof configuration.systemPrefix !== "string") {
        throw new Error(`${path}: configuration "${configuration.id}" systemPrefix must be text`);
      }
      if (
        configuration.request !== undefined &&
        (!configuration.request || typeof configuration.request !== "object" || Array.isArray(configuration.request))
      ) {
        throw new Error(`${path}: configuration "${configuration.id}" request must be an object`);
      }
      try {
        validateAssistantProviderRequestConfig(providerRequestConfig(configuration));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${path}: configuration "${configuration.id}": ${message}`);
      }
    }
  }
  if (!Array.isArray(data.cases) || !data.cases.length) {
    throw new Error(`${path}: cases must be a non-empty array`);
  }
  const caseIds = new Set<string>();
  for (const test of data.cases) {
    if (!test || typeof test !== "object" || Array.isArray(test)) {
      throw new Error(`${path}: every case must be an object`);
    }
    validateId(test.id, "case", path);
    if (caseIds.has(test.id)) throw new Error(`${path}: duplicate case id "${test.id}"`);
    caseIds.add(test.id);
    if (!Number.isFinite(test.at) || test.at < 0 || test.at > duration) {
      throw new Error(`${path}: case "${test.id}" time must be between 0 and ${duration}`);
    }
    validateState(test.state, test.id, path, schema);
    if (
      !Array.isArray(test.turns) ||
      !test.turns.length ||
      test.turns.some((turn) => typeof turn !== "string" || !turn.trim())
    ) {
      throw new Error(`${path}: case "${test.id}" needs non-empty turns`);
    }
  }
}

export function classifyAssistantEvalError(error: unknown): {
  category: AssistantEvalErrorCategory;
  message: string;
  status?: number;
} {
  if (error instanceof AssistantProviderTimeoutError) {
    return { category: "provider_timeout", message: error.message };
  }
  if (error instanceof AssistantProviderError) {
    return { category: "provider_failure", message: error.message, status: error.status };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message === "HF_TOKEN is not set") return { category: "missing_credentials", message };
  if (error instanceof TypeError) return { category: "provider_failure", message };
  return { category: "invalid_response", message };
}

function selectedConfigurations(
  data: AssistantEvalFile,
  manifestModel: string,
  ids: string[] | undefined,
  path: string,
): AssistantEvalConfiguration[] {
  const configurations = data.configurations ?? [{ id: "manifest", model: manifestModel }];
  return selectById(configurations, ids, "configuration", path);
}

function selectById<T extends { id: string }>(
  values: T[],
  requested: string[] | undefined,
  kind: string,
  path: string,
): T[] {
  if (!requested?.length) return values;
  const requestedIds = new Set(requested);
  const selected = values.filter((value) => requestedIds.has(value.id));
  const missing = requested.filter((id) => !values.some((value) => value.id === id));
  if (missing.length) throw new Error(`${path}: unknown ${kind} id(s): ${missing.join(", ")}`);
  return selected;
}

function validateId(value: unknown, kind: string, path: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(value)) {
    throw new Error(`${path}: every ${kind} needs a lowercase id using letters, numbers, "-", or "_"`);
  }
}

function validateRepeats(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 20) {
    throw new Error(`${label} must be an integer between 1 and 20`);
  }
}

function validateState(state: PlainState | undefined, id: string, path: string, schema: Schema): void {
  if (state === undefined) return;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error(`${path}: case "${id}" state must be an object`);
  }
  for (const [param, value] of Object.entries(state)) {
    const spec = schema[param];
    if (!spec) throw new Error(`${path}: case "${id}" state has unknown parameter "${param}"`);
    const error = validateValue(spec.type, value);
    if (error) throw new Error(`${path}: case "${id}" state ${param}: ${error}`);
    if (
      spec.type.kind === "scalar" &&
      spec.type.range &&
      typeof value === "number" &&
      (value < spec.type.range[0] || value > spec.type.range[1])
    ) {
      throw new Error(`${path}: case "${id}" state ${param} is outside [${spec.type.range.join(", ")}]`);
    }
  }
}

function providerRequestConfig(configuration: AssistantEvalConfiguration): AssistantProviderRequestConfig {
  return {
    model: configuration.model,
    ...(configuration.systemPrefix !== undefined ? { systemPrefix: configuration.systemPrefix } : {}),
    ...(configuration.request ? { body: configuration.request } : {}),
  };
}

function assistantRequest(
  lessonId: string,
  question: string,
  at: number,
  state: PlainState,
  temporaryAssistantState: PlainState,
  history: AssistantHistoryTurn[],
  context: AssistantContext,
  tracks: LessonTracks,
  cues: ReturnType<typeof parseVtt>,
): AssistantRequest {
  return {
    lessonId,
    question,
    t: at,
    state: { ...state },
    position: lessonPositionAt(at, tracks.chapters, latestCue(cues, at)),
    temporaryAssistantState: { ...temporaryAssistantState },
    history: history.slice(-context.limits.request.historyTurns),
  };
}

function updateConversation(
  state: PlainState,
  beats: AnswerBeat[],
  history: AssistantHistoryTurn[],
  question: string,
  answer: string,
): void {
  applyAnswerState(state, beats);
  history.push({ question, answer, beats });
}

function applyAnswerState(state: PlainState, beats: AnswerBeat[]): void {
  for (const beat of beats) {
    for (const [param, value] of Object.entries(beat.set)) state[param] = clone(value);
  }
}

function finalAnswerState(beats: AnswerBeat[]): PlainState {
  const state: PlainState = {};
  applyAnswerState(state, beats);
  return state;
}

function clone(value: ParamValue): ParamValue {
  if (Array.isArray(value)) return value.slice();
  if (typeof value === "object" && value !== null) return { ...value, target: [...value.target] };
  return value;
}
