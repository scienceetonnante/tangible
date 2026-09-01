#!/usr/bin/env node
// @tangible/cli — the `lesson` command. Wires authoring, compilation, TTS,
// inspection, preview, and static bundling.

import { readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { createHash } from "node:crypto";
import { parseScript, check, compile, emit, synthesize, narrationSegmentOffsets, formatDiagnostic, ParseError } from "@tangible/compiler";
import type { SceneInfo } from "@tangible/compiler";
import { buildIndex, DEFAULT_ASSISTANT_LIMITS, evaluate, validateSchema } from "@tangible/core";
import type { Schema, Keyframe, TtsAdapter, ParamSpec, ParamValue } from "@tangible/core";
import { StateStore, Reconciler } from "@tangible/player";
import { FakeTtsAdapter, ElevenLabsAdapter, HuggingFaceVoiceAdapter, SupertonicTtsAdapter } from "@tangible/tts";
import { loadScene } from "./scene-loader.js";
import { loadManifest, loadSceneManifest, type Manifest, type TtsConfig } from "./manifest.js";
import { refSheet } from "./ref.js";
import { scaffold } from "./scaffold.js";
import { bundleSite } from "./bundle.js";
import { renderFrame } from "./frame.js";
import { preview } from "./preview.js";
import { browserAudioArtifacts } from "./transcode.js";
import { buildAssistantContext, emitAssistantContext } from "./assistant-context.js";
import { createAssistantApi, serveLesson } from "./assistant-server.js";
import { bundleScenePreview } from "./scene-preview-bundle.js";
import { runAssistantEval } from "./assistant-eval.js";
import { runAssistantEvalGrade } from "./assistant-eval-grade.js";
import { writeAssistantPromptLog } from "./assistant-prompt-log.js";
import { deployLessonToSpace } from "./deploy.js";

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flags = parseFlags(argv.slice(1));

  if (cmd !== "scene") loadDotenv(flags.lesson ?? process.cwd()); // scene preview never needs provider credentials

  switch (cmd) {
    case "new":
      await scaffold(argv[1] ?? die("usage: lesson new <id> [--lesson dir]"), { dir: flags.lesson });
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
    case "scene":
      await cmdScene(flags);
      return;
    case "serve":
      await cmdServe(flags);
      return;
    case "deploy":
      await cmdDeploy(flags);
      return;
    case "assistant-eval":
      await runAssistantEval({
        lessonDir: flags.lesson ?? process.cwd(),
        variant: flags.variant ?? "structured",
        real: flags.real ?? false,
        out: flags.out,
        configurationIds: flags.configurationIds,
        caseIds: flags.caseIds,
        repeats: flags.repeats,
      });
      return;
    case "assistant-eval-grade":
      await runAssistantEvalGrade({
        input: flags.input ?? die("usage: lesson assistant-eval-grade --input <assistant-results.json> [-o grades.json]"),
        out: flags.out,
        configurationIds: flags.configurationIds,
        caseIds: flags.caseIds,
      });
      return;
    case "state":
      await cmdState(flags);
      return;
    case "ref":
      await cmdRef(flags);
      return;
    default:
      die(`unknown command "${cmd ?? ""}"\nusage: lesson <new|check|build|frame|preview|scene|serve|deploy|assistant-eval|assistant-eval-grade|state|ref> [--lesson dir] [--input file] [--at t] [--drag p=v] [--bundle] [-o file] [--size WxH] [--port n] [--host address] [--offline] [--silent] [--real] [--create] [--dry-run] [--variant legacy|structured|both] [--configuration id[,id]] [--case id[,id]] [--repeats n]`);
  }
}

// --- commands ---

async function cmdCheck(flags: Flags): Promise<number> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const scene = await loadScene(join(lessonDir, manifest.scene), { requireRuntime: true });
  let errors = 0;
  const file = "script.md";
  const script = await readFile(join(lessonDir, file), "utf8");
  const diags = check(parseScript(script, file), scene);
  for (const d of diags) {
    console.error(formatDiagnostic(d));
    if (d.severity === "error") errors++;
  }
  try {
    await buildAssistantContext(lessonDir, manifest, scene, script);
  } catch (error) {
    console.error(`${file}: assistant: ${error instanceof Error ? error.message : String(error)}`);
    errors++;
  }
  console.error(errors === 0 ? "check: no errors" : `check: ${errors} error(s)`);
  return errors === 0 ? 0 : 1;
}

async function cmdBuild(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const scene = await loadScene(join(lessonDir, manifest.scene));
  await buildLesson(lessonDir, manifest, scene, narrationMode(flags));
  console.error(`built ${manifest.id} → build/lesson/`);
  if (flags.bundle) {
    const out = await bundleSite(lessonDir, manifest, join(lessonDir, manifest.scene));
    console.error(`bundled static site → ${out}`);
  }
}

async function cmdFrame(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const t = flags.at !== undefined ? Number(flags.at) : die("usage: lesson frame --at <t> -o <file.png>");
  const out = flags.out ?? die("usage: lesson frame --at <t> -o <file.png>");
  const siteDir = join(lessonDir, "build", "site");
  if (!existsSync(join(siteDir, "index.html"))) die('no static bundle — run "lesson build --bundle" first');
  await renderFrame(siteDir, { t, out, size: flags.size });
  console.error(`rendered frame at t=${t} → ${out}`);
}

type NarrationMode = "provider" | "offline" | "silent";

class LessonBuildError extends Error {}

/** Choose the configured provider, local draft voice, or silent test substitute. */
function selectTts(config: TtsConfig | undefined, mode: NarrationMode): { adapter: TtsAdapter; voice: string } {
  if (mode === "silent") return { adapter: new FakeTtsAdapter(), voice: config?.voice ?? "draft" };
  if (mode === "offline") {
    return {
      adapter: new SupertonicTtsAdapter({ onStatus: (message) => console.error(message) }),
      voice: "supertonic-3-speaker-0",
    };
  }
  if (!config) {
    throw new Error(
      'real narration requires a "tts" section in lesson.yaml; use --offline or --silent while drafting',
    );
  }
  if (config.provider === "hf-endpoint") {
    return {
      adapter: new HuggingFaceVoiceAdapter({
        speaker: config.voice,
        onStatus: (message) => console.error(message),
      }),
      voice: config.voice,
    };
  }
  if (process.env.ELEVENLABS_API_KEY) {
    return { adapter: new ElevenLabsAdapter({ modelId: config.model }), voice: config.voice };
  }
  console.error("note: ELEVENLABS_API_KEY not set — using silent placeholder audio");
  return { adapter: new FakeTtsAdapter(), voice: config.voice };
}

async function buildLesson(lessonDir: string, manifest: Manifest, scene: SceneInfo, mode: NarrationMode, requireReal = false) {
  const file = "script.md";
  const script = await readFile(join(lessonDir, file), "utf8");
  const parsed = parseScript(script, file);

  const errs = check(parsed, scene).filter((d) => d.severity === "error");
  if (errs.length) {
    throw new LessonBuildError(
      `${errs.map(formatDiagnostic).join("\n")}\nbuild aborted: ${errs.length} error(s) in ${file}`,
    );
  }

  const { adapter, voice } = selectTts(manifest.tts, mode);
  if (requireReal && (adapter.id === "fake" || adapter.id === "supertonic")) {
    throw new Error("lesson deploy requires real narration; configure credentials for the selected TTS provider");
  }
  const result = await synthesize(adapter, parsed.narration, {
    voice,
    cacheDir: join(lessonDir, ".cache", "tts"),
    speed: manifest.tts?.provider === "elevenlabs" ? manifest.tts.speed : undefined,
    segmentOffsets: narrationSegmentOffsets(parsed.narration, parsed.directives.map((directive) => directive.anchorOffset)),
  });

  // Keep --silent hermetic. Every actual voice is converted to compact indexed
  // formats so provider WAV and MP3 never become browser delivery artifacts.
  const audioArtifacts = browserAudioArtifacts(adapter.id, result);
  const audioHashState = createHash("sha256");
  for (const artifact of audioArtifacts) audioHashState.update(artifact.format).update(artifact.audio);
  const audioHash = audioHashState.digest("hex").slice(0, 16);
  const audioFiles = Object.fromEntries(audioArtifacts.map((artifact) => [`audio.${artifact.format}`, artifact.audio]));
  const compiled = compile(script, result, scene, {
    lessonId: manifest.id,
    file,
    defaults: manifest.defaults,
    audioSrc: Object.keys(audioFiles),
    audioHash,
  });
  for (const w of compiled.warnings) console.error(formatDiagnostic(w));
  await emit(join(lessonDir, "build", "lesson"), compiled, audioFiles);
  await emitAssistantContext(lessonDir, manifest, scene, script);
}

async function cmdPreview(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const watchPaths = [
    join(lessonDir, manifest.scene),
    join(lessonDir, "script.md"),
    ...(manifest.assistant ? [join(lessonDir, manifest.assistant.context)] : []),
  ];
  const rebuild = async () => {
    try {
      const scene = await loadScene(join(lessonDir, manifest.scene));
      // Same TTS selection as build; cached, so it only re-synthesizes on prose edits.
      // Pass --offline for fast local narration while editing the lesson.
      await buildLesson(lessonDir, manifest, scene, narrationMode(flags));
      await bundleSite(lessonDir, manifest, join(lessonDir, manifest.scene));
    } catch (error) {
      throw new Error(authoringError(error));
    }
  };
  let initialError: string | undefined;
  try {
    await rebuild();
  } catch (error) {
    initialError = authoringError(error);
    console.error(`preview build failed:\n${initialError}`);
  }
  const siteDir = join(lessonDir, "build", "site");
  const onProviderRequest = async (request: Record<string, unknown>) => {
    const path = await writeAssistantPromptLog(lessonDir, request);
    console.error(`assistant prompt → ${path}`);
  };
  preview({
    siteDir,
    watchPaths,
    rebuild,
    port: flags.port,
    host: flags.host,
    assistantApi: manifest.assistant
      ? createAssistantApi({ siteDir, fake: noProviders(flags), limits: manifest.assistant.limits, onProviderRequest })
      : undefined,
    initialError,
  });
}

async function cmdScene(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadSceneManifest(lessonDir);
  const scenePath = resolvePath(lessonDir, manifest.scene);
  const rebuild = async () => {
    const info = await loadScene(scenePath, { requireRuntime: true });
    const errors = validateSchema(info.schema);
    if (errors.length) throw new Error(`invalid scene schema:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    return bundleScenePreview(lessonDir, manifest.id, manifest.scene);
  };
  const initial = await rebuild();
  preview({
    siteDir: initial.siteDir,
    watchPaths: initial.watchPaths,
    rebuild: async () => (await rebuild()).watchPaths,
    port: flags.port,
    host: flags.host,
    label: "scene preview",
  });
}

async function cmdServe(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const siteDir = join(lessonDir, "build", "site");
  if (!existsSync(join(siteDir, "index.html"))) die('no static bundle — run "lesson build --bundle" first');
  serveLesson({
    siteDir,
    port: flags.port,
    host: flags.host,
    fake: noProviders(flags),
    limits: manifest.assistant?.limits ?? DEFAULT_ASSISTANT_LIMITS,
    onProviderRequest: async (request) => {
      const path = await writeAssistantPromptLog(lessonDir, request);
      console.error(`assistant prompt → ${path}`);
    },
  });
}

async function cmdDeploy(flags: Flags): Promise<void> {
  if (flags.offline || flags.silent) die("lesson deploy does not support --offline or --silent because a release must contain real narration");
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  await deployLessonToSpace({
    lessonDir,
    manifest,
    create: flags.create,
    dryRun: flags.dryRun,
    check: async () => {
      if (await cmdCheck({ lesson: lessonDir })) throw new Error("lesson deploy stopped because lesson check failed");
    },
    build: async () => {
      const scene = await loadScene(join(lessonDir, manifest.scene));
      await buildLesson(lessonDir, manifest, scene, "provider", true);
      console.error(`built ${manifest.id} with real narration → build/lesson/`);
      await rm(join(lessonDir, "build", "site"), { recursive: true, force: true });
      const out = await bundleSite(lessonDir, manifest, join(lessonDir, manifest.scene));
      console.error(`bundled release site → ${out}`);
    },
  });
}

async function cmdState(flags: Flags): Promise<void> {
  const lessonDir = flags.lesson ?? process.cwd();
  const manifest = await loadManifest(lessonDir);
  const t = flags.at ?? die("usage: lesson state --at <seconds>");
  const scene = await loadScene(join(lessonDir, manifest.scene));
  const tracksPath = join(lessonDir, "build", "lesson", "tracks.json");
  if (!existsSync(tracksPath)) die('no lesson build — run "lesson build" first');
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
  store.touch(param, value, grabT); // grabbed and released at grabT

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
    recon.reconcile(scripted, tt, dt);
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
  lesson?: string;
  input?: string;
  at?: string;
  offline?: boolean;
  silent?: boolean;
  bundle?: boolean;
  out?: string;
  size?: string;
  drag?: string;
  port?: number;
  host?: string;
  real?: boolean;
  create?: boolean;
  dryRun?: boolean;
  variant?: "legacy" | "structured" | "both";
  configurationIds?: string[];
  caseIds?: string[];
  repeats?: number;
}

function parseFlags(args: string[]): Flags {
  const f: Flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--at") f.at = args[++i];
    else if (args[i] === "--lesson") f.lesson = resolvePath(args[++i]!);
    else if (args[i] === "--input") f.input = resolvePath(args[++i]!);
    else if (args[i] === "--offline") f.offline = true;
    else if (args[i] === "--silent") f.silent = true;
    else if (args[i] === "--bundle") f.bundle = true;
    else if (args[i] === "-o" || args[i] === "--out") f.out = args[++i];
    else if (args[i] === "--size") f.size = args[++i];
    else if (args[i] === "--drag") f.drag = args[++i];
    else if (args[i] === "--port") f.port = Number(args[++i]);
    else if (args[i] === "--host") f.host = args[++i];
    else if (args[i] === "--real") f.real = true;
    else if (args[i] === "--create") f.create = true;
    else if (args[i] === "--dry-run") f.dryRun = true;
    else if (args[i] === "--configuration") {
      f.configurationIds = [...(f.configurationIds ?? []), ...commaSeparatedIds(args[++i], "--configuration")];
    }
    else if (args[i] === "--case") {
      f.caseIds = [...(f.caseIds ?? []), ...commaSeparatedIds(args[++i], "--case")];
    }
    else if (args[i] === "--repeats") f.repeats = Number(args[++i]);
    else if (args[i] === "--fake") die('the --fake option was renamed to --silent');
    else if (args[i] === "--variant") {
      const variant = args[++i];
      if (variant !== "legacy" && variant !== "structured" && variant !== "both") die("--variant must be legacy, structured, or both");
      f.variant = variant;
    }
    else if (args[i]?.startsWith("--")) die(`unknown option "${args[i]}"`);
  }
  return f;
}

function commaSeparatedIds(value: string | undefined, option: string): string[] {
  const ids = value?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  if (!ids.length) die(`${option} needs one or more comma-separated ids`);
  return ids;
}

function narrationMode(flags: Flags): NarrationMode {
  if (flags.silent) return "silent";
  if (flags.offline) return "offline";
  return "provider";
}

function noProviders(flags: Flags): boolean {
  return Boolean(flags.offline || flags.silent);
}

function authoringError(error: unknown): string {
  if (error instanceof ParseError) {
    return formatDiagnostic({ severity: "error", message: error.message, loc: error.loc });
  }
  return error instanceof Error ? error.message : String(error);
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

main().catch((e) => {
  if (e instanceof ParseError) die(formatDiagnostic({ severity: "error", message: e.message, loc: e.loc }));
  if (e instanceof LessonBuildError) die(e.message);
  die(String(e instanceof Error ? (e.stack ?? e.message) : e));
});
