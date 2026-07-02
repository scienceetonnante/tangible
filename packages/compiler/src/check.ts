// Stage 2: check — validate a ParsedScript against the scene schema, presets,
// constants, and board items. No network. Produces precise, actionable diagnostics
// (the agent's feedback loop).

import type { Schema, ParamValue } from "@xv/core";
import { isEasing } from "@xv/core";
import type { ParsedScript, Options } from "./parse.js";
import { parseValue, type Constants } from "./value.js";
import { type Diagnostic, type SourceLoc, suggest } from "./diagnostics.js";

export interface SceneInfo {
  schema: Schema;
  presets?: Record<string, Record<string, ParamValue>>;
  constants?: Constants;
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
          if (!checkParam(asn.param, d.loc)) continue;
          const spec = scene.schema[asn.param]!;
          const { error } = parseValue(spec.type, asn.value, constants);
          if (error) err(`${asn.param}: ${error}`, d.loc);
        }
        checkEase(d.options, d.loc);
        break;
      }
      case "show":
      case "hide": {
        for (const id of d.ids) checkParam(`show.${id}`, d.loc);
        break;
      }
      case "camera": {
        if (!(d.preset in presets)) {
          const s = suggest(d.preset, Object.keys(presets));
          err(`unknown camera preset "${d.preset}"${s ? ` — did you mean "${s}"?` : ""}`, d.loc);
        }
        checkParam("camera", d.loc);
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
        const known = ["cue", "show", "hide", "camera", "track", "board", "highlight", "dim", "clear", "scene", "chapter", "pause"];
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

  return diags;
}
