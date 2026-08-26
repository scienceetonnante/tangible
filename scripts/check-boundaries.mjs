// Enforces the §1 dependency rule by scanning @tangible/* imports in each package's source.
// core→none; compiler/tts/player/ingredients→core; cli→all. player must never import compiler or tts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = {
  core: new Set(),
  compiler: new Set(["core"]),
  tts: new Set(["core"]),
  player: new Set(["core"]),
  ingredients: new Set(["core"]),
  cli: new Set(["core", "compiler", "tts", "player", "ingredients"]),
};

const IMPORT_RE = /(?:from|import)\s+["']@tangible\/([a-z]+)["']/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    // Guard the shipped-runtime graph only; test files are not bundled.
    else if (/\.(ts|tsx|mts)$/.test(entry) && !/\.(test|spec)\.[a-z]+$/.test(entry)) out.push(p);
  }
  return out;
}

let violations = 0;
for (const pkg of Object.keys(ALLOWED)) {
  const srcDir = join("packages", pkg, "src");
  for (const file of walk(srcDir)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(IMPORT_RE)) {
      const dep = m[1];
      if (dep === pkg) continue;
      if (!ALLOWED[pkg].has(dep)) {
        console.error(`✗ ${file}: @tangible/${pkg} may not import @tangible/${dep}`);
        violations++;
      }
    }
  }
}

if (violations) {
  console.error(`\n${violations} dependency-boundary violation(s).`);
  process.exit(1);
}
console.log("✓ dependency boundaries OK");
