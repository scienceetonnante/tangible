// Question box and written conversation transcript. Provider orchestration stays
// outside this DOM component so the player can use fake or real endpoints.

import type { AnswerBeat, AssistantHistoryTurn } from "@narrable/core";

export interface AssistantPanelOptions {
  onAsk(question: string): void;
  onCancel(): void;
  onPlayAnswer(): void;
}

export class AssistantPanel {
  readonly el: HTMLElement;
  readonly history: AssistantHistoryTurn[] = [];

  private input: HTMLInputElement;
  private askButton: HTMLButtonElement;
  private cancelButton: HTMLButtonElement;
  private playAnswerButton: HTMLButtonElement;
  private status: HTMLElement;
  private transcript: HTMLElement;
  private pauseEnabled = false;
  private busy = false;

  constructor(opts: AssistantPanelOptions) {
    this.el = div("xv-assistant");
    this.transcript = div("xv-assistant-transcript");
    this.transcript.setAttribute("aria-live", "polite");

    const form = document.createElement("form");
    form.className = "xv-assistant-form";
    this.input = document.createElement("input");
    this.input.className = "xv-assistant-input";
    this.input.type = "text";
    this.input.placeholder = "Pause the lesson to ask a question";
    this.input.setAttribute("aria-label", "Ask a question about this lesson");
    this.input.maxLength = 1000;

    this.askButton = button("Ask", "xv-assistant-ask");
    this.askButton.type = "submit";
    this.cancelButton = button("Cancel", "xv-assistant-cancel");
    this.cancelButton.type = "button";
    this.cancelButton.hidden = true;
    this.cancelButton.onclick = opts.onCancel;
    this.playAnswerButton = button("Play answer", "xv-assistant-play-answer");
    this.playAnswerButton.type = "button";
    this.playAnswerButton.hidden = true;
    this.playAnswerButton.onclick = opts.onPlayAnswer;

    form.onsubmit = (event) => {
      event.preventDefault();
      const question = this.input.value.trim();
      if (!question || this.busy || !this.pauseEnabled) return;
      opts.onAsk(question);
    };
    form.append(this.input, this.askButton, this.cancelButton, this.playAnswerButton);

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
    this.el.append(this.transcript, form, footer);
    this.updateEnabled();
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
    this.playAnswerButton.hidden = true;
    this.updateEnabled();
  }

  showPlayFallback(): void {
    this.busy = true;
    this.status.textContent = "Answer ready";
    this.cancelButton.hidden = false;
    this.playAnswerButton.hidden = false;
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
    this.input.value = "";
  }

  finish(status = ""): void {
    this.busy = false;
    this.status.textContent = status;
    this.cancelButton.hidden = true;
    this.playAnswerButton.hidden = true;
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
