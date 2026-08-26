// Static bundle (`lesson build --bundle`): build/site/ with a hashed-free player.js
// (esbuild IIFE), tracks/audio/captions, KaTeX CSS, and an index.html
// with a <noscript> fallback. No server-side anything.

import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Manifest } from "./manifest.js";
import type { LessonTracks } from "@tangible/core";

const require = createRequire(import.meta.url);

export async function bundleSite(lessonDir: string, manifest: Manifest, scenePath: string): Promise<string> {
  const outDir = join(lessonDir, "build", "site");
  await mkdir(outDir, { recursive: true });

  const playerPath = require.resolve("@tangible/player");
  const corePath = require.resolve("@tangible/core");
  const katexCss = createRequire(playerPath).resolve("katex/dist/katex.min.css");

  const entry = `
import { Player, PLAYER_CSS, mimeForAudio, preferredAudioSource } from "@tangible/player";
import { scene } from ${JSON.stringify(scenePath)};
const HAS_ASSISTANT = ${JSON.stringify(Boolean(manifest.assistant))};
const INTRODUCTION = ${JSON.stringify({ title: manifest.title, promise: manifest.promise })};
async function required(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + " returned " + response.status);
  return response;
}
async function main() {
  const [tracks, vtt, assistantContext] = await Promise.all([
    required("./tracks.json").then((response) => response.json()),
    required("./captions.vtt").then((response) => response.text()),
    HAS_ASSISTANT ? required("./assistant.json").then((response) => response.json()) : undefined,
  ]);
  const assistant = HAS_ASSISTANT ? { context: assistantContext } : undefined;
  const style = document.createElement("style"); style.textContent = PLAYER_CSS; document.head.append(style);
  const mount = document.getElementById("app");
  mount.replaceChildren();
  const player = new Player({
    mount,
    scene,
    tracks,
    captionsVtt: vtt,
    introduction: INTRODUCTION,
    audioLoader: async () => {
      // Static Hugging Face Spaces may redirect large media through a signed CDN
      // URL that Safari cannot range-load. Fetch one supported encoding ourselves
      // and use a blob URL, which has no redirect or range negotiation.
      const src = preferredAudioSource(tracks.audio.src);
      const buffer = await (await required("./" + src)).arrayBuffer();
      return [URL.createObjectURL(new Blob([buffer], { type: mimeForAudio(src) }))];
    },
    baseUrl: "",
    assistant,
  });
  window.__player = player;
  player.start();
}
main().catch((error) => {
  console.error("lesson loading failed:", error);
  const status = document.querySelector(".xv-bootstrap-status");
  if (status) status.textContent = "This lesson could not load. Check your connection and reload the page.";
});
`;

  await build({
    stdin: { contents: entry, resolveDir: lessonDir, loader: "ts", sourcefile: "entry.ts" },
    outfile: join(outDir, "player.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    alias: { "@tangible/player": playerPath, "@tangible/core": corePath },
    logLevel: "silent",
  });

  const src = join(lessonDir, "build", "lesson");
  const tracks = JSON.parse(await readFile(join(src, "tracks.json"), "utf8")) as LessonTracks;
  for (const f of ["tracks.json", "captions.vtt", ...tracks.audio.src]) await copyFile(join(src, f), join(outDir, f));
  if (existsSync(join(src, "assistant.json"))) await copyFile(join(src, "assistant.json"), join(outDir, "assistant.json"));
  await copyFile(katexCss, join(outDir, "katex.css"));
  await writeFile(join(outDir, "index.html"), indexHtml(manifest));
  if (manifest.assistant) await bundleAssistantServer(outDir);
  return outDir;
}

async function bundleAssistantServer(outDir: string): Promise<void> {
  const serverPath = join(dirname(fileURLToPath(import.meta.url)), "assistant-server.js");
  await build({
    stdin: {
      contents: `import { serveLesson } from ${JSON.stringify(serverPath)}; serveLesson({ siteDir: process.cwd(), port: Number(process.env.PORT ?? 7860), host: "0.0.0.0" });`,
      resolveDir: outDir,
      sourcefile: "server-entry.mjs",
    },
    outfile: join(outDir, "server.mjs"),
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "silent",
  });
  await writeFile(
    join(outDir, "Dockerfile"),
    "FROM node:22-slim\nWORKDIR /app\nCOPY . .\nENV PORT=7860\nEXPOSE 7860\nCMD [\"node\", \"server.mjs\"]\n",
  );
}

function indexHtml(manifest: Manifest): string {
  const title = escapeHtml(manifest.title);
  const promise = escapeHtml(manifest.promise);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="katex.css">
<style>
body { margin: 0; font-family: system-ui, sans-serif; background: #172033; }
#app { width: 100%; }
.xv-bootstrap { display: grid; place-items: center; width: min(100%, 177.7778dvh); aspect-ratio: 16 / 9; margin-inline: auto; padding: clamp(20px, 5vw, 64px); box-sizing: border-box; background: linear-gradient(135deg, #172033 0%, #263b52 100%); color: #fff; }
.xv-bootstrap-content { width: min(680px, 100%); }
.xv-bootstrap h1 { margin: 0; font-size: clamp(30px, 5vw, 58px); line-height: 1.05; }
.xv-bootstrap-promise { max-width: 40ch; margin: 20px 0; font-size: clamp(18px, 2.4vw, 26px); line-height: 1.35; }
.xv-bootstrap-status { color: #cbd8e4; font-size: 14px; }
</style>
</head>
<body>
<div id="app"><div class="xv-bootstrap"><main class="xv-bootstrap-content"><h1>${title}</h1><p class="xv-bootstrap-promise">${promise}</p><p class="xv-bootstrap-status" role="status">Loading lesson…</p></main></div></div>
<noscript>This lesson requires JavaScript. A video fallback can be linked here.</noscript>
<script src="player.js"></script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
