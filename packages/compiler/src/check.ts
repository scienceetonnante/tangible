// Stage 2: check — validate a ParsedScript against the scene schema, presets,
// constants, and board items. No network. Produces precise, actionable diagnostics
// (the agent's feedback loop).

import type { Schema, ParamValue, Bakers } from "@tangible/core";
import { isEasing } from "@tangible/core";
import type { ParsedScript, Options } from "./parse.js";
import { parseValue, parseGroup, type Constants } from "./value.js";
import { type Diagnostic, type SourceLoc, suggest } from "./diagnostics.js";
import { evaluateAuthoredState } from "./authored-state.js";

export interface SceneInfo {
  schema: Schema;
  presets?: Record<string, Record<string, ParamValue>>;
  constants?: Constants;
  groups?: Record<string, string[]>; // named parameter groups: `@cue(name -> [v1, v2, ...])`
  bakers?: Bakers;
}

export interface CheckOptions {
  assetExists?: (name: string) => boolean; // for @track asset validation
}

export function check(parsed: ParsedScript, scene: SceneInfo, opts: CheckOptions = {}): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const keys = Object.keys(scene.schema);
  const presets = scene.presets ?? {};
  const constants = scene.constants ?? {};

  // First pass: collect board item sources (order-independent existence check).
  const boardSources = new Map<string, string>();
  for (const d of parsed.directives) if (d.kind === "board") boardSources.set(d.id, d.source);

  const err = (message: string, loc: SourceLoc) => diags.push({ severity: "error", message, loc });

  const checkParam = (param: string, loc: SourceLoc): boolean => {
    if (param in scene.schema) return true;
    const s = suggest(param, keys);
    err(`unknown parameter "${param}"${s ? ` — did you mean "${s}"?` : ""}`, loc);
    return false;
  };

  const checkEase = (options: Options, loc: SourceLoc) => {
    if (options.ease && !isEasing(options.ease)) {
      err(`unknown easing "${options.ease}"`, loc);
    }
  };

  for (const d of parsed.directives) {
    switch (d.kind) {
      case "cue": {
        for (const asn of d.assignments) {
          const group = scene.groups?.[asn.param];
          if (group) {
            const vals = parseGroup(asn.value);
            if (!vals) {
              err(`group "${asn.param}" expects a list value like [a, b, c], got "${asn.value}"`, d.loc);
            } else if (vals.length !== group.length) {
              err(`group "${asn.param}" has ${group.length} parameter(s) but got ${vals.length} value(s)`, d.loc);
            } else {
              group.forEach((p, i) => {
                const spec = scene.schema[p];
                if (!spec) return err(`group "${asn.param}" references unknown parameter "${p}"`, d.loc);
                const { error } = parseValue(spec.type, vals[i]!, constants);
                if (error) err(`${p} (in group ${asn.param}): ${error}`, d.loc);
              });
            }
            continue;
          }
          if (!checkParam(asn.param, d.loc)) continue;
          const spec = scene.schema[asn.param]!;
          const { error } = parseValue(spec.type, asn.value, constants);
          if (error) err(`${asn.param}: ${error}`, d.loc);
        }
        checkEase(d.options, d.loc);
        break;
      }
      case "bake":
        checkEase(d.options, d.loc);
        break;
      case "show":
      case "hide": {
        for (const id of d.ids) checkParam(`show.${id}`, d.loc);
        break;
      }
      case "camera": {
        if (d.value.kind === "preset" && !(d.value.name in presets)) {
          const s = suggest(d.value.name, Object.keys(presets));
          err(`unknown camera preset "${d.value.name}"${s ? ` — did you mean "${s}"?` : ""}`, d.loc);
        }
        if (checkParam("camera", d.loc) && d.value.kind === "inline" && scene.schema.camera!.type.kind !== "orbit") {
          err('inline @camera values require parameter "camera" to have type "orbit"', d.loc);
        }
        checkEase(d.options, d.loc);
        break;
      }
      case "track": {
        checkParam(d.param, d.loc);
        if (opts.assetExists && !opts.assetExists(d.name)) {
          err(`@track references missing asset "${d.name}"`, d.loc);
        }
        break;
      }
      case "highlight":
      case "dim":
      case "clear": {
        if (d.kind === "clear" && d.target === "board") break;
        const [item, tag] = d.target.split(".");
        if (!item || !boardSources.has(item)) {
          err(`@${d.kind} references unknown board item "${item ?? d.target}"`, d.loc);
        } else if (tag && !boardSources.get(item)!.includes(`\\htmlClass{${tag}}`)) {
          err(`@highlight target "${d.target}" is not tagged \\htmlClass{${tag}}{…} in board item "${item}"`, d.loc);
        }
        break;
      }
      case "scene": {
        const sceneSpec = scene.schema["scene"];
        if (sceneSpec?.type.kind === "enum" && !sceneSpec.type.values.includes(d.name)) {
          const s = suggest(d.name, sceneSpec.type.values);
          err(`unknown scene "${d.name}"${s ? ` — did you mean "${s}"?` : ""}`, d.loc);
        }
        break;
      }
      case "unknown": {
        const known = ["cue", "bake", "show", "hide", "camera", "track", "board", "highlight", "dim", "clear", "scene", "chapter", "pause"];
        const s = suggest(d.name, known);
        err(`unknown directive "@${d.name}"${s ? ` — did you mean "@${s}"?` : ""}`, d.loc);
        break;
      }
      case "board":
      case "chapter":
      case "pause":
        break;
    }
  }

  diags.push(...evaluateAuthoredState(parsed, scene).diagnostics);

  return diags;
}
