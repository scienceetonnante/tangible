// `lesson new <id>` — scaffold the technical lesson files.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

export interface ScaffoldOptions {
  dir?: string; // target directory (default: <cwd>/<id>)
}

export async function scaffold(id: string, opts: ScaffoldOptions = {}): Promise<void> {
  const dir = opts.dir ?? join(process.cwd(), id);
  if (existsSync(dir)) throw new Error(`lesson new refuses to overwrite existing path "${dir}"`);
  await mkdir(join(dir, "assets"), { recursive: true });
  await mkdir(join(dir, "scenes"), { recursive: true });

  await writeFile(join(dir, "lesson.yaml"), MANIFEST(id));
  await writeFile(join(dir, "scenes", "scene.ts"), SCENE);
  await writeFile(join(dir, "script.md"), SCRIPT);
  const local = relative(process.cwd(), dir);
  const shown = local && !local.startsWith("..") ? local : dir;
  const lessonArg = /\s/.test(shown) ? JSON.stringify(shown) : shown;
  console.error(`Created ${shown}

Start with the interactive scene:
  pnpm lesson scene --lesson ${lessonArg}

Then validate and preview the complete lesson:
  pnpm lesson check --lesson ${lessonArg}
  pnpm lesson preview --offline --lesson ${lessonArg}`);
}

const MANIFEST = (id: string) => `id: ${JSON.stringify(id)}
title: ${JSON.stringify(titleFor(id))}
promise: Move the slider to see how one value changes a visible result.
scene: ./scenes/scene.ts
defaults:
  anticipation: -0.2
  ease: inOutCubic
  transition: 1.0
`;

const SCENE = `import type { PlainState, Schema } from "@tangible/core";
import type { SceneContext, SceneFrame, SceneInstance, SceneModule } from "@tangible/player";

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["main"] }, default: "main", interpolate: "snap", ownership: "script" },
  // Replace "amount" with the main relationship that learners should explore.
  amount: {
    type: { kind: "scalar", range: [0, 100] },
    default: 30,
    interpolate: "lerp",
    ownership: "script",
    label: "adjustable amount",
  },
};

export const scene: SceneModule = {
  schema,
  create(ctx: SceneContext): SceneInstance {
    const root = document.createElement("section");
    root.className = "starter-scene";
    root.innerHTML = \`
      <div class="starter-copy">
        <p class="starter-kicker">A working Tangible scene</p>
        <h1>One value, one visible result</h1>
        <p id="starter-explanation">Move the slider. The bar and number share the same lesson parameter.</p>
        <label for="starter-amount">Amount</label>
        <input id="starter-amount" type="range" min="0" max="100" step="1" aria-describedby="starter-explanation">
        <div class="starter-readout"><span>Current amount</span><output for="starter-amount">30</output></div>
        <div class="starter-track" aria-hidden="true"><div class="starter-fill"></div></div>
      </div>
    \`;
    const style = document.createElement("style");
    style.textContent = STARTER_CSS;
    const input = root.querySelector("input") as HTMLInputElement;
    const output = root.querySelector("output") as HTMLOutputElement;
    const onInput = () => ctx.write("amount", Number(input.value));
    input.addEventListener("input", onInput);
    ctx.overlay.append(style, root);

    return {
      render(state: Readonly<PlainState>, frame: SceneFrame) {
        const amount = state.amount as number;
        input.value = String(amount);
        output.value = String(Math.round(amount));
        root.style.setProperty("--amount", String(amount / 100));
        root.classList.toggle("starter-active", Boolean(frame.activity.amount));
      },
      handles: () => [],
      dispose() {
        input.removeEventListener("input", onInput);
        root.remove();
        style.remove();
      },
    };
  },
};

const STARTER_CSS = \`
.starter-scene {
  --amount: .3;
  position: absolute;
  inset: 0 28% 52px 0;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: clamp(18px, 4vw, 48px);
  background: radial-gradient(circle at 20% 15%, #dff4ff, #f7fbff 55%, #edf3f8);
  color: #172033;
  font-family: system-ui, sans-serif;
  pointer-events: auto;
}
.starter-copy { width: min(560px, 100%); }
.starter-kicker { margin: 0 0 8px; color: #176b87; font-size: 13px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.starter-scene h1 { margin: 0; font-size: clamp(24px, 4vw, 42px); line-height: 1.05; }
.starter-scene p { max-width: 52ch; line-height: 1.45; }
.starter-scene label { display: block; margin-top: clamp(18px, 4vh, 36px); font-weight: 700; }
.starter-scene input { width: 100%; min-height: 44px; margin: 4px 0; accent-color: #137f9f; cursor: pointer; }
.starter-scene input:focus-visible { outline: 3px solid #1677b8; outline-offset: 3px; }
.starter-readout { display: flex; justify-content: space-between; gap: 16px; font-size: 14px; }
.starter-readout output { font: 750 18px ui-monospace, monospace; }
.starter-track { height: clamp(24px, 5vh, 40px); margin-top: 12px; overflow: hidden; border: 1px solid #a8bdc9; border-radius: 999px; background: #fff; }
.starter-fill { width: calc(var(--amount) * 100%); height: 100%; background: linear-gradient(90deg, #1f9ebe, #5dd39e); transition: filter 160ms ease; }
.starter-active .starter-fill { filter: saturate(1.35) brightness(1.05); box-shadow: 0 0 18px rgba(31, 158, 190, .5); }
@media (max-height: 500px) and (orientation: landscape) {
  .starter-scene { padding: 12px 24px; }
  .starter-scene h1 { font-size: 27px; }
  .starter-scene p { margin: 7px 0; font-size: 14px; }
  .starter-scene label { margin-top: 8px; }
  .starter-track { margin-top: 4px; }
}
\`;
`;

const SCRIPT = `@scene(main)
@chapter(Introduction)

This starter lesson connects one adjustable value to a visible result.

At first, the amount is low. Then it @cue(amount -> 80, over: 2s) grows, and the bar responds immediately.
[[Keep the bar change aligned with the word "grows". Replace this intent when you change the teaching idea.]]

@pause(prompt: "Move the slider and notice how the number and bar stay connected.")

Replace this narration with the explanation that your own lesson needs.
`;

function titleFor(id: string): string {
  const words = id.replace(/[-_]+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : "New lesson";
}
