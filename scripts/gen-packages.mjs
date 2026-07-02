// One-shot scaffolder for the six workspace package stubs (M-bootstrap CB.1).
// Encodes the §1 dependency rule: core→none; compiler/tts/player/ingredients→core; cli→all.
import { writeFileSync, mkdirSync } from "node:fs";

const PKGS = {
  core: { deps: [], desc: "Shared types, schema, easing, interpolation, time math." },
  compiler: { deps: ["core"], desc: "script.md → tracks.json + captions.vtt (+ TTS orchestration)." },
  tts: { deps: ["core"], desc: "TTS provider adapters (fake, elevenlabs, align)." },
  player: { deps: ["core"], desc: "Browser runtime: clock, store, timeline, reconciler, scene host." },
  ingredients: { deps: ["core"], desc: "Reusable scene components (2D canvas + three.js helpers)." },
  cli: { deps: ["core", "compiler", "tts", "player", "ingredients"], desc: "The `lesson` command." },
};

for (const [name, { deps, desc }] of Object.entries(PKGS)) {
  const dir = `packages/${name}`;
  mkdirSync(`${dir}/src`, { recursive: true });

  const dependencies = Object.fromEntries(deps.map((d) => [`@xv/${d}`, "workspace:*"]));
  const pkg = {
    name: `@xv/${name}`,
    version: "0.0.0",
    description: desc,
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
    ...(deps.length ? { dependencies } : {}),
  };
  writeFileSync(`${dir}/package.json`, JSON.stringify(pkg, null, 2) + "\n");

  const tsconfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: { outDir: "./dist", rootDir: "./src" },
    include: ["src"],
    ...(deps.length ? { references: deps.map((d) => ({ path: `../${d}` })) } : {}),
  };
  writeFileSync(`${dir}/tsconfig.json`, JSON.stringify(tsconfig, null, 2) + "\n");

  writeFileSync(`${dir}/src/index.ts`, `// @xv/${name} — ${desc}\nexport const PACKAGE = "@xv/${name}" as const;\n`);
  console.log(`scaffolded @xv/${name}`);
}
