// Load a scene module's data exports (schema/presets/constants/groups/bakers) in Node by
// transpiling scene.ts with esbuild to a temp ESM file and importing it. The
// schema export must not require a DOM.

import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SceneInfo } from "@narrable/compiler";

export async function loadScene(scenePath: string, options: { requireRuntime?: boolean } = {}): Promise<SceneInfo> {
  const dir = await mkdtemp(join(tmpdir(), "xv-scene-"));
  const outfile = join(dir, "scene.mjs");
  try {
    await build({
      entryPoints: [scenePath],
      outfile,
      bundle: true,
      format: "esm",
      platform: "node",
      // Scene runtime dependencies must be bundled because the temporary module
      // lives outside the workspace and cannot resolve its node_modules.
      external: ["@narrable/core", "@narrable/player"],
      logLevel: "silent",
    });
    const mod = (await import(pathToFileURL(outfile).href)) as {
      schema: SceneInfo["schema"];
      presets?: SceneInfo["presets"];
      constants?: SceneInfo["constants"];
      groups?: SceneInfo["groups"];
      bakers?: SceneInfo["bakers"];
      scene?: { create?: unknown };
    };
    if (!mod.schema) throw new Error(`${scenePath} does not export a "schema"`);
    if (options.requireRuntime && (!mod.scene || typeof mod.scene.create !== "function")) {
      throw new Error(`${scenePath} does not export a runtime "scene" with create(ctx)`);
    }
    return { schema: mod.schema, presets: mod.presets, constants: mod.constants, groups: mod.groups, bakers: mod.bakers };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
