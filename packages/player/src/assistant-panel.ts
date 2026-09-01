// Question box and written conversation transcript. Provider orchestration stays
// outside this DOM component so the player can use fake or real endpoints.

import type { AnswerBeat, AssistantHistoryTurn } from "@tangible/core";

let nextPanelId = 0;

export interface AssistantPanelOptions {
  onAsk(question: string): void;
  onCancel(): void;
  maxQuestionCharacters?: number;
}

export class AssistantPanel {
  readonly el: HTMLElement;
  readonly history: AssistantHistoryTurn[] = [];

  private input: HTMLInputElement;
  private toggle: HTMLButtonElement;
  private body: HTMLElement;
  private askButton: HTMLButtonElement;
  private cancelButton: HTMLButtonElement;
  private status: HTMLElement;
  private transcript: HTMLElement;
  private pauseEnabled = false;
  private busy = false;

  constructor(opts: AssistantPanelOptions) {
    this.el = document.createElement("section");
    this.el.className = "xv-assistant";
    this.el.setAttribute("aria-label", "Lesson assistant");

    this.toggle = button("Ask about this lesson", "xv-assistant-toggle");
    this.toggle.type = "button";
    this.toggle.setAttribute("aria-expanded", "false");
    this.body = div("xv-assistant-body");
    this.body.id = `xv-assistant-body-${++nextPanelId}`;
    this.body.hidden = true;
    this.toggle.setAttribute("aria-controls", this.body.id);
    this.toggle.onclick = () => this.setExpanded(this.body.hidden);

    this.transcript = div("xv-assistant-transcript");
    this.transcript.setAttribute("aria-live", "polite");

    const form = document.createElement("form");
    form.className = "xv-assistant-form";
    this.input = document.createElement("input");
    this.input.className = "xv-assistant-input";
    this.input.type = "text";
    this.input.placeholder = "Pause the lesson to ask a question";
    this.input.setAttribute("aria-label", "Ask a question about this lesson");
    this.input.maxLength = opts.maxQuestionCharacters ?? 1000;

    this.askButton = button("Ask", "xv-assistant-ask");
    this.askButton.type = "submit";
    this.cancelButton = button("Cancel", "xv-assistant-cancel");
    this.cancelButton.type = "button";
    this.cancelButton.hidden = true;
    this.cancelButton.onclick = opts.onCancel;

    form.onsubmit = (event) => {
      event.preventDefault();
      const question = this.input.value.trim();
      if (!question || this.busy || !this.pauseEnabled) return;
      opts.onAsk(question);
    };
    form.append(this.input, this.askButton, this.cancelButton);

    this.status = div("xv-assistant-status");
    this.status.setAttribute("role", "status");
    const clear = button("Clear conversation", "xv-assistant-clear");
    clear.type = "button";
    clear.onclick = () => {
      this.history.length = 0;
      this.transcript.replaceChildren();
    };
    const footer = div("xv-assistant-footer");
    footer.append(this.status, clear);
    this.body.append(form, this.transcript, footer);
    this.el.append(this.toggle, this.body);
    this.updateEnabled();
  }

  setExpanded(expanded: boolean): void {
    this.body.hidden = !expanded;
    this.toggle.setAttribute("aria-expanded", String(expanded));
    if (expanded && typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => this.body.scrollIntoView?.({ block: "nearest" }));
    }
  }

  setPauseEnabled(enabled: boolean): void {
    this.pauseEnabled = enabled;
    this.input.placeholder = enabled ? "Ask a question about this lesson" : "Pause the lesson to ask a question";
    this.updateEnabled();
  }

  setBusy(busy: boolean, status = ""): void {
    this.busy = busy;
    this.status.textContent = status;
    this.cancelButton.hidden = !busy;
    this.updateEnabled();
  }

  addTurn(question: string, answer: string, beats: AnswerBeat[]): void {
    this.history.push({ question, answer, beats });
    const turn = div("xv-assistant-turn");
    const q = document.createElement("p");
    q.className = "xv-assistant-question";
    q.textContent = question;
    const a = document.createElement("p");
    a.className = "xv-assistant-answer";
    a.textContent = answer;
    turn.append(q, a);
    this.transcript.append(turn);
    this.transcript.scrollTop = this.transcript.scrollHeight;
    this.input.value = "";
  }

  finish(status = ""): void {
    this.busy = false;
    this.status.textContent = status;
    this.cancelButton.hidden = true;
    this.updateEnabled();
  }

  fail(message: string): void {
    this.finish(message);
  }

  private updateEnabled(): void {
    const enabled = this.pauseEnabled && !this.busy;
    this.input.disabled = !enabled;
    this.askButton.disabled = !enabled;
  }
}

function div(className: string): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

function button(text: string, className: string): HTMLButtonElement {
  const el = document.createElement("button");
  el.className = className;
  el.textContent = text;
  return el;
}
