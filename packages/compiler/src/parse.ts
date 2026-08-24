// Stage 1: parse — script.md → ParsedScript. Produces the stripped narration text
// (verbatim to TTS) plus a directive list; each directive knows its anchor offset
// into the stripped text (the only thing TTS later turns into a time).

import { parse as parseYaml } from "yaml";
import type { CameraPatch } from "./camera.js";
import type { SourceLoc } from "./diagnostics.js";

export interface ParsedScript {
  frontMatter: Record<string, unknown>;
  narration: string; // stripped text for TTS
  directives: Directive[];
}

export type AtOffset = { kind: "delta"; seconds: number } | { kind: "sentence-end" };

export interface Options {
  over?: number; // seconds
  ease?: string;
  at?: AtOffset;
}

export interface BakeOptions extends Options {
  steps: number;
}

export interface Assignment {
  param: string;
  mode: "animate" | "set"; // "->" vs "="
  value: string; // raw token, interpreted against the schema later
}

interface Base {
  anchorOffset: number;
  block: boolean;
  loc: SourceLoc;
  raw: string; // the full "@name(...)" text, for diagnostics
}

export type Directive = Base &
  (
    | { kind: "cue"; assignments: Assignment[]; options: Options }
    | { kind: "bake"; name: string; options: BakeOptions }
    | { kind: "show" | "hide"; ids: string[] }
    | {
        kind: "camera";
        value: { kind: "preset"; name: string } | { kind: "inline"; patch: CameraPatch };
        options: Options;
      }
    | { kind: "track"; param: string; name: string }
    | { kind: "board"; id: string; itemKind: "katex" | "text"; source: string }
    | { kind: "highlight" | "dim" | "clear"; target: string }
    | { kind: "scene"; name: string }
    | { kind: "chapter"; title: string }
    | { kind: "pause"; prompt: string; speak: boolean }
    | { kind: "unknown"; name: string; argsText: string }
  );

export class ParseError extends Error {
  constructor(
    message: string,
    public loc: SourceLoc,
  ) {
    super(message);
  }
}

export function parseScript(src: string, file?: string): ParsedScript {
  const { frontMatter, body, bodyLine } = splitFrontMatter(src, file);
  const { textRaw, raws } = tokenize(body, bodyLine, file);
  const { text, map } = normalize(textRaw);

  const directives: Directive[] = raws.map((r) => {
    // Map the raw anchor into normalized text, then advance to the next word onset.
    let off = map[r.anchorRaw] ?? text.length;
    while (off < text.length && /\s/.test(text[off]!)) off++;
    return parseDirective(r, off);
  });

  return { frontMatter, narration: text, directives };
}

// --- front matter ---

function splitFrontMatter(
  src: string,
  file?: string,
): { frontMatter: Record<string, unknown>; body: string; bodyLine: number } {
  if (!src.startsWith("---\n") && !src.startsWith("---\r\n")) {
    return { frontMatter: {}, body: src, bodyLine: 1 };
  }
  const end = src.indexOf("\n---", 3);
  if (end === -1) throw new ParseError("unterminated front matter", { file, line: 1, col: 1 });
  const yamlText = src.slice(src.indexOf("\n") + 1, end);
  const afterFence = src.indexOf("\n", end + 1);
  const body = afterFence === -1 ? "" : src.slice(afterFence + 1);
  const bodyLine = src.slice(0, afterFence + 1).split("\n").length;
  const frontMatter = (parseYaml(yamlText) ?? {}) as Record<string, unknown>;
  return { frontMatter, body, bodyLine };
}

// --- tokenizer ---

interface RawDirective {
  name: string;
  argsText: string;
  anchorRaw: number; // offset into textRaw
  block: boolean;
  loc: SourceLoc;
  raw: string;
}

function tokenize(body: string, startLine: number, file?: string): { textRaw: string; raws: RawDirective[] } {
  let textRaw = "";
  const raws: RawDirective[] = [];
  let line = startLine;
  let col = 1;
  let i = 0;

  const isLetter = (c: string | undefined) => !!c && /[a-zA-Z]/.test(c);

  while (i < body.length) {
    const c = body[i]!;
    if (body.startsWith("[[", i)) {
      const end = body.indexOf("]]", i + 2);
      if (end === -1) throw new ParseError("unterminated scene hint", { file, line, col });
      if (textRaw.length && !/\s$/.test(textRaw)) textRaw += " ";
      const consumeTo = end + 2;
      for (let k = i; k < consumeTo; k++) {
        if (body[k] === "\n") {
          line++;
          col = 1;
        } else col++;
      }
      i = consumeTo;
      continue;
    }
    if (c === "\\" && body[i + 1] === "@") {
      textRaw += "@";
      i += 2;
      col += 2;
      continue;
    }
    if (c === "@" && isLetter(body[i + 1])) {
      let j = i + 1;
      while (isLetter(body[j])) j++;
      const name = body.slice(i + 1, j);
      // Any "@name(...)" is a directive candidate; unknown names become "unknown"
      // so check can flag them with a suggestion. Literal "@" is escaped as "\@".
      if (body[j] === "(") {
        const { argsText, end } = scanArgs(body, j, { file, line, col });
        const raw = body.slice(i, end);
        const lineStart = body.lastIndexOf("\n", i) + 1;
        const beforeBlank = body.slice(lineStart, i).trim() === "";
        const nextNl = body.indexOf("\n", end);
        const afterBlank = body.slice(end, nextNl === -1 ? body.length : nextNl).trim() === "";
        const block = beforeBlank && afterBlank;
        // A @pause narrates its prompt: inject it into the spoken text and anchor
        // the checkpoint just after it, so the voice reads the instruction before
        // playback pauses. `speak: false` opts out.
        if (name === "pause") {
          const spoken = spokenPausePrompt(argsText);
          if (spoken) {
            if (textRaw.length && !/\s$/.test(textRaw)) textRaw += " ";
            textRaw += spoken;
          }
        }
        raws.push({ name, argsText, anchorRaw: textRaw.length, block, loc: { file, line, col }, raw });
        // Advance past the directive (and its own line's trailing newline if block).
        const consumeTo = block && nextNl !== -1 ? nextNl + 1 : end;
        for (let k = i; k < consumeTo; k++) {
          if (body[k] === "\n") {
            line++;
            col = 1;
          } else col++;
        }
        i = consumeTo;
        continue;
      }
    }
    textRaw += c;
    if (c === "\n") {
      line++;
      col = 1;
    } else col++;
    i++;
  }
  return { textRaw, raws };
}

/** Scan a balanced-paren argument list starting at the "(" index; respects $…$ and "…". */
function scanArgs(body: string, openIdx: number, loc: SourceLoc): { argsText: string; end: number } {
  let depth = 0;
  let mode: "normal" | "math" | "quote" = "normal";
  for (let i = openIdx; i < body.length; i++) {
    const c = body[i]!;
    if (mode === "math") {
      if (c === "$") mode = "normal";
      continue;
    }
    if (mode === "quote") {
      if (c === '"') mode = "normal";
      continue;
    }
    if (c === "$") mode = "math";
    else if (c === '"') mode = "quote";
    else if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return { argsText: body.slice(openIdx + 1, i), end: i + 1 };
    }
  }
  throw new ParseError("unterminated directive arguments", loc);
}

// --- whitespace normalization with an index map (raw index → normalized index) ---

function normalize(raw: string): { text: string; map: number[] } {
  const map = new Array<number>(raw.length + 1);
  let out = "";
  let pendingSpace = false;
  let pendingNewlines = 0;
  let started = false;

  for (let i = 0; i < raw.length; i++) {
    map[i] = out.length;
    const c = raw[i]!;
    if (c === "\n") {
      pendingNewlines++;
      pendingSpace = false;
    } else if (c === " " || c === "\t" || c === "\r") {
      if (started) pendingSpace = true;
    } else {
      if (started) {
        // A blank line (≥2 newlines) is a paragraph break; a soft wrap is a space.
        if (pendingNewlines >= 2) out += "\n\n";
        else if (pendingNewlines === 1 || pendingSpace) out += " ";
      }
      out += c;
      started = true;
      pendingSpace = false;
      pendingNewlines = 0;
    }
  }
  map[raw.length] = out.length;
  return { text: out, map };
}

// --- per-directive argument parsing ---

function parseDirective(r: RawDirective, anchorOffset: number): Directive {
  const base: Base = { anchorOffset, block: r.block, loc: r.loc, raw: r.raw };
  const a = r.argsText.trim();
  switch (r.name) {
    case "cue":
      return { ...base, kind: "cue", ...parseCueArgs(a, r.loc) };
    case "bake": {
      const parts = splitTop(a);
      const name = parts.shift()?.trim() ?? "";
      return { ...base, kind: "bake", name, options: parseBakeOptions(parts, r.loc) };
    }
    case "show":
    case "hide":
      return { ...base, kind: r.name, ids: splitTop(a).map((s) => s.trim()).filter(Boolean) };
    case "camera": {
      return { ...base, kind: "camera", ...parseCameraArgs(a, r.loc) };
    }
    case "track": {
      const parts = splitTop(a).map((s) => s.trim());
      return { ...base, kind: "track", param: parts[0] ?? "", name: stripQuotes(parts[1] ?? "") };
    }
    case "board": {
      const ci = a.indexOf(":");
      if (ci === -1) throw new ParseError('@board expects "id: $katex$" or \'id: "text"\'', r.loc);
      const id = a.slice(0, ci).trim();
      const rhs = a.slice(ci + 1).trim();
      if (rhs.startsWith("$")) return { ...base, kind: "board", id, itemKind: "katex", source: rhs.replace(/^\$|\$$/g, "") };
      return { ...base, kind: "board", id, itemKind: "text", source: stripQuotes(rhs) };
    }
    case "highlight":
    case "dim":
    case "clear":
      return { ...base, kind: r.name, target: a };
    case "scene":
      return { ...base, kind: "scene", name: a };
    case "chapter":
      return { ...base, kind: "chapter", title: a };
    case "pause":
      return { ...base, kind: "pause", prompt: pausePromptText(a), speak: !/\bspeak\s*:\s*false\b/.test(a) };
    default:
      return { ...base, kind: "unknown", name: r.name, argsText: a };
  }
}

function parseCueArgs(a: string, loc: SourceLoc): { assignments: Assignment[]; options: Options } {
  const assignments: Assignment[] = [];
  const optionParts: string[] = [];
  for (const part of splitTop(a)) {
    const p = part.trim();
    if (!p) continue;
    if (/^(over|ease|at)\s*:/.test(p)) {
      optionParts.push(p);
    } else if (p.includes("->")) {
      const [param, value] = splitOnce(p, "->");
      assignments.push({ param: param.trim(), mode: "animate", value: value.trim() });
    } else if (p.includes("=")) {
      const [param, value] = splitOnce(p, "=");
      assignments.push({ param: param.trim(), mode: "set", value: value.trim() });
    } else {
      throw new ParseError(`@cue: cannot parse "${p}" (expected "param -> value", "param = value", or an option)`, loc);
    }
  }
  return { assignments, options: parseOptions(optionParts, loc) };
}

function parseCameraArgs(
  a: string,
  loc: SourceLoc,
): {
  value: { kind: "preset"; name: string } | { kind: "inline"; patch: CameraPatch };
  options: Options;
} {
  const parts = splitTop(a).map((part) => part.trim()).filter(Boolean);
  const first = parts[0] ?? "";
  if (!first.includes(":")) {
    const name = parts.shift() ?? "";
    for (const part of parts) {
      const key = splitOnce(part, ":")[0].trim();
      if (["target", "distance", "azimuth", "elevation"].includes(key)) {
        throw new ParseError(`@camera cannot combine preset "${name}" with inline field "${key}"`, loc);
      }
    }
    return { value: { kind: "preset", name }, options: parseOptions(parts, loc) };
  }

  const patch: CameraPatch = {};
  const optionParts: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const [rawKey, rawValue] = splitOnce(part, ":");
    const key = rawKey.trim();
    const value = rawValue.trim();
    if (["over", "ease", "at"].includes(key)) {
      optionParts.push(part);
      continue;
    }
    if (!["target", "distance", "azimuth", "elevation"].includes(key)) {
      throw new ParseError(`unknown @camera field or option "${key}"`, loc);
    }
    if (seen.has(key)) throw new ParseError(`duplicate @camera field "${key}"`, loc);
    seen.add(key);

    if (key === "target") patch.target = parseCameraTarget(value, loc);
    else if (key === "distance") patch.distance = parseCameraDistance(value, loc);
    else if (key === "azimuth") patch.azimuth = parseCameraAngle(value, "azimuth", loc);
    else patch.elevation = parseCameraAngle(value, "elevation", loc);
  }
  if (seen.size === 0) {
    throw new ParseError("inline @camera expects at least one of target, distance, azimuth, or elevation", loc);
  }
  return { value: { kind: "inline", patch }, options: parseOptions(optionParts, loc) };
}

function parseCameraTarget(raw: string, loc: SourceLoc): [number, number, number] {
  const match = /^\[(.*)\]$/s.exec(raw);
  const parts = match?.[1]?.split(",").map((part) => part.trim()) ?? [];
  const values = parts.map(Number);
  if (
    values.length !== 3 ||
    !parts.every((part) => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(part)) ||
    !values.every(Number.isFinite)
  ) {
    throw new ParseError(`@camera target expects three numbers like [0, 1, 0], got "${raw}"`, loc);
  }
  return values as [number, number, number];
}

function parseCameraDistance(raw: string, loc: SourceLoc): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) {
    throw new ParseError(`@camera distance expects a finite number, got "${raw}"`, loc);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new ParseError(`@camera distance expects a finite number, got "${raw}"`, loc);
  }
  if (value <= 0) {
    throw new ParseError(`@camera distance expects a positive number, got "${raw}"`, loc);
  }
  return value;
}

function parseCameraAngle(raw: string, field: string, loc: SourceLoc): number {
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(?:deg|°)?$/.exec(raw);
  const degrees = match ? Number(match[1]) : Number.NaN;
  if (!Number.isFinite(degrees)) {
    throw new ParseError(`@camera ${field} expects an angle like 45, 45deg, or 45°, got "${raw}"`, loc);
  }
  return (degrees * Math.PI) / 180;
}

function parseBakeOptions(parts: string[], loc: SourceLoc): BakeOptions {
  let steps = 1;
  const optionParts: string[] = [];
  for (const part of parts) {
    const [key, raw] = splitOnce(part, ":");
    if (key.trim() !== "steps") {
      optionParts.push(part);
      continue;
    }
    const value = Number(raw.trim());
    if (!Number.isInteger(value) || value <= 0) {
      throw new ParseError(`@bake steps must be a positive integer, got "${raw.trim()}"`, loc);
    }
    steps = value;
  }
  return { ...parseOptions(optionParts, loc), steps };
}

function parseOptions(parts: string[], loc: SourceLoc): Options {
  const opts: Options = {};
  for (const part of parts) {
    const [k, v] = splitOnce(part, ":");
    const key = k.trim();
    const val = v.trim();
    if (key === "over") opts.over = parseDuration(val, loc);
    else if (key === "ease") opts.ease = val;
    else if (key === "at") opts.at = parseAt(val, loc);
    else throw new ParseError(`unknown option "${key}"`, loc);
  }
  return opts;
}

function parseDuration(v: string, loc: SourceLoc): number {
  const n = parseFloat(v.replace(/s$/, ""));
  if (!Number.isFinite(n)) throw new ParseError(`invalid duration "${v}"`, loc);
  return n;
}

function parseAt(v: string, loc: SourceLoc): AtOffset {
  if (v === "sentence-end") return { kind: "sentence-end" };
  const n = parseFloat(v.replace(/s$/, ""));
  if (!Number.isFinite(n)) throw new ParseError(`invalid at: offset "${v}"`, loc);
  return { kind: "delta", seconds: n };
}

// --- small helpers ---

/** Split on top-level commas, respecting [], (), "", $$ spans. */
function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let mode: "normal" | "math" | "quote" = "normal";
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (mode === "math") {
      if (c === "$") mode = "normal";
      continue;
    }
    if (mode === "quote") {
      if (c === '"') mode = "normal";
      continue;
    }
    if (c === "$") mode = "math";
    else if (c === '"') mode = "quote";
    else if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === "," && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  return i === -1 ? [s, ""] : [s.slice(0, i), s.slice(i + sep.length)];
}

function stripQuotes(s: string): string {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

/** The prompt string of a @pause, from `prompt: "..."` (or a bare quoted arg). */
function pausePromptText(argsText: string): string {
  const m = /prompt\s*:\s*"([^"]*)"/.exec(argsText);
  return m ? m[1]! : stripQuotes(argsText);
}

/** The prompt to speak before a pause, or "" when `speak: false`. */
function spokenPausePrompt(argsText: string): string {
  if (/\bspeak\s*:\s*false\b/.test(argsText)) return "";
  return pausePromptText(argsText);
}
