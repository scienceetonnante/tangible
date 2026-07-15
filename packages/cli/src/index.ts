#!/usr/bin/env node
// @narrable/cli — the `lesson` command. Wires authoring, compilation, TTS,
// inspection, preview, and static bundling.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { createHash } from "node:crypto";
import { parseScript, check, compile, emit, synthesize, formatDiagnostic } from "@narrable/compiler";
import type { SceneInfo } from "@narrable/compiler";
import { buildIndex, evaluate } from "@narrable/core";
import type { Schema, Keyframe, TtsAdapter, ParamSpec, ParamValue } from "@narrable/core";
import { StateStore, Reconciler } from "@narrable/player";
import { FakeTtsAdapter, ElevenLabsAdapter } from "@narrable/tts";
import { loadScene } from "./scene-loader.js";
import { loadManifest, type Manifest } from "./manifest.js";
import { refSheet } from "./ref.js";
import { scaffold } from "./scaffold.js";
import { bundleSite } from "./bundle.js";
import { renderFrame } from "./frame.js";
import { preview } from "./preview.js";
import { transcodeToM4a } from "./transcode.js";

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flags = parseFlags(argv.slice(1));

  loadDotenv(flags.lesson ?? process.cwd()); // pick up ELEVENLABS_API_KEY etc. from .env

  switch (cmd) {
    case "new":
      await scaffold(argv[1] ?? die("usage: lesson new <id> [--lesson dir] [--lang code]"), { dir: flags.lesson, lang: flags.lang });
      return;
    case "check":
      process.exit(await cmdCheck(flags));
      break;
    case "build":
      await cmdBuild(flags);
      return;
    case "frame":
      await cmdFrame(flags);
      return;
    case "preview":
      await cmdPreview(flags);
      return;
    case "state":
      await cmdState(flags);
      return;
    case "ref":
      await cmdRef(flags);
      return;
    default:
      die(`unknown command "${cmd ?? ""}"\nusage: lesson <new|check|build|frame|preview|state|ref> [--lang fr] [--lesson dir] [--at t] [--drag p=v] [--bundle] [-o file] [--size WxH] [--fake]`);
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
  const langs = languagesFor(flags, manifest);
  for (const lang of langs) {
    await buildLanguage(lessonDir, manifest, scene, lang, flags.fake ?? false);
    console.error(`built ${manifest.id} [${lang}] → build/${lang}/`);
  }
  if (flags.bundle) {
    const out = await bundleSite(lessonDir, manifest, join(lessonDir, manifest.scene), langs);
    console.error(`bundled static site → ${out}`);
  }
}

async function cmdFrame(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const lang = flags.lang ?? manifest.languages[0]!;
  const t = flags.at !== undefined ? Number(flags.at) : die("usage: lesson frame --at <t> -o <file.png>");
  const out = flags.out ?? die("usage: lesson frame --at <t> -o <file.png>");
  const siteDir = join(lessonDir, "build", "site");
  if (!existsSync(join(siteDir, "index.html"))) die('no static bundle — run "lesson build --bundle" first');
  await renderFrame(siteDir, { t, out, size: flags.size, lang });
  console.error(`rendered frame at t=${t} → ${out}`);
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
    speed: manifest.tts?.speed,
  });

  // Real-voice MP3 seeks imprecisely in browsers (voice drifts from the animation
  // after scrubbing); transcode to sample-indexed AAC/MP4. Timing is unchanged.
  let audio = result.audio;
  let format = result.format;
  if (format === "mp3") {
    audio = transcodeToM4a(audio);
    format = "m4a";
  }

  const audioHash = createHash("sha256").update(audio).digest("hex").slice(0, 16);
  const compiled = compile(script, result, scene, {
    lessonId: manifest.id,
    language: lang,
    file,
    defaults: manifest.defaults,
    audioSrc: [`audio.${format}`],
    audioHash,
  });
  for (const w of compiled.warnings) console.error(formatDiagnostic(w));
  await emit(join(lessonDir, "build", lang), compiled, audio);
}

async function cmdPreview(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const langs = languagesFor(flags, manifest);
  const rebuild = async () => {
    const scene = await loadScene(join(lessonDir, manifest.scene));
    // Same TTS selection as build; cached, so it only re-synthesizes on prose edits.
    // Pass --fake for a zero-cost loop while editing narration.
    for (const lang of langs) await buildLanguage(lessonDir, manifest, scene, lang, flags.fake ?? false);
    await bundleSite(lessonDir, manifest, join(lessonDir, manifest.scene), langs);
  };
  await rebuild();
  const watchPaths = [join(lessonDir, manifest.scene), ...langs.map((l) => join(lessonDir, `script.${l}.md`))];
  preview({ siteDir: join(lessonDir, "build", "site"), watchPaths, rebuild });
}

async function cmdState(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const lang = flags.lang ?? manifest.languages[0]!;
  const t = flags.at ?? die("usage: lesson state --at <seconds>");
  const scene = await loadScene(join(lessonDir, manifest.scene));
  const tracksPath = join(lessonDir, "build", lang, "tracks.json");
  if (!existsSync(tracksPath)) die(`no build for [${lang}] — run "lesson build --lang ${lang}" first`);
  const data = JSON.parse(await readFile(tracksPath, "utf8")) as { tracks: Record<string, Keyframe[]>; duration: number };
  const schema = { ...scene.schema, ...boardSpecs(data.tracks) };
  const idx = buildIndex(data.tracks, schema);

  if (flags.drag) {
    console.log(JSON.stringify(simulateDrag(idx, schema, scene.schema, data.duration, Number(t), flags.drag), null, 2));
    return;
  }
  console.log(JSON.stringify(evaluate(idx, Number(t)), null, 2));
}

// --- headless interaction check: simulate a viewer grab and report the reconciled trajectory ---

/** Parse "param=value"; validate the param is draggable (scalar/boolean) and in range. */
function parseDrag(spec: Record<string, ParamSpec>, drag: string): { param: string; value: ParamValue } {
  const eq = drag.indexOf("=");
  if (eq < 0) die('usage: --drag <param>=<value>');
  const param = drag.slice(0, eq).trim();
  const raw = drag.slice(eq + 1).trim();
  const s = spec[param] ?? die(`--drag: unknown parameter "${param}"`);
  if (s.type.kind === "boolean") return { param, value: raw === "true" };
  if (s.type.kind !== "scalar") die(`--drag: "${param}" is a ${s.type.kind}; only scalar/boolean params are supported`);
  const n = Number(raw);
  if (Number.isNaN(n)) die(`--drag: "${raw}" is not a number`);
  if (s.type.range && (n < s.type.range[0] || n > s.type.range[1])) die(`--drag: ${n} is out of range [${s.type.range[0]}, ${s.type.range[1]}] for "${param}"`);
  return { param, value: n };
}

/** Grab `param` at time `grabT`, release, then step the real Reconciler forward and
 *  sample scripted-vs-displayed until the display rejoins the timeline (or the window ends). */
function simulateDrag(idx: ReturnType<typeof buildIndex>, schema: Schema, sceneSchema: Record<string, ParamSpec>, duration: number, grabT: number, drag: string) {
  const { param, value } = parseDrag(sceneSchema, drag);
  const store = new StateStore(schema);
  const recon = new Reconciler(store, idx, schema);
  const seed = evaluate(idx, grabT);
  for (const k of Object.keys(schema)) store.set(k, seed[k]!);
  store.touch(param, value, grabT, grabT); // grabbed and released at grabT

  const dt = 1 / 60;
  const window = Math.min(duration - grabT, 8); // seconds of playback to simulate
  const every = 0.25;
  const round = (v: ParamValue) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v);
  const trajectory: { t: number; scripted: ParamValue; displayed: ParamValue; overriding: boolean }[] = [];
  let reconverged = false;
  let nextSample = 0;
  for (let i = 0; grabT + i * dt <= grabT + window + 1e-9; i++) {
    const tt = grabT + i * dt;
    const scripted = evaluate(idx, tt);
    recon.reconcile(scripted, tt, tt, dt); // now == media time (continuous playback from the grab)
    const overriding = store.meta.get(param)!.modified;
    if (tt - grabT >= nextSample - 1e-9) {
      trajectory.push({ t: Math.round(tt * 1000) / 1000, scripted: round(scripted[param]!), displayed: round(store.plain[param]!), overriding });
      nextSample += every;
    }
    if (!overriding && i > 0) { reconverged = true; break; }
  }
  return { param, ownership: sceneSchema[param]!.ownership, grabbedAt: grabT, userValue: value, reconverged, trajectory };
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
  bundle?: boolean;
  out?: string;
  size?: string;
  drag?: string;
}

function parseFlags(args: string[]): Flags {
  const f: Flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lang") f.lang = args[++i];
    else if (args[i] === "--at") f.at = args[++i];
    else if (args[i] === "--lesson") f.lesson = resolvePath(args[++i]!);
    else if (args[i] === "--fake") f.fake = true;
    else if (args[i] === "--bundle") f.bundle = true;
    else if (args[i] === "-o" || args[i] === "--out") f.out = args[++i];
    else if (args[i] === "--size") f.size = args[++i];
    else if (args[i] === "--drag") f.drag = args[++i];
  }
  return f;
}

/** Load .env from the current dir and the lesson dir (built-in, no dependency). */
function loadDotenv(lessonDir: string): void {
  for (const p of new Set([join(process.cwd(), ".env"), join(lessonDir, ".env")])) {
    // A .env that is absent — or present but unreadable (e.g. a sandbox read-deny) — is not fatal.
    if (existsSync(p)) try { process.loadEnvFile(p); } catch { /* unreadable .env is not fatal */ }
  }
}

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

main().catch((e) => die(String(e instanceof Error ? (e.stack ?? e.message) : e)));
