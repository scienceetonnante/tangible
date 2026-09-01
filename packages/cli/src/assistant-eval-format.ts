// Authored evaluation file format and validation.

import {
  validateValue,
  type ParamValue,
  type PlainState,
  type Schema,
} from "@tangible/core";
import {
  validateAssistantProviderRequestConfig,
  type AssistantProviderRequestConfig,
} from "./assistant-service.js";

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
  turns: AssistantEvalTurn[];
}

export type AssistantEvalTurn = string | {
  question: string;
  rubric: AssistantEvalRubric;
};

export interface AssistantEvalRubric {
  referenceFacts: string[];
  forbiddenClaims?: string[];
  criticalErrors?: string[];
  evaluateScope?: boolean;
  scene: AssistantEvalSceneRubric;
}

export interface AssistantEvalSceneRubric {
  policy: "forbidden" | "optional" | "required";
  preserve?: string[];
  requiredChanges?: string[];
  assertions?: AssistantEvalSceneAssertion[];
}

export interface AssistantEvalSceneAssertion {
  param: string;
  operator: "eq" | "lt" | "lte" | "gt" | "gte";
  value: ParamValue;
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
  if (data.repeats !== undefined) validateAssistantEvalRepeats(data.repeats, `${path}: repeats`);
  if (data.configurations !== undefined) validateConfigurations(data.configurations, path);
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
    if (!Array.isArray(test.turns) || !test.turns.length) {
      throw new Error(`${path}: case "${test.id}" needs non-empty turns`);
    }
    for (const [index, turn] of test.turns.entries()) {
      validateEvalTurn(turn, test.id, index, path, schema);
    }
  }
}

export function validateAssistantEvalRepeats(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 20) {
    throw new Error(`${label} must be an integer between 1 and 20`);
  }
}

export function assistantEvalTurn(turn: AssistantEvalTurn): {
  question: string;
  rubric?: AssistantEvalRubric;
} {
  return typeof turn === "string" ? { question: turn } : turn;
}

export function assistantEvalRequestConfig(
  configuration: AssistantEvalConfiguration,
): AssistantProviderRequestConfig {
  return {
    model: configuration.model,
    ...(configuration.systemPrefix !== undefined ? { systemPrefix: configuration.systemPrefix } : {}),
    ...(configuration.request ? { body: configuration.request } : {}),
  };
}

function validateConfigurations(configurations: AssistantEvalConfiguration[], path: string): void {
  if (!Array.isArray(configurations) || !configurations.length) {
    throw new Error(`${path}: configurations must be a non-empty array`);
  }
  const ids = new Set<string>();
  for (const configuration of configurations) {
    if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
      throw new Error(`${path}: every configuration must be an object`);
    }
    validateId(configuration.id, "configuration", path);
    if (ids.has(configuration.id)) {
      throw new Error(`${path}: duplicate configuration id "${configuration.id}"`);
    }
    ids.add(configuration.id);
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
      validateAssistantProviderRequestConfig(assistantEvalRequestConfig(configuration));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${path}: configuration "${configuration.id}": ${message}`);
    }
  }
}

function validateId(value: unknown, kind: string, path: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(value)) {
    throw new Error(`${path}: every ${kind} needs a lowercase id using letters, numbers, "-", or "_"`);
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

function validateEvalTurn(
  turn: AssistantEvalTurn,
  caseId: string,
  index: number,
  path: string,
  schema: Schema,
): void {
  const label = `${path}: case "${caseId}" turn ${index + 1}`;
  if (typeof turn === "string") {
    if (!turn.trim()) throw new Error(`${label} question must be non-empty text`);
    return;
  }
  if (!turn || typeof turn !== "object" || Array.isArray(turn)) {
    throw new Error(`${label} must be text or an object`);
  }
  if (typeof turn.question !== "string" || !turn.question.trim()) {
    throw new Error(`${label} question must be non-empty text`);
  }
  validateRubric(turn.rubric, label, schema);
}

function validateRubric(rubric: AssistantEvalRubric, label: string, schema: Schema): void {
  if (!rubric || typeof rubric !== "object" || Array.isArray(rubric)) {
    throw new Error(`${label} rubric must be an object`);
  }
  validateTextList(rubric.referenceFacts, `${label} rubric referenceFacts`, true);
  validateTextList(rubric.forbiddenClaims, `${label} rubric forbiddenClaims`, false);
  validateTextList(rubric.criticalErrors, `${label} rubric criticalErrors`, false);
  if (rubric.evaluateScope !== undefined && typeof rubric.evaluateScope !== "boolean") {
    throw new Error(`${label} rubric evaluateScope must be true or false`);
  }
  const scene = rubric.scene;
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
    throw new Error(`${label} rubric scene must be an object`);
  }
  if (!(["forbidden", "optional", "required"] as const).includes(scene.policy)) {
    throw new Error(`${label} rubric scene policy must be forbidden, optional, or required`);
  }
  validateParamList(scene.preserve, `${label} rubric scene preserve`, schema);
  validateParamList(scene.requiredChanges, `${label} rubric scene requiredChanges`, schema);
  if (scene.policy === "forbidden" && scene.requiredChanges?.length) {
    throw new Error(`${label} rubric cannot forbid scene changes and require parameters to change`);
  }
  if (scene.assertions !== undefined && !Array.isArray(scene.assertions)) {
    throw new Error(`${label} rubric scene assertions must be an array`);
  }
  for (const [assertionIndex, assertion] of (scene.assertions ?? []).entries()) {
    const assertionLabel = `${label} rubric scene assertion ${assertionIndex + 1}`;
    if (!assertion || typeof assertion !== "object" || Array.isArray(assertion)) {
      throw new Error(`${assertionLabel} must be an object`);
    }
    const spec = schema[assertion.param];
    if (!spec) throw new Error(`${assertionLabel} has unknown parameter "${String(assertion.param)}"`);
    if (!(["eq", "lt", "lte", "gt", "gte"] as const).includes(assertion.operator)) {
      throw new Error(`${assertionLabel} has an unsupported operator`);
    }
    const error = validateValue(spec.type, assertion.value);
    if (error) throw new Error(`${assertionLabel} ${assertion.param}: ${error}`);
    if (assertion.operator !== "eq" && spec.type.kind !== "scalar") {
      throw new Error(`${assertionLabel} can only use ${assertion.operator} with a scalar parameter`);
    }
  }
}

function validateTextList(value: string[] | undefined, label: string, required: boolean): void {
  if (value === undefined && !required) return;
  if (!Array.isArray(value) || (required && !value.length) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be ${required ? "a non-empty" : "an"} array of non-empty text`);
  }
}

function validateParamList(value: string[] | undefined, label: string, schema: Schema): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((param) => typeof param !== "string" || !param.trim())) {
    throw new Error(`${label} must be an array of parameter names`);
  }
  const unique = new Set(value);
  if (unique.size !== value.length) throw new Error(`${label} must not contain duplicates`);
  for (const param of value) {
    if (!schema[param]) throw new Error(`${label} has unknown parameter "${param}"`);
  }
}
