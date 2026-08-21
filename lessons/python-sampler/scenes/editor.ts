import type { PlainState } from "@narrable/core";
import type { SceneContext } from "@narrable/player";
import { PythonRunner } from "./python-runner.js";

export class PythonEditor {
  readonly el: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private highlight: HTMLElement;
  private lines: HTMLElement;
  private output: HTMLElement;
  private runButton: HTMLButtonElement;
  private status: HTMLElement;
  private currentCode = "";
  private running = false;
  private runner: PythonRunner;

  constructor(private ctx: SceneContext) {
    this.el = div("python-workspace");
    this.el.innerHTML = layout();
    this.textarea = this.el.querySelector(".python-input")!;
    this.highlight = this.el.querySelector(".python-highlight")!;
    this.lines = this.el.querySelector(".python-lines")!;
    this.output = this.el.querySelector(".python-output")!;
    this.runButton = this.el.querySelector(".python-run")!;
    this.status = this.el.querySelector(".python-status")!;
    this.runner = new PythonRunner((message) => this.setStatus(message));

    this.textarea.addEventListener("input", this.onInput);
    this.textarea.addEventListener("scroll", this.syncScroll);
    this.runButton.addEventListener("click", () => void this.run());
    this.el.querySelector(".python-reset")!.addEventListener("click", this.reset);
    ctx.overlay.append(this.el);
  }

  render(state: Readonly<PlainState>): void {
    const code = state.code as string;
    if (code !== this.currentCode) this.setCode(code);
    this.output.textContent = state.output as string;
    const run = state.run as number;
    this.runButton.classList.toggle("scripted-run", Math.abs(run - Math.round(run)) > 0.04);
  }

  dispose(): void {
    this.runner.dispose();
    this.el.remove();
  }

  private setCode(code: string): void {
    this.currentCode = code;
    this.textarea.value = code;
    this.highlight.innerHTML = highlightPython(code) + '<span class="python-caret" aria-hidden="true"></span>';
    this.lines.textContent = Array.from({ length: Math.max(1, code.split("\n").length) }, (_, i) => i + 1).join("\n");
    this.textarea.selectionStart = this.textarea.selectionEnd = code.length;
    this.syncScroll();
  }

  private onInput = () => {
    this.ctx.pause();
    this.currentCode = this.textarea.value;
    this.ctx.write("code", this.currentCode);
    this.highlight.innerHTML = highlightPython(this.currentCode) + '<span class="python-caret" aria-hidden="true"></span>';
    this.lines.textContent = Array.from({ length: Math.max(1, this.currentCode.split("\n").length) }, (_, i) => i + 1).join("\n");
  };

  private syncScroll = () => {
    this.highlight.scrollTop = this.textarea.scrollTop;
    this.highlight.scrollLeft = this.textarea.scrollLeft;
    this.lines.scrollTop = this.textarea.scrollTop;
  };

  private reset = () => {
    this.ctx.pause();
    this.ctx.reset("code");
    this.ctx.reset("output");
    this.setStatus("Restored narration");
  };

  private async run(): Promise<void> {
    if (this.running) return;
    this.ctx.pause();
    this.running = true;
    this.runButton.disabled = true;
    try {
      const output = await this.runner.run(this.currentCode);
      this.ctx.write("output", output || "(no output)\n");
      this.setStatus("Finished");
    } catch (error) {
      this.ctx.write("output", `${(error as Error).message}\n`);
      this.setStatus("Stopped");
    } finally {
      this.running = false;
      this.runButton.disabled = false;
    }
  }

  private setStatus(message: string): void {
    this.status.textContent = message;
  }
}

export function highlightPython(code: string): string {
  const token = /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:import|from|as|def|return|for|in|if|else|try|except|with|print|True|False|None)\b|\b\d+(?:\.\d+)?\b/g;
  let html = "";
  let at = 0;
  for (const match of code.matchAll(token)) {
    const value = match[0];
    html += escapeHtml(code.slice(at, match.index));
    const kind = value.startsWith("#") ? "comment" : value.startsWith('"') || value.startsWith("'") ? "string" : /^\d/.test(value) ? "number" : "keyword";
    html += `<span class="python-${kind}">${escapeHtml(value)}</span>`;
    at = match.index! + value.length;
  }
  return html + escapeHtml(code.slice(at));
}

function layout(): string {
  return `
    <header class="python-titlebar">
      <div><span class="python-mark">›_</span><strong> Tiny token sampler</strong></div>
      <div class="python-status">Browser Python · loads on first run</div>
    </header>
    <main class="python-main">
      <section class="python-panel python-editor-panel">
        <div class="python-panelbar"><span>sampler.py</span><span>Python</span></div>
        <div class="python-code">
          <pre class="python-lines" aria-hidden="true">1</pre>
          <pre class="python-highlight" aria-hidden="true"></pre>
          <textarea class="python-input" aria-label="Python code" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
        </div>
      </section>
      <section class="python-panel python-output-panel">
        <div class="python-panelbar"><span>Output</span><div><button class="python-reset">Reset</button><button class="python-run">▶ Run</button></div></div>
        <pre class="python-output">Run the code to see its output.</pre>
        <p class="python-hint">Try changing <code>temperature</code>, the scores, or the token names.</p>
      </section>
    </main>`;
}

function div(className: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
