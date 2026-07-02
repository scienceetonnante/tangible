#!/usr/bin/env node
// @xv/cli — the `lesson` command. Wires the compiler + fake TTS for M0
// (check/build/state/ref/new). ElevenLabs selection arrives in M3.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { createHash } from "node:crypto";
import { parseScript, check, compile, emit, synthesize, formatDiagnostic } from "@xv/compiler";
import type { SceneInfo } from "@xv/compiler";
import { buildIndex, evaluate } from "@xv/core";
import type { Schema, Keyframe, TtsAdapter } from "@xv/core";
import { FakeTtsAdapter, ElevenLabsAdapter } from "@xv/tts";
import { loadScene } from "./scene-loader.js";
import { loadManifest, type Manifest } from "./manifest.js";
import { refSheet } from "./ref.js";
import { scaffold } from "./scaffold.js";

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flags = parseFlags(argv.slice(1));

  switch (cmd) {
    case "new":
      await scaffold(argv[1] ?? die("usage: lesson new <id>"));
      return;
    case "check":
      process.exit(await cmdCheck(flags));
      break;
    case "build":
      await cmdBuild(flags);
      return;
    case "state":
      await cmdState(flags);
      return;
    case "ref":
      await cmdRef(flags);
      return;
    default:
      die(`unknown command "${cmd ?? ""}"\nusage: lesson <new|check|build|state|ref> [--lang fr] [--lesson dir] [--at t]`);
  }
}

// --- commands ---

async function cmdCheck(flags: Flags): Promise<number> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const scene = await loadScene(join(lessonDir, manifest.scene));
  let errors = 0;
  for (const lang of languagesFor(flags, manifest)) {
    const file = `script.${lang}.md`;
    const diags = check(parseScript(await readFile(join(lessonDir, file), "utf8"), file), scene);
    for (const d of diags) {
      console.error(formatDiagnostic(d));
      if (d.severity === "error") errors++;
    }
  }
  console.error(errors === 0 ? "check: no errors" : `check: ${errors} error(s)`);
  return errors === 0 ? 0 : 1;
}

async function cmdBuild(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const scene = await loadScene(join(lessonDir, manifest.scene));
  for (const lang of languagesFor(flags, manifest)) {
    await buildLanguage(lessonDir, manifest, scene, lang, flags.fake ?? false);
    console.error(`built ${manifest.id} [${lang}] → build/${lang}/`);
  }
}

/** Choose a TTS adapter from the manifest voice spec ("elevenlabs:ID"). */
function selectTts(voiceSpec: string, fake: boolean): { adapter: TtsAdapter; voice: string } {
  const [provider, id] = voiceSpec.split(":");
  if (!fake && provider === "elevenlabs" && process.env.ELEVENLABS_API_KEY) {
    return { adapter: new ElevenLabsAdapter(), voice: id ?? "" };
  }
  if (!fake && provider === "elevenlabs") console.error("note: ELEVENLABS_API_KEY not set — using fake TTS");
  return { adapter: new FakeTtsAdapter(), voice: voiceSpec };
}

async function buildLanguage(lessonDir: string, manifest: Manifest, scene: SceneInfo, lang: string, fake: boolean) {
  const file = `script.${lang}.md`;
  const script = await readFile(join(lessonDir, file), "utf8");
  const parsed = parseScript(script, file);

  const errs = check(parsed, scene).filter((d) => d.severity === "error");
  if (errs.length) {
    for (const d of errs) console.error(formatDiagnostic(d));
    die(`build aborted: ${errs.length} error(s) in ${file}`);
  }

  const { adapter, voice } = selectTts(manifest.voice[lang] ?? "", fake);
  const result = await synthesize(adapter, parsed.narration, {
    voice,
    language: lang,
    cacheDir: join(lessonDir, ".cache", "tts"),
  });

  const audioHash = createHash("sha256").update(result.audio).digest("hex").slice(0, 16);
  const compiled = compile(script, result, scene, {
    lessonId: manifest.id,
    language: lang,
    defaults: manifest.defaults,
    audioSrc: ["audio.wav"],
    audioHash,
  });
  for (const w of compiled.warnings) console.error(formatDiagnostic(w));
  await emit(join(lessonDir, "build", lang), compiled, result.audio);
}

async function cmdState(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const lang = flags.lang ?? manifest.languages[0]!;
  const t = flags.at ?? die("usage: lesson state --at <seconds>");
  const scene = await loadScene(join(lessonDir, manifest.scene));
  const tracksPath = join(lessonDir, "build", lang, "tracks.json");
  if (!existsSync(tracksPath)) die(`no build for [${lang}] — run "lesson build --lang ${lang}" first`);
  const data = JSON.parse(await readFile(tracksPath, "utf8")) as { tracks: Record<string, Keyframe[]> };
  const idx = buildIndex(data.tracks, { ...scene.schema, ...boardSpecs(data.tracks) });
  console.log(JSON.stringify(evaluate(idx, Number(t)), null, 2));
}

async function cmdRef(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const scene = await loadScene(join(lessonDir, manifest.scene));
  console.log(refSheet(manifest.id, scene));
}

// --- helpers ---

function languagesFor(flags: Flags, manifest: Manifest): string[] {
  const langs = flags.lang ? [flags.lang] : manifest.languages;
  return langs.filter((l) => existsSync(join(flags.lesson ?? process.cwd(), `script.${l}.md`)));
}

/** Derive interpolation specs for board.* tracks (not in the scene schema). */
function boardSpecs(tracks: Record<string, Keyframe[]>): Schema {
  const s: Schema = {};
  for (const key of Object.keys(tracks)) {
    if (!key.startsWith("board.")) continue;
    s[key] = key.includes(".highlight")
      ? { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" }
      : { type: { kind: "boardItem" }, default: "hidden", interpolate: "snap", ownership: "script" };
  }
  return s;
}

interface Flags {
  lang?: string;
  lesson?: string;
  at?: string;
  fake?: boolean;
}

function parseFlags(args: string[]): Flags {
  const f: Flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lang") f.lang = args[++i];
    else if (args[i] === "--at") f.at = args[++i];
    else if (args[i] === "--lesson") f.lesson = resolvePath(args[++i]!);
    else if (args[i] === "--fake") f.fake = true;
  }
  return f;
}

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

main().catch((e) => die(String(e instanceof Error ? (e.stack ?? e.message) : e)));
