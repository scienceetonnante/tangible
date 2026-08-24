// Timing-independent scene state for build-time bakers. This pass runs in script
// order for both `check` and `compile`; audio timing only places its computed steps.

import { isDeepStrictEqual } from "node:util";
import type { BakerDefinition, OrbitState, ParamValue } from "@narrable/core";
import { validateValue } from "@narrable/core";
import { applyCameraPatch } from "./camera.js";
import type { SceneInfo } from "./check.js";
import type { Directive, ParsedScript } from "./parse.js";
import { parseGroup, parseValue } from "./value.js";
import { type Diagnostic, suggest } from "./diagnostics.js";

export type BakeDirective = Extract<Directive, { kind: "bake" }>;
export type BakeStep = Record<string, ParamValue>;

export interface AuthoredStateResult {
  state: Record<string, ParamValue>;
  bakes: Map<BakeDirective, BakeStep[]>;
  diagnostics: Diagnostic[];
}

/** Evaluate authored targets and baker output without consulting TTS timings. */
export function evaluateAuthoredState(parsed: ParsedScript, scene: SceneInfo): AuthoredStateResult {
  const state = Object.fromEntries(
    Object.entries(scene.schema).map(([param, spec]) => [param, structuredClone(spec.default)]),
  );
  const bakes = new Map<BakeDirective, BakeStep[]>();
  const diagnostics: Diagnostic[] = [];
  const constants = scene.constants ?? {};
  const err = (message: string, directive: Directive) =>
    diagnostics.push({ severity: "error", message, loc: directive.loc });

  const assignRaw = (param: string, raw: string) => {
    const spec = scene.schema[param];
    if (!spec) return;
    const { value } = parseValue(spec.type, raw, constants);
    if (value !== undefined) state[param] = structuredClone(value);
  };

  for (const directive of parsed.directives) {
    switch (directive.kind) {
      case "cue":
        for (const assignment of directive.assignments) {
          const group = scene.groups?.[assignment.param];
          if (!group) {
            assignRaw(assignment.param, assignment.value);
            continue;
          }
          const values = parseGroup(assignment.value);
          if (values?.length === group.length) group.forEach((param, i) => assignRaw(param, values[i]!));
        }
        break;
      case "show":
      case "hide":
        for (const id of directive.ids) {
          const param = `show.${id}`;
          if (param in scene.schema) state[param] = directive.kind === "show";
        }
        break;
      case "camera":
        if (directive.value.kind === "preset") {
          for (const [param, value] of Object.entries(scene.presets?.[directive.value.name] ?? {})) {
            if (param in scene.schema) state[param] = structuredClone(value);
          }
        } else if (scene.schema.camera?.type.kind === "orbit") {
          state.camera = applyCameraPatch(state.camera as OrbitState, directive.value.patch);
        }
        break;
      case "scene":
        if ("scene" in scene.schema) state.scene = directive.name;
        break;
      case "bake": {
        const baker = scene.bakers?.[directive.name];
        if (!baker) {
          const candidate = suggest(directive.name, Object.keys(scene.bakers ?? {}));
          err(`unknown baker "${directive.name}"${candidate ? ` — did you mean "${candidate}"?` : ""}`, directive);
          break;
        }
        if (!validateDependencies(directive, baker, scene, err)) break;
        const steps = runBaker(directive, baker, state, scene, err);
        if (!steps) break;
        bakes.set(directive, steps);
        for (const step of steps) {
          for (const param of baker.writes) state[param] = structuredClone(step[param]!);
        }
        break;
      }
      case "track":
      case "board":
      case "highlight":
      case "dim":
      case "clear":
      case "chapter":
      case "pause":
      case "unknown":
        break;
    }
  }

  return { state, bakes, diagnostics };
}

function validateDependencies(
  directive: BakeDirective,
  baker: BakerDefinition,
  scene: SceneInfo,
  err: (message: string, directive: Directive) => void,
): boolean {
  for (const param of baker.reads) {
    if (!(param in scene.schema)) {
      err(`baker "${directive.name}" reads unknown parameter "${param}"`, directive);
      return false;
    }
  }
  for (const param of baker.writes) {
    if (!(param in scene.schema)) {
      err(`baker "${directive.name}" writes unknown parameter "${param}"`, directive);
      return false;
    }
  }
  return true;
}

function runBaker(
  directive: BakeDirective,
  baker: BakerDefinition,
  state: Record<string, ParamValue>,
  scene: SceneInfo,
  err: (message: string, directive: Directive) => void,
): BakeStep[] | undefined {
  const input = Object.fromEntries(baker.reads.map((param) => [param, structuredClone(state[param]!)]));
  const options = { steps: directive.options.steps };
  let first: unknown;
  try {
    first = baker.run(structuredClone(input), options);
  } catch (cause) {
    err(`baker "${directive.name}" threw: ${messageOf(cause)}`, directive);
    return undefined;
  }
  if (!validateOutput(directive, baker, first, scene, err)) return undefined;

  const stable = structuredClone(first);
  let second: unknown;
  try {
    second = baker.run(structuredClone(input), options);
  } catch (cause) {
    err(`baker "${directive.name}" threw: ${messageOf(cause)}`, directive);
    return undefined;
  }
  if (!isDeepStrictEqual(stable, second)) {
    err(`baker "${directive.name}" returned different output for identical input`, directive);
    return undefined;
  }
  return stable;
}

function validateOutput(
  directive: BakeDirective,
  baker: BakerDefinition,
  output: unknown,
  scene: SceneInfo,
  err: (message: string, directive: Directive) => void,
): output is BakeStep[] {
  if (!Array.isArray(output)) {
    err(`baker "${directive.name}" must return an array of steps`, directive);
    return false;
  }
  if (output.length !== directive.options.steps) {
    err(
      `baker "${directive.name}" returned ${output.length} step(s), expected ${directive.options.steps}`,
      directive,
    );
    return false;
  }

  const writes = new Set(baker.writes);
  for (let i = 0; i < output.length; i++) {
    const step = output[i];
    if (!isRecord(step)) {
      err(`baker "${directive.name}" step ${i + 1} must be a parameter record`, directive);
      return false;
    }
    for (const param of baker.writes) {
      if (!Object.hasOwn(step, param)) {
        err(`baker "${directive.name}" step ${i + 1} is missing write "${param}"`, directive);
        return false;
      }
    }
    for (const param of Object.keys(step)) {
      if (!writes.has(param)) {
        err(`baker "${directive.name}" step ${i + 1} contains undeclared write "${param}"`, directive);
        return false;
      }
      const spec = scene.schema[param]!;
      const value = step[param] as ParamValue;
      const valueError = validateValue(spec.type, value);
      if (valueError) {
        err(`baker "${directive.name}" step ${i + 1}, ${param}: ${valueError}`, directive);
        return false;
      }
      if (spec.type.kind === "scalar" && spec.type.range && typeof value === "number") {
        const [lo, hi] = spec.type.range;
        if (value < lo || value > hi) {
          err(`baker "${directive.name}" step ${i + 1}, ${param}: ${value} is out of range [${lo}, ${hi}]`, directive);
          return false;
        }
      }
    }
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
