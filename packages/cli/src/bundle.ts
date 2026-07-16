// Static bundle (`lesson build --bundle`): build/site/ with a hashed-free player.js
// (esbuild IIFE), per-language tracks/audio/captions, KaTeX CSS, and an index.html
// with a <noscript> fallback. No server-side anything.

import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Manifest } from "./manifest.js";
import type { LessonTracks } from "@narrable/core";

const require = createRequire(import.meta.url);

export async function bundleSite(lessonDir: string, manifest: Manifest, scenePath: string, langs: string[]): Promise<string> {
  const outDir = join(lessonDir, "build", "site");
  await mkdir(outDir, { recursive: true });

  const playerPath = require.resolve("@narrable/player");
  const corePath = require.resolve("@narrable/core");
  const katexCss = createRequire(playerPath).resolve("katex/dist/katex.min.css");

  const entry = `
import { Player, PLAYER_CSS } from "@narrable/player";
import { scene } from ${JSON.stringify(scenePath)};
const DEFAULT_LANG = ${JSON.stringify(langs[0])};
const mimeForAudio = (s) => s.endsWith(".m4a") ? "audio/mp4" : s.endsWith(".mp3") ? "audio/mpeg" : s.endsWith(".webm") ? "audio/webm" : "audio/wav";
async function main() {
  const lang = new URLSearchParams(location.search).get("lang") || DEFAULT_LANG;
  const base = "./" + lang + "/";
  const tracks = await (await fetch(base + "tracks.json")).json();
  const vtt = await (await fetch(base + "captions.vtt")).text();
  const assistantResponse = await fetch(base + "assistant.json");
  const assistant = assistantResponse.ok ? { context: await assistantResponse.json() } : undefined;
  // Fetch audio as an in-memory blob and play from an object URL. Static hosts (e.g.
  // Hugging Face Spaces) serve media stored via Xet/LFS through signed CDN redirects
  // that break Safari's range-based media loader (403 on the redirect); a blob URL
  // has no redirect and no range negotiation, so it plays everywhere.
  const audioSrc = [];
  for (const src of tracks.audio.src) {
    const buf = await (await fetch(base + src)).arrayBuffer();
    audioSrc.push(URL.createObjectURL(new Blob([buf], { type: mimeForAudio(src) })));
  }
  const style = document.createElement("style"); style.textContent = PLAYER_CSS; document.head.append(style);
  const player = new Player({ mount: document.getElementById("app"), scene, tracks, captionsVtt: vtt, audioSrc, baseUrl: "", assistant });
  window.__player = player;
  player.start();
}
main();
`;

  await build({
    stdin: { contents: entry, resolveDir: lessonDir, loader: "ts", sourcefile: "entry.ts" },
    outfile: join(outDir, "player.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    alias: { "@narrable/player": playerPath, "@narrable/core": corePath },
    logLevel: "silent",
  });

  for (const lang of langs) {
    const src = join(lessonDir, "build", lang);
    const dst = join(outDir, lang);
    await mkdir(dst, { recursive: true });
    const tracks = JSON.parse(await readFile(join(src, "tracks.json"), "utf8")) as LessonTracks;
    for (const f of ["tracks.json", "captions.vtt", ...tracks.audio.src]) await copyFile(join(src, f), join(dst, f));
    if (existsSync(join(src, "assistant.json"))) await copyFile(join(src, "assistant.json"), join(dst, "assistant.json"));
  }
  await copyFile(katexCss, join(outDir, "katex.css"));
  await writeFile(join(outDir, "index.html"), indexHtml(manifest, langs));
  return outDir;
}

function indexHtml(manifest: Manifest, langs: string[]): string {
  const title = manifest.title[langs[0]!] ?? manifest.id;
  return `<!doctype html>
<html lang="${langs[0]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="katex.css">
<style>body { margin: 0; font-family: sans-serif; } #app { max-width: 960px; margin: 0 auto; }</style>
</head>
<body>
<div id="app"></div>
<noscript>This lesson requires JavaScript. A video fallback can be linked here.</noscript>
<script src="player.js"></script>
</body>
</html>
`;
}
