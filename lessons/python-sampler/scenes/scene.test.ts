// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { ParamValue } from "@narrable/core";
import type { SceneContext } from "@narrable/player";
import { highlightPython } from "./editor.js";
import { COLD_PROGRAM } from "./programs.js";
import { scene } from "./scene.js";

describe("Python sampler scene", () => {
  it("renders code and routes edits and resets through the scene context", () => {
    const canvas = document.createElement("canvas");
    const root = document.createElement("div");
    const overlay = document.createElement("div");
    root.append(canvas, overlay);
    document.body.append(root);
    const writes: [string, ParamValue][] = [];
    const resets: string[] = [];
    let paused = 0;
    const ctx: SceneContext = {
      canvas,
      overlay,
      viewport: () => ({ width: 960, height: 540 }),
      write: (param, value) => writes.push([param, value]),
      reset: (param) => resets.push(param),
      pause: () => paused++,
    };
    const instance = scene.create(ctx);
    instance.render({ code: COLD_PROGRAM, output: "robot\n", run: 0, scene: "editor" }, 0);

    const input = overlay.querySelector(".python-input") as HTMLTextAreaElement;
    expect(input.value).toBe(COLD_PROGRAM);
    expect(overlay.querySelector(".python-output")!.textContent).toBe("robot\n");
    input.value += "# learner edit\n";
    input.dispatchEvent(new Event("input"));
    expect(writes.at(-1)).toEqual(["code", input.value]);
    expect(paused).toBe(1);

    (overlay.querySelector(".python-reset") as HTMLButtonElement).click();
    expect(resets).toEqual(["code", "output"]);
    instance.dispose();
  });

  it("highlights Python tokens and escapes source text", () => {
    const html = highlightPython('def f():\n    return "<tag>" # note');
    expect(html).toContain('class="python-keyword">def</span>');
    expect(html).toContain("&lt;tag&gt;");
    expect(html).toContain('class="python-comment"># note</span>');
  });
});
