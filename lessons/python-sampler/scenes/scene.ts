import type { ParamValue, Schema } from "@tangible/core";
import type { SceneContext, SceneInstance, SceneModule } from "@tangible/player";
import { PythonEditor } from "./editor.js";
import {
  COLD_OUTPUT,
  COLD_PROGRAM,
  HOT_OUTPUT,
  HOT_PROGRAM,
  IMPORTS,
  SAMPLER_FUNCTION,
  SCORE_SETUP,
  WEIGHT_FUNCTION,
} from "./programs.js";

export const schema: Schema = {
  scene: { type: { kind: "enum", values: ["editor"] }, default: "editor", interpolate: "snap", ownership: "script" },
  code: { type: { kind: "text" }, default: "", interpolate: "typewriter", ownership: "shared", label: "Python editor contents" },
  output: { type: { kind: "text" }, default: "Run the code to see its output.\n", interpolate: "snap", ownership: "shared", label: "Python output" },
  run: { type: { kind: "scalar", range: [0, 3] }, default: 0, interpolate: "lerp", ownership: "script", label: "scripted Run-button pulse" },
};

export const constants: Record<string, ParamValue> = {
  IMPORTS,
  SCORE_SETUP,
  WEIGHT_FUNCTION,
  SAMPLER_FUNCTION,
  COLD_PROGRAM,
  HOT_PROGRAM,
  COLD_OUTPUT,
  HOT_OUTPUT,
};

export const scene: SceneModule = {
  schema,
  constants,
  create(ctx: SceneContext): SceneInstance {
    const editor = new PythonEditor(ctx);
    const removeTheme = applyTheme(ctx);
    return {
      render: (state) => editor.render(state),
      handles: () => [],
      dispose() {
        editor.dispose();
        removeTheme();
      },
    };
  },
};

function applyTheme(ctx: SceneContext): () => void {
  const root = ctx.canvas.parentElement!;
  const style = document.createElement("style");
  style.textContent = PYTHON_CSS;
  root.classList.add("python-lesson");
  document.body.classList.add("python-page");
  root.append(style);
  return () => {
    root.classList.remove("python-lesson");
    document.body.classList.remove("python-page");
    style.remove();
  };
}

const PYTHON_CSS = `
body.python-page { background: #090c12; }
.xv-player.python-lesson { background: #090c12; color: #eef2ff; }
.python-lesson > canvas { display: none; }
.python-lesson .xv-overlay { pointer-events: none; }
.python-workspace { position: absolute; inset: 0 0 44px; padding: 14px; box-sizing: border-box; background: radial-gradient(circle at 80% 0%, #172039, #090c12 48%); pointer-events: auto; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.python-titlebar { height: 38px; display: flex; align-items: center; justify-content: space-between; color: #dbe5ff; font-size: 14px; }
.python-mark { color: #67e8f9; font: 700 18px ui-monospace, SFMono-Regular, Menlo, monospace; }
.python-status { color: #8190aa; font-size: 12px; }
.python-main { height: calc(100% - 42px); display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(250px, 1fr); gap: 12px; }
.python-panel { min-width: 0; overflow: hidden; border: 1px solid #273249; border-radius: 9px; background: rgba(12, 17, 28, 0.96); box-shadow: 0 14px 36px rgba(0,0,0,.25); }
.python-panelbar { height: 38px; display: flex; align-items: center; justify-content: space-between; padding: 0 11px 0 14px; border-bottom: 1px solid #273249; color: #91a0ba; font-size: 12px; box-sizing: border-box; }
.python-code { position: relative; height: calc(100% - 38px); background: #0d111b; overflow: hidden; }
.python-lines, .python-highlight, .python-input { position: absolute; top: 0; bottom: 0; margin: 0; border: 0; box-sizing: border-box; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; tab-size: 4; white-space: pre; overflow: auto; }
.python-lines { left: 0; width: 46px; padding: 13px 10px; color: #46536b; text-align: right; background: #0b0f18; overflow: hidden; user-select: none; }
.python-highlight, .python-input { left: 46px; right: 0; width: calc(100% - 46px); padding: 13px 16px 70px; }
.python-highlight { color: #d8dee9; pointer-events: none; }
.python-input { z-index: 1; resize: none; outline: none; color: transparent; caret-color: #fff; background: transparent; -webkit-text-fill-color: transparent; }
.python-input::selection { background: rgba(80, 125, 210, .45); }
.python-keyword { color: #c792ea; }
.python-string { color: #c3e88d; }
.python-number { color: #f78c6c; }
.python-comment { color: #60728e; font-style: italic; }
.python-caret { display: inline-block; width: 2px; height: 1.1em; margin-left: 1px; background: #8be9fd; vertical-align: -.2em; animation: python-blink 900ms steps(1) infinite; }
@keyframes python-blink { 50% { opacity: 0; } }
.python-output-panel { display: flex; flex-direction: column; }
.python-panelbar button { margin-left: 7px; border: 1px solid #35435e; border-radius: 5px; padding: 5px 9px; color: #b9c4d8; background: #141c2b; font: 600 12px inherit; cursor: pointer; }
.python-panelbar .python-run { border-color: #2a8d78; color: #d6fff5; background: #11604f; }
.python-panelbar button:hover { filter: brightness(1.18); }
.python-panelbar button:disabled { opacity: .55; cursor: default; }
.python-run.scripted-run { animation: python-run-pulse .42s ease-in-out infinite alternate; }
@keyframes python-run-pulse { to { box-shadow: 0 0 0 5px rgba(54, 211, 159, .2); transform: translateY(-1px); } }
.python-output { flex: 1; min-height: 0; margin: 0; padding: 17px; overflow: auto; white-space: pre-wrap; color: #d8f8ec; font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.python-hint { margin: 0; padding: 11px 14px; border-top: 1px solid #273249; color: #7787a2; font-size: 12px; line-height: 1.45; }
.python-hint code { color: #67e8f9; }
.python-lesson .xv-board { display: none; }
.python-lesson .xv-captions { bottom: 50px; padding: 0 20px; color: #fff; text-shadow: 0 2px 4px #000; pointer-events: none; }
.python-lesson .xv-chrome { background: rgba(9, 12, 18, .96); border-top: 1px solid #273249; }
.python-lesson .xv-chrome button { color: #e5eaf5; }
.python-lesson .xv-chrome button:hover { background: rgba(255,255,255,.08); }
.python-lesson .xv-scrubber { accent-color: #56d9bb; }
.python-lesson .xv-elapsed { color: #91a0ba; }
.xv-shell:has(.python-lesson) .xv-assistant { border-color: #273249; background: #0d111b; color: #dce5f5; }
.xv-shell:has(.python-lesson) .xv-assistant-input { border-color: #35435e; background: #141c2b; color: #eef2ff; }
.xv-shell:has(.python-lesson) .xv-assistant button { border-color: #35435e; background: #141c2b; color: #dce5f5; }
.xv-shell:has(.python-lesson) .xv-assistant-footer { color: #8190aa; }
`;
