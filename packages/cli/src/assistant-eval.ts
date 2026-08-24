// Optional real-provider evaluation for lesson assistants. Cases are authored
// beside the lesson; results go to stdout or an explicit output path.

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
} from "@narrable/core";
import { parse as parseYaml } from "yaml";
import { lessonPositionAt, latestCue, parseVtt } from "@narrable/player";
import { loadScene } from "./scene-loader.js";
import { loadManifest } from "./manifest.js";
import { answerQuestion, buildAssistantProviderRequest } from "./assistant-service.js";
import type { AssistantPromptStyle } from "./assistant-prompt.js";

interface EvalFile {
  cases: EvalCase[];
}

interface EvalCase {
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
}

interface EvalTurnResult {
  question: string;
  providerRequest?: Record<string, unknown>;
  simulatedAnswer?: string;
  simulatedBeats?: AnswerBeat[];
  answer?: string;
  beats?: AnswerBeat[];
  latencyMs?: number;
}

interface EvalResult {
  lessonId: string;
  caseId: string;
  variant: AssistantPromptStyle;
  at: number;
  turns: EvalTurnResult[];
}

export async function runAssistantEval(opts: AssistantEvalOptions): Promise<void> {
  const manifest = await loadManifest(opts.lessonDir);
  if (!manifest.assistant) throw new Error("assistant-eval requires an assistant-enabled lesson");
  const variants: AssistantPromptStyle[] = opts.variant === "both" ? ["legacy", "structured"] : [opts.variant];
  const evalPath = join(opts.lessonDir, "assistant.eval.yaml");
  if (!existsSync(evalPath)) throw new Error("assistant-eval found no assistant.eval.yaml file");
  const buildDir = join(opts.lessonDir, "build", "lesson");
  const contextPath = join(buildDir, "assistant.json");
  const tracksPath = join(buildDir, "tracks.json");
  if (!existsSync(contextPath) || !existsSync(tracksPath)) {
    throw new Error("assistant-eval requires a lesson build; run lesson build --silent or --offline first");
  }
  const data = parseYaml(await readFile(evalPath, "utf8")) as EvalFile;
  validateEvalFile(data, evalPath);
  const context = JSON.parse(await readFile(contextPath, "utf8")) as AssistantContext;
  const tracks = JSON.parse(await readFile(tracksPath, "utf8")) as LessonTracks;
  const captions = await readFile(join(buildDir, "captions.vtt"), "utf8");

  const requests = data.cases.reduce((n, test) => n + test.turns.length, 0) * variants.length;
  console.error(`${opts.real ? "running" : "rendering"} ${requests} assistant evaluation request(s)`);

  const scene = await loadScene(join(opts.lessonDir, manifest.scene));
  const results: EvalResult[] = [];
  const sceneTracks = Object.fromEntries(Object.entries(tracks.tracks).filter(([param]) => param in scene.schema));
  const index = buildIndex(sceneTracks, scene.schema);
  const cues = parseVtt(captions);
  for (const test of data.cases) {
    for (const variant of variants) {
      const state = { ...evaluate(index, test.at), ...test.state };
      let temporaryAssistantState: PlainState = {};
      const history: AssistantHistoryTurn[] = [];
      const turns: EvalTurnResult[] = [];
      for (const question of test.turns) {
        const request: AssistantRequest = {
          lessonId: manifest.id,
          question,
          t: test.at,
          state: { ...state },
          position: lessonPositionAt(test.at, tracks.chapters, latestCue(cues, test.at)),
          temporaryAssistantState: { ...temporaryAssistantState },
          history: history.slice(-8),
        };
        if (!opts.real) {
          const response = await answerQuestion(request, context, { fake: true });
          turns.push({
            question,
            providerRequest: buildAssistantProviderRequest(request, context, variant),
            simulatedAnswer: response.answer,
            simulatedBeats: response.beats,
          });
          history.push({ question, answer: response.answer, beats: response.beats });
          applyAnswerState(state, response.beats);
          temporaryAssistantState = finalAnswerState(response.beats);
          continue;
        }
        const started = Date.now();
        const response = await answerQuestion(request, context, { promptStyle: variant });
        turns.push({ question, answer: response.answer, beats: response.beats, latencyMs: Date.now() - started });
        history.push({ question, answer: response.answer, beats: response.beats });
        applyAnswerState(state, response.beats);
        temporaryAssistantState = finalAnswerState(response.beats);
      }
      results.push({ lessonId: manifest.id, caseId: test.id, variant, at: test.at, turns });
    }
  }

  const output = JSON.stringify(results, null, 2) + "\n";
  if (opts.out) await writeFile(opts.out, output);
  else process.stdout.write(output);
}

function validateEvalFile(data: EvalFile, path: string): void {
  if (!data || !Array.isArray(data.cases) || !data.cases.length) throw new Error(`${path}: cases must be a non-empty array`);
  const ids = new Set<string>();
  for (const test of data.cases) {
    if (!test || typeof test.id !== "string" || !test.id.trim()) throw new Error(`${path}: every case needs an id`);
    if (ids.has(test.id)) throw new Error(`${path}: duplicate case id "${test.id}"`);
    ids.add(test.id);
    if (!Number.isFinite(test.at) || test.at < 0) throw new Error(`${path}: case "${test.id}" needs a non-negative at time`);
    if (test.state !== undefined && (!test.state || typeof test.state !== "object" || Array.isArray(test.state))) {
      throw new Error(`${path}: case "${test.id}" state must be an object`);
    }
    if (!Array.isArray(test.turns) || !test.turns.length || test.turns.some((turn) => typeof turn !== "string" || !turn.trim())) {
      throw new Error(`${path}: case "${test.id}" needs non-empty turns`);
    }
  }
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
