// Deterministic checks applied before model or human rubric grading.

import { type AnswerBeat, type ParamValue, type PlainState } from "@tangible/core";
import type { AssistantEvalRubric, AssistantEvalSceneAssertion } from "./assistant-eval-format.js";

export interface AssistantDeterministicCheck {
  id: string;
  passed: boolean;
  message?: string;
}

export function evaluateAssistantDeterministicChecks(
  answer: string,
  beats: AnswerBeat[],
  rubric: AssistantEvalRubric | undefined,
  initialState: PlainState,
  commandable: string[],
): AssistantDeterministicCheck[] {
  const checks: AssistantDeterministicCheck[] = [
    { id: "valid-response", passed: true },
  ];
  const exposedNames = commandable
    .filter((param) => param.includes("."))
    .filter((param) => answer.toLowerCase().includes(param.toLowerCase()));
  checks.push({
    id: "internal-parameter-names",
    passed: exposedNames.length === 0,
    ...(exposedNames.length ? { message: `answer exposes: ${exposedNames.join(", ")}` } : {}),
  });
  if (!rubric) return checks;

  const assignments = beats.flatMap((beat) => Object.entries(beat.set));
  const hasSceneAction = assignments.length > 0;
  const policyPassed =
    rubric.scene.policy === "optional" ||
    (rubric.scene.policy === "required" ? hasSceneAction : !hasSceneAction);
  checks.push({
    id: "scene-policy",
    passed: policyPassed,
    ...(!policyPassed
      ? { message: rubric.scene.policy === "required" ? "scene change is required" : "scene change is forbidden" }
      : {}),
  });

  for (const param of rubric.scene.preserve ?? []) {
    const changed = assignments.some(([assignedParam, value]) =>
      assignedParam === param && !sameValue(value, initialState[param]));
    checks.push({
      id: `preserve:${param}`,
      passed: !changed,
      ...(changed ? { message: `${param} must remain unchanged` } : {}),
    });
  }

  for (const param of rubric.scene.requiredChanges ?? []) {
    const changed = assignments.some(([assignedParam, value]) =>
      assignedParam === param && !sameValue(value, initialState[param]));
    checks.push({
      id: `required-change:${param}`,
      passed: changed,
      ...(!changed ? { message: `${param} must change` } : {}),
    });
  }

  const finalState = Object.fromEntries(
    Object.entries(initialState).map(([param, value]) => [param, clone(value)]),
  );
  applyAnswerState(finalState, beats);
  for (const [index, assertion] of (rubric.scene.assertions ?? []).entries()) {
    const actual = finalState[assertion.param];
    const passed = assertionPassed(actual, assertion.operator, assertion.value);
    checks.push({
      id: `scene-assertion:${index + 1}`,
      passed,
      ...(!passed
        ? { message: `${assertion.param} must be ${assertion.operator} ${JSON.stringify(assertion.value)}` }
        : {}),
    });
  }
  return checks;
}

function assertionPassed(
  actual: ParamValue | undefined,
  operator: AssistantEvalSceneAssertion["operator"],
  expected: ParamValue,
): boolean {
  if (operator === "eq") return sameValue(actual, expected);
  if (typeof actual !== "number" || typeof expected !== "number") return false;
  if (operator === "lt") return actual < expected;
  if (operator === "lte") return actual <= expected;
  if (operator === "gt") return actual > expected;
  return actual >= expected;
}

function sameValue(a: ParamValue | undefined, b: ParamValue | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyAnswerState(state: PlainState, beats: AnswerBeat[]): void {
  for (const beat of beats) {
    for (const [param, value] of Object.entries(beat.set)) state[param] = clone(value);
  }
}

function clone(value: ParamValue): ParamValue {
  if (Array.isArray(value)) return value.slice();
  if (typeof value === "object" && value !== null) return { ...value, target: [...value.target] };
  return value;
}
