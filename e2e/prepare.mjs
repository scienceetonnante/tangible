// Playwright globalSetup: build the packages + the unit-circle lesson (silent audio),
// then bundle the harness into a self-contained e2e/dist/ using the same
// compressed browser audio formats as a narrated release.

import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
};

export default async function prepare() {
  run("node", ["node_modules/typescript/bin/tsc", "--build"]);
  // --silent keeps e2e hermetic: deterministic timing, no model download, no API key, WAV.
  run("node", ["packages/cli/dist/index.js", "build", "--silent", "--lesson", "lessons/unit-circle"]);

  const buildDir = join(root, "lessons/unit-circle/build/lesson");
  const tracks = JSON.parse(await readFile(join(buildDir, "tracks.json"), "utf8"));
  const vtt = await readFile(join(buildDir, "captions.vtt"), "utf8");
  const assistant = JSON.parse(await readFile(join(buildDir, "assistant.json"), "utf8"));
  // Keep the browser acceptance answer short while exercising the real fake-TTS
  // timing and audio path.
  assistant.speed = 5;
  const { answerQuestion } = await import(join(root, "packages/cli/dist/assistant-service.js"));
  const { FakeTtsAdapter } = await import(join(root, "packages/tts/dist/index.js"));
  const answer = await answerQuestion(
    {
      lessonId: assistant.lessonId,
      question: "Why?",
      t: 0,
      state: { theta: 0 },
      position: { chapter: null, narrationJustHeard: null, pausePrompt: null },
      temporaryAssistantState: {},
      history: [],
    },
    assistant,
    { fake: true, tts: new FakeTtsAdapter() },
  );

  const distDir = join(root, "e2e/dist");
  await mkdir(distDir, { recursive: true });
  const { transcodeForBrowsers } = await import(join(root, "packages/cli/dist/transcode.js"));
  const sourceAudio = await readFile(join(buildDir, "audio.wav"));
  const audioArtifacts = transcodeForBrowsers(sourceAudio, "wav");
  tracks.audio.src = audioArtifacts.map((artifact) => `audio.${artifact.format}`);
  await Promise.all(audioArtifacts.map((artifact) => writeFile(join(distDir, `audio.${artifact.format}`), artifact.audio)));

  await build({
    entryPoints: [join(root, "e2e/harness/main.ts")],
    outfile: join(distDir, "main.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    logLevel: "silent",
    alias: {
      "@tangible/player": join(root, "packages/player/dist/index.js"),
      "@tangible/core": join(root, "packages/core/dist/index.js"),
    },
  });

  const data = { tracks, vtt, audio: tracks.audio.src, assistant };
  await writeFile(join(distDir, "data.js"), `window.__XV_DATA = ${JSON.stringify(data)};`);
  await writeFile(join(distDir, "answer.json"), JSON.stringify(answer));
  await writeFile(
    join(distDir, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tangible e2e</title></head><body><div id="app" style="width:640px;max-width:100%"></div><script src="data.js"></script><script src="main.js"></script></body></html>`,
  );
}
