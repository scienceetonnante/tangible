// Grade a saved assistant evaluation without exposing candidate identities to the judge.

import { readFile, writeFile } from "node:fs/promises";
import type { AnswerBeat, AssistantHistoryTurn, AssistantRequest, PlainState } from "@tangible/core";
import type { AssistantDeterministicCheck } from "./assistant-eval-checks.js";
import type { AssistantEvalRubric } from "./assistant-eval-format.js";
import {
  AssistantJudgeProviderError,
  AssistantJudgeTimeoutError,
  DEFAULT_ASSISTANT_JUDGE_MODEL,
  judgeAssistantTurn,
  type AssistantJudgeGrade,
  type AssistantJudgeMetrics,
  type AssistantJudgeProviders,
} from "./assistant-eval-judge.js";

export interface AssistantEvalGradeOptions {
  input: string;
  out?: string;
  configurationIds?: string[];
  caseIds?: string[];
}

export interface AssistantEvalGradeProviders extends AssistantJudgeProviders {
  now?: () => Date;
}

interface CandidateTurn {
  question: string;
  rubric?: AssistantEvalRubric;
  deterministicChecks?: AssistantDeterministicCheck[];
  evaluationContext?: {
    lessonPosition: AssistantRequest["position"];
    visibleState: PlainState;
    temporaryAssistantState: PlainState;
    history: AssistantHistoryTurn[];
  };
  answer?: string;
  beats?: AnswerBeat[];
  latencyMs?: number;
  metrics?: AssistantJudgeMetrics;
  error?: unknown;
  skipped?: string;
}

interface CandidateResult {
  lessonId: string;
  caseId: string;
  configurationId: string;
  model: string;
  variant: string;
  repetition: number;
  at: number;
  turns: CandidateTurn[];
}

interface GradeRecord {
  lessonId: string;
  caseId: string;
  configurationId: string;
  candidateModel: string;
  variant: string;
  repetition: number;
  turn: number;
  question: string;
  status: "graded" | "skipped" | "judge_error";
  grade?: AssistantJudgeGrade;
  judge?: {
    latencyMs: number;
    metrics: AssistantJudgeMetrics;
    responseId?: string;
  };
  reason?: string;
  error?: {
    category: "judge_timeout" | "judge_provider" | "judge_network" | "judge_invalid_response";
    message: string;
    status?: number;
  };
}

export async function runAssistantEvalGrade(opts: AssistantEvalGradeOptions): Promise<void> {
  const raw = JSON.parse(await readFile(opts.input, "utf8")) as unknown;
  const output = await gradeAssistantEvalResults(raw, {
    configurationIds: opts.configurationIds,
    caseIds: opts.caseIds,
  });
  const text = `${JSON.stringify(output, null, 2)}\n`;
  if (opts.out) await writeFile(opts.out, text);
  else process.stdout.write(text);
}

export async function gradeAssistantEvalResults(
  raw: unknown,
  filters: { configurationIds?: string[]; caseIds?: string[] } = {},
  providers: AssistantEvalGradeProviders = {},
): Promise<Record<string, unknown>> {
  const results = validateCandidateResults(raw).filter((result) =>
    (!filters.configurationIds?.length || filters.configurationIds.includes(result.configurationId)) &&
    (!filters.caseIds?.length || filters.caseIds.includes(result.caseId)));
  if (!results.length) throw new Error("assistant-eval-grade selected no candidate results");
  const unknownConfigurations = missingIds(filters.configurationIds, results, "configurationId");
  const unknownCases = missingIds(filters.caseIds, results, "caseId");
  if (unknownConfigurations.length) {
    throw new Error(`assistant-eval-grade found no configuration id(s): ${unknownConfigurations.join(", ")}`);
  }
  if (unknownCases.length) throw new Error(`assistant-eval-grade found no case id(s): ${unknownCases.join(", ")}`);
  if (!(providers.openaiApiKey ?? process.env.OPENAI_API_KEY)) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const gradeable = results.flatMap((result) => result.turns).filter(isGradeable).length;
  console.error(`grading ${gradeable} assistant evaluation turn(s)`);
  const records: GradeRecord[] = [];
  for (const result of results) {
    for (const [index, turn] of result.turns.entries()) {
      const base = {
        lessonId: result.lessonId,
        caseId: result.caseId,
        configurationId: result.configurationId,
        candidateModel: result.model,
        variant: result.variant,
        repetition: result.repetition,
        turn: index + 1,
        question: turn.question,
      };
      const reason = skipReason(turn);
      if (reason) {
        records.push({ ...base, status: "skipped", reason });
        continue;
      }
      const started = Date.now();
      try {
        const judged = await judgeAssistantTurn({
          question: turn.question,
          conversationHistory: turn.evaluationContext!.history,
          lessonPosition: turn.evaluationContext!.lessonPosition,
          visibleState: turn.evaluationContext!.visibleState,
          temporaryAssistantState: turn.evaluationContext!.temporaryAssistantState,
          answer: turn.answer!,
          beats: turn.beats!,
          rubric: turn.rubric!,
          deterministicChecks: turn.deterministicChecks ?? [],
        }, providers);
        records.push({
          ...base,
          status: "graded",
          grade: judged.grade,
          judge: {
            latencyMs: Date.now() - started,
            metrics: judged.metrics,
            ...(judged.responseId ? { responseId: judged.responseId } : {}),
          },
        });
      } catch (error) {
        records.push({
          ...base,
          status: "judge_error",
          error: classifyJudgeError(error),
        });
      }
    }
  }

  return {
    judge: { model: providers.model ?? DEFAULT_ASSISTANT_JUDGE_MODEL, reasoningEffort: "high" },
    generatedAt: (providers.now ?? (() => new Date()))().toISOString(),
    records,
    summary: summarize(results, records),
  };
}

function validateCandidateResults(raw: unknown): CandidateResult[] {
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error("assistant-eval-grade input must be a non-empty evaluation result array");
  }
  for (const [index, result] of raw.entries()) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error(`assistant-eval-grade result ${index + 1} must be an object`);
    }
    const value = result as Record<string, unknown>;
    for (const field of ["lessonId", "caseId", "configurationId", "model", "variant"] as const) {
      if (typeof value[field] !== "string" || !value[field]) {
        throw new Error(`assistant-eval-grade result ${index + 1} needs ${field}`);
      }
    }
    if (!Number.isSafeInteger(value.repetition) || !Number.isFinite(value.at)) {
      throw new Error(`assistant-eval-grade result ${index + 1} has invalid repetition or time`);
    }
    if (!Array.isArray(value.turns) || !value.turns.length) {
      throw new Error(`assistant-eval-grade result ${index + 1} needs turns`);
    }
    for (const [turnIndex, turn] of value.turns.entries()) {
      if (!turn || typeof turn !== "object" || Array.isArray(turn) ||
          typeof (turn as Record<string, unknown>).question !== "string") {
        throw new Error(`assistant-eval-grade result ${index + 1} turn ${turnIndex + 1} is invalid`);
      }
    }
  }
  return raw as CandidateResult[];
}

function skipReason(turn: CandidateTurn): string | undefined {
  if (turn.error) return "candidate request failed";
  if (turn.skipped) return turn.skipped;
  if (!turn.rubric) return "turn has no authored rubric";
  if (!turn.evaluationContext) return "turn has no saved evaluation context";
  if (typeof turn.answer !== "string" || !Array.isArray(turn.beats)) return "turn has no real candidate answer";
  return undefined;
}

function isGradeable(turn: CandidateTurn): boolean {
  return skipReason(turn) === undefined;
}

function classifyJudgeError(error: unknown): GradeRecord["error"] {
  if (error instanceof AssistantJudgeTimeoutError) {
    return { category: "judge_timeout", message: error.message };
  }
  if (error instanceof AssistantJudgeProviderError) {
    return { category: "judge_provider", message: error.message, status: error.status };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof TypeError) return { category: "judge_network", message };
  return { category: "judge_invalid_response", message };
}

function missingIds(
  requested: string[] | undefined,
  results: CandidateResult[],
  field: "configurationId" | "caseId",
): string[] {
  return (requested ?? []).filter((id) => !results.some((result) => result[field] === id));
}

function summarize(results: CandidateResult[], records: GradeRecord[]): Record<string, unknown>[] {
  const keys = [...new Set(results.map((result) => `${result.configurationId}\n${result.variant}`))];
  return keys.map((key) => {
    const [configurationId, variant] = key.split("\n") as [string, string];
    const candidates = results.filter((result) =>
      result.configurationId === configurationId && result.variant === variant).flatMap((result) => result.turns);
    const grades = records.filter((record) =>
      record.configurationId === configurationId && record.variant === variant);
    const judged = grades.filter((record) => record.grade).map((record) => record.grade!);
    const score = (field: keyof AssistantJudgeGrade) => mean(
      judged.map((grade) => grade[field]).filter((value): value is number => typeof value === "number"),
    );
    const latencies = candidates.map((turn) => turn.latencyMs).filter((value): value is number => typeof value === "number");
    return {
      configurationId,
      candidateModel: results.find((result) => result.configurationId === configurationId)!.model,
      variant,
      candidateTurns: candidates.length,
      candidateFailures: candidates.filter((turn) => turn.error || turn.skipped).length,
      skippedTurns: grades.filter((record) => record.status === "skipped").length,
      deterministicFailureTurns: candidates.filter((turn) =>
        turn.deterministicChecks?.some((check) => !check.passed)).length,
      gradedTurns: judged.length,
      judgeFailures: grades.filter((record) => record.status === "judge_error").length,
      criticalErrors: judged.filter((grade) => grade.criticalError).length,
      meanScientificCorrectness: score("scientificCorrectness"),
      meanGrounding: score("grounding"),
      meanPedagogicalQuality: score("pedagogicalQuality"),
      meanSceneChangeQuality: score("sceneChangeQuality"),
      meanScopeResistance: score("scopeResistance"),
      medianCandidateLatencyMs: percentile(latencies, 0.5),
      p95CandidateLatencyMs: percentile(latencies, 0.95),
      candidateInputTokens: tokenTotal(candidates, "inputTokens"),
      candidateOutputTokens: tokenTotal(candidates, "outputTokens"),
      candidateReasoningTokens: tokenTotal(candidates, "reasoningTokens"),
      judgeInputTokens: judgeTokenTotal(grades, "inputTokens"),
      judgeOutputTokens: judgeTokenTotal(grades, "outputTokens"),
      judgeReasoningTokens: judgeTokenTotal(grades, "reasoningTokens"),
    };
  });
}

function mean(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 1000) / 1000 : null;
}

function percentile(values: number[], probability: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(probability * sorted.length) - 1]!;
}

function tokenTotal(turns: CandidateTurn[], field: keyof AssistantJudgeMetrics): number {
  return turns.reduce((total, turn) => total + (turn.metrics?.[field] ?? 0), 0);
}

function judgeTokenTotal(records: GradeRecord[], field: keyof AssistantJudgeMetrics): number {
  return records.reduce((total, record) => total + (record.judge?.metrics[field] ?? 0), 0);
}
