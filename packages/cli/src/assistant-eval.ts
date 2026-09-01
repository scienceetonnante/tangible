// Reproducible lesson-assistant evaluation across model configurations.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildIndex,
  evaluate,
  type AnswerBeat,
  type AssistantContext,
  type AssistantHistoryTurn,
  type AssistantRequest,
  type LessonTracks,
  type ParamValue,
  type PlainState,
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
  type AssistantProviderMetrics,
} from "./assistant-service.js";
import type { AssistantPromptStyle } from "./assistant-prompt.js";
import {
  evaluateAssistantDeterministicChecks,
  type AssistantDeterministicCheck,
} from "./assistant-eval-checks.js";
import {
  assistantEvalRequestConfig,
  assistantEvalTurn,
  validateAssistantEvalFile,
  validateAssistantEvalRepeats,
  type AssistantEvalConfiguration,
  type AssistantEvalFile,
  type AssistantEvalRubric,
} from "./assistant-eval-format.js";

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
  rubric?: AssistantEvalRubric;
  evaluationContext?: {
    lessonPosition: AssistantRequest["position"];
    visibleState: PlainState;
    temporaryAssistantState: PlainState;
    history: AssistantHistoryTurn[];
  };
  deterministicChecks?: AssistantDeterministicCheck[];
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
  validateAssistantEvalRepeats(repeats, `${evalPath}: repeats`);
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

          for (const definition of test.turns) {
            const { question, rubric } = assistantEvalTurn(definition);
            if (failedTurn) {
              turns.push({
                question,
                ...(rubric ? { rubric } : {}),
                skipped: `previous turn failed: ${failedTurn}`,
              });
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
            const evaluationContext = {
              lessonPosition: request.position,
              visibleState: request.state,
              temporaryAssistantState: request.temporaryAssistantState,
              history: request.history,
            };
            const requestConfig = assistantEvalRequestConfig(configuration);
            if (!opts.real) {
              const response = await answerQuestion(request, context, { fake: true });
              turns.push({
                question,
                ...(rubric ? { rubric } : {}),
                evaluationContext,
                deterministicChecks: evaluateAssistantDeterministicChecks(
                  response.answer,
                  response.beats,
                  rubric,
                  state,
                  context.commandable,
                ),
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
                ...(rubric ? { rubric } : {}),
                evaluationContext,
                deterministicChecks: evaluateAssistantDeterministicChecks(
                  response.answer,
                  response.beats,
                  rubric,
                  state,
                  context.commandable,
                ),
                answer: response.answer,
                beats: response.beats,
                latencyMs: Date.now() - started,
                ...(metrics ? { metrics } : {}),
              });
              updateConversation(state, response.beats, history, question, response.answer);
              temporaryAssistantState = finalAnswerState(response.beats);
            } catch (error) {
              const failure = classifyAssistantEvalError(error);
              turns.push({
                question,
                ...(rubric ? { rubric } : {}),
                evaluationContext,
                latencyMs: Date.now() - started,
                error: failure,
              });
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
