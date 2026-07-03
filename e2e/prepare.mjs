// Playwright globalSetup: build the packages + the unit-circle lesson (fake TTS),
// then bundle the harness into a self-contained e2e/dist/ (tracks/captions/audio
// inlined) that the static server serves.

import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
};

export default async function prepare() {
  run("node", ["node_modules/typescript/bin/tsc", "--build"]);
  // --fake keeps e2e hermetic: deterministic timing, no API key, no credits, WAV.
  run("node", ["packages/cli/dist/index.js", "build", "--fake", "--lesson", "lessons/unit-circle", "--lang", "fr"]);

  const buildDir = join(root, "lessons/unit-circle/build/fr");
  const tracks = await readFile(join(buildDir, "tracks.json"), "utf8");
  const vtt = await readFile(join(buildDir, "captions.vtt"), "utf8");

  const distDir = join(root, "e2e/dist");
  await mkdir(distDir, { recursive: true });
  await copyFile(join(buildDir, "audio.wav"), join(distDir, "audio.wav")); // served over HTTP (Safari path)

  await build({
    entryPoints: [join(root, "e2e/harness/main.ts")],
    outfile: join(distDir, "main.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    logLevel: "silent",
    alias: {
      "@xv/player": join(root, "packages/player/dist/index.js"),
      "@xv/core": join(root, "packages/core/dist/index.js"),
    },
  });

  const data = { tracks: JSON.parse(tracks), vtt, audio: "audio.wav" };
  await writeFile(join(distDir, "data.js"), `window.__XV_DATA = ${JSON.stringify(data)};`);
  await writeFile(
    join(distDir, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><title>xv e2e</title></head><body><div id="app" style="width:640px"></div><script src="data.js"></script><script src="main.js"></script></body></html>`,
  );
}
