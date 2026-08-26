// Browser bundle for `lesson scene`: scene runtime only, with no lesson artifacts.

import { build } from "esbuild";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

const require = createRequire(import.meta.url);

export interface ScenePreviewBundle {
  siteDir: string;
  watchPaths: string[];
}

export async function bundleScenePreview(
  lessonDir: string,
  lessonId: string,
  sceneFile: string,
): Promise<ScenePreviewBundle> {
  const siteDir = join(lessonDir, "build", "scene-preview");
  const scenePath = resolve(lessonDir, sceneFile);
  await mkdir(siteDir, { recursive: true });

  const playerPath = require.resolve("@tangible/player");
  const corePath = require.resolve("@tangible/core");
  const entry = `
import { ScenePreview, PLAYER_CSS } from "@tangible/player";
import { scene } from ${JSON.stringify(scenePath)};
const style = document.createElement("style");
style.textContent = PLAYER_CSS;
document.head.append(style);
const preview = new ScenePreview({ mount: document.getElementById("app"), scene });
window.__scenePreview = preview;
preview.start();
`;

  const result = await build({
    absWorkingDir: lessonDir,
    stdin: { contents: entry, resolveDir: lessonDir, loader: "ts", sourcefile: "scene-preview-entry.ts" },
    outfile: join(siteDir, "scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    alias: { "@tangible/player": playerPath, "@tangible/core": corePath },
    metafile: true,
    logLevel: "silent",
  });

  await writeFile(join(siteDir, "index.html"), scenePreviewHtml(lessonId));
  const watchPaths = Object.keys(result.metafile.inputs)
    .map((input) => resolve(lessonDir, input))
    .filter((input) => within(input, lessonDir) && existsSync(input))
    .sort();
  return { siteDir, watchPaths };
}

function within(path: string, root: string): boolean {
  const local = relative(root, path);
  return local !== "" && !local.startsWith("..") && !isAbsolute(local);
}

function scenePreviewHtml(lessonId: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${lessonId} scene preview</title>
<style>body { margin: 0; font-family: sans-serif; } #app { width: 100%; }</style>
</head>
<body>
<div id="app"></div>
<script src="scene.js"></script>
</body>
</html>
`;
}
