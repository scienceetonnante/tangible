// Stage 5: expand — resolved cues → dense per-parameter Keyframe[] tracks, plus
// chapters, pauses, and board items. Instant sets become hold boundaries; animated
// cues become {from},{to,ease} pairs. Overlapping transitions on one parameter are
// truncated at the new cue's start (conflict rule) with a warning. Recorded tracks
// are merged verbatim. All easing/timing is baked here so the runtime stays dumb.

import type { Keyframe, ParamValue, ParamSpec, BoardItem } from "@narrable/core";
import { buildIndex, evaluate } from "@narrable/core";
import type { ResolvedCue } from "./resolve.js";
import type { SceneInfo } from "./check.js";
import { parseValue, parseGroup } from "./value.js";
import type { Diagnostic } from "./diagnostics.js";
import type { BakeDirective, BakeStep } from "./authored-state.js";

export interface ExpandOptions {
  language: string;
  defaults: { ease: string; transition: number };
  recorded?: Record<string, Keyframe[]>; // param → recorded keyframes (from @track assets)
  recordedPaths?: Record<string, string>; // param → asset path
  bakes?: Map<BakeDirective, BakeStep[]>;
}

export interface ExpandResult {
  tracks: Record<string, Keyframe[]>;
  chapters: { t: number; title: string }[];
  pauses: { t: number; id: string; prompt: string }[];
  boardItems: Record<string, BoardItem>;
  recorded: Record<string, string>;
  warnings: Diagnostic[];
}

interface Builder {
  spec: ParamSpec;
  kf: Keyframe[];
  current: ParamValue;
  runningEnd: number; // end time of any in-flight transition
  startLoc?: Diagnostic["loc"]; // source of the in-flight transition (for the truncation warning)
}

export function expand(cues: ResolvedCue[], scene: SceneInfo, opts: ExpandOptions): ExpandResult {
  const constants = scene.constants ?? {};
  const presets = scene.presets ?? {};
  const warnings: Diagnostic[] = [];
  // Each truncation of an in-flight transition; grouped into one warning per truncating cue below.
  const truncations: { cutBy: Diagnostic["loc"]; startedAt?: Diagnostic["loc"]; param: string }[] = [];
  const builders = new Map<string, Builder>();
  const boardItems: Record<string, BoardItem> = {};
  const highlightsByItem = new Map<string, Set<string>>(); // item → highlight param keys
  const chapters: { t: number; title: string }[] = [];
  const pauses: { t: number; id: string; prompt: string }[] = [];

  // Derive a spec for board/highlight params (not in the scene schema).
  const boardSpec = (): ParamSpec => ({ type: { kind: "boardItem" }, default: "hidden", interpolate: "snap", ownership: "script" });
  const flagSpec = (): ParamSpec => ({ type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" });

  function builder(param: string, spec: ParamSpec): Builder {
    let b = builders.get(param);
    if (!b) {
      b = { spec, kf: [], current: spec.default, runningEnd: -Infinity };
      builders.set(param, b);
    }
    return b;
  }

  // Truncate an in-flight transition at time t, folding its interpolated value in.
  function truncate(b: Builder, param: string, t: number, cutBy: Diagnostic["loc"]) {
    if (t >= b.runningEnd || b.kf.length < 2) return;
    const last = b.kf[b.kf.length - 1]!;
    const idx = buildIndex({ tmp: b.kf.slice(-2) }, { tmp: b.spec });
    const iv = structuredClone(evaluate(idx, t).tmp!);
    last.t = t;
    last.v = iv;
    b.current = iv;
    b.runningEnd = t;
    truncations.push({ cutBy, startedAt: b.startLoc, param });
  }

  function setInstant(param: string, spec: ParamSpec, t: number, v: ParamValue, loc: Diagnostic["loc"]) {
    const b = builder(param, spec);
    truncate(b, param, t, loc);
    b.kf.push({ t, v });
    b.current = v;
    b.runningEnd = t;
    b.startLoc = undefined; // an instant set leaves no in-flight transition
  }

  function setAnimate(param: string, spec: ParamSpec, t: number, dur: number, ease: string, v: ParamValue, loc: Diagnostic["loc"]) {
    const b = builder(param, spec);
    truncate(b, param, t, loc);
    b.kf.push({ t, v: b.current });
    b.kf.push({ t: t + dur, v, ease });
    b.current = v;
    b.runningEnd = t + dur;
    b.startLoc = loc; // this cue owns the now-in-flight transition
  }

  for (const { t, directive: d } of cues) {
    const loc = d.loc;
    switch (d.kind) {
      case "cue": {
        const apply = (param: string, mode: "animate" | "set", raw: string) => {
          const spec = scene.schema[param];
          if (!spec) return; // check already reported unknown params
          const { value } = parseValue(spec.type, raw, constants);
          if (value === undefined) return;
          if (mode === "animate") setAnimate(param, spec, t, d.options.over ?? opts.defaults.transition, d.options.ease ?? opts.defaults.ease, value, loc);
          else setInstant(param, spec, t, value, loc);
        };
        for (const asn of d.assignments) {
          const group = scene.groups?.[asn.param];
          if (group) {
            const vals = parseGroup(asn.value);
            if (vals && vals.length === group.length) group.forEach((p, i) => apply(p, asn.mode, vals[i]!));
            continue; // malformed groups are reported by check
          }
          apply(asn.param, asn.mode, asn.value);
        }
        break;
      }
      case "show":
      case "hide": {
        for (const id of d.ids) {
          const param = `show.${id}`;
          const spec = scene.schema[param];
          if (spec) setInstant(param, spec, t, d.kind === "show", loc);
        }
        break;
      }
      case "camera": {
        const preset = presets[d.preset];
        if (!preset) break;
        for (const [param, value] of Object.entries(preset)) {
          const spec = scene.schema[param];
          if (!spec) continue;
          if (d.options.over) setAnimate(param, spec, t, d.options.over, d.options.ease ?? opts.defaults.ease, value, loc);
          else setInstant(param, spec, t, value, loc);
        }
        break;
      }
      case "scene": {
        const spec = scene.schema["scene"];
        if (spec) setInstant("scene", spec, t, d.name, loc);
        break;
      }
      case "bake": {
        const steps = opts.bakes?.get(d);
        const baker = scene.bakers?.[d.name];
        if (!steps || !baker) break;
        const totalDuration = d.options.over ?? opts.defaults.transition * d.options.steps;
        const segmentDuration = totalDuration / d.options.steps;
        const ease = d.options.ease ?? opts.defaults.ease;
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]!;
          const segmentStart = t + i * segmentDuration;
          for (const param of baker.writes) {
            setAnimate(param, scene.schema[param]!, segmentStart, segmentDuration, ease, step[param]!, loc);
          }
        }
        break;
      }
      case "board": {
        boardItems[d.id] = { kind: d.itemKind, source: { [opts.language]: d.source } };
        setInstant(`board.${d.id}`, boardSpec(), t, "shown", loc);
        break;
      }
      case "dim": {
        setInstant(`board.${d.target}`, boardSpec(), t, "dimmed", loc);
        clearHighlights(d.target, t, loc);
        break;
      }
      case "clear": {
        if (d.target === "board") {
          for (const key of builders.keys()) if (key.startsWith("board.") && !key.includes(".highlight")) setInstant(key, boardSpec(), t, "hidden", loc);
          for (const item of highlightsByItem.keys()) clearHighlights(item, t, loc);
        } else {
          setInstant(`board.${d.target}`, boardSpec(), t, "hidden", loc);
          clearHighlights(d.target, t, loc);
        }
        break;
      }
      case "highlight": {
        const [item, tag] = d.target.split(".");
        const key = tag ? `board.${item}.highlight.${tag}` : `board.${item}.highlight`;
        setInstant(key, flagSpec(), t, true, loc);
        if (item) {
          if (!highlightsByItem.has(item)) highlightsByItem.set(item, new Set());
          highlightsByItem.get(item)!.add(key);
        }
        break;
      }
      case "chapter":
        chapters.push({ t, title: d.title });
        break;
      case "pause":
        pauses.push({ t, id: `pause-${pauses.length}`, prompt: d.prompt });
        break;
      case "track":
      case "unknown":
        break;
    }
  }

  function clearHighlights(item: string, t: number, loc: Diagnostic["loc"]) {
    for (const key of highlightsByItem.get(item) ?? []) setInstant(key, flagSpec(), t, false, loc);
  }

  // One warning per truncating cue (not per assignment), naming the affected params
  // and the source line(s) where the transitions it cut began.
  const byCue = new Map<string, typeof truncations>();
  for (const tr of truncations) {
    const k = `${tr.cutBy.line}:${tr.cutBy.col}`;
    if (!byCue.has(k)) byCue.set(k, []);
    byCue.get(k)!.push(tr);
  }
  for (const group of byCue.values()) {
    const params = group.map((g) => g.param);
    const lines = [...new Set(group.map((g) => g.startedAt?.line).filter((l): l is number => l !== undefined))].sort((a, b) => a - b);
    const where = lines.length ? ` (started at line ${lines.join(", ")})` : "";
    warnings.push({ severity: "warning", message: `overlapping transition truncated: this cue cut ${params.length} in-flight transition(s)${where}: ${params.join(", ")}`, loc: group[0]!.cutBy });
  }

  // Assemble tracks; merge recorded tracks verbatim (error on cue/recorded conflict).
  const tracks: Record<string, Keyframe[]> = {};
  for (const [param, b] of builders) tracks[param] = b.kf;
  const recorded: Record<string, string> = {};
  for (const [param, kf] of Object.entries(opts.recorded ?? {})) {
    if (tracks[param]?.length) {
      warnings.push({ severity: "error", message: `recorded track "${param}" conflicts with cue-generated keyframes on the same parameter`, loc: { line: 0, col: 0 } });
      continue;
    }
    tracks[param] = kf;
    if (opts.recordedPaths?.[param]) recorded[param] = opts.recordedPaths[param];
  }

  return { tracks, chapters, pauses, boardItems, recorded, warnings };
}
