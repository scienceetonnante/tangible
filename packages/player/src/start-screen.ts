export interface LessonIntroduction {
  title: string;
  promise: string;
}

export interface StartScreenActions {
  onStart: () => void;
  onRetry: () => void;
}

/** Framework-owned arrival screen shown until narration is ready and started. */
export class StartScreen {
  readonly el: HTMLElement;
  private button: HTMLButtonElement;
  private status: HTMLElement;
  private spinner: HTMLElement;
  private action: "start" | "retry" = "start";

  constructor(introduction: LessonIntroduction, duration: number, actions: StartScreenActions) {
    this.el = div("xv-start-screen");
    this.el.setAttribute("aria-label", "Lesson introduction");

    const content = div("xv-start-content");
    const kind = div("xv-start-kind");
    kind.textContent = "Narrated interactive lesson";

    const title = document.createElement("h1");
    title.className = "xv-start-title";
    title.textContent = introduction.title;

    const promise = document.createElement("p");
    promise.className = "xv-start-promise";
    promise.textContent = introduction.promise;

    const meta = document.createElement("p");
    meta.className = "xv-start-meta";
    meta.textContent = approximateDuration(duration);

    const interactive = document.createElement("p");
    interactive.className = "xv-start-interactive";
    interactive.textContent = "You can interact with the scene while the explanation is playing.";

    const orientation = document.createElement("p");
    orientation.className = "xv-orientation-notice";
    orientation.textContent = "For the best experience on a phone, rotate to landscape or use a larger screen.";

    const controls = div("xv-start-controls");
    const live = div("xv-start-status");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    this.spinner = div("xv-loading-spinner");
    this.spinner.setAttribute("aria-hidden", "true");
    this.status = document.createElement("span");
    live.append(this.spinner, this.status);

    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "xv-start-button";
    this.button.onclick = () => {
      if (this.action === "retry") actions.onRetry();
      else actions.onStart();
    };

    controls.append(live, this.button);
    content.append(kind, title, promise, meta, interactive, orientation, controls);
    this.el.append(content);
    this.setLoading();
  }

  setLoading(): void {
    this.el.dataset.state = "loading";
    this.action = "start";
    this.status.textContent = "Loading narration…";
    this.spinner.hidden = false;
    this.button.textContent = "Loading…";
    this.button.disabled = true;
  }

  setReady(): void {
    this.el.dataset.state = "ready";
    this.action = "start";
    this.status.textContent = "Ready";
    this.spinner.hidden = true;
    this.button.textContent = "Start lesson";
    this.button.disabled = false;
  }

  setStarting(): void {
    this.status.textContent = "Starting…";
    this.spinner.hidden = false;
    this.button.textContent = "Starting…";
    this.button.disabled = true;
  }

  setFailed(message: string, action: "start" | "retry" = "retry"): void {
    this.el.dataset.state = "failed";
    this.action = action;
    this.status.textContent = message;
    this.spinner.hidden = true;
    this.button.textContent = "Try again";
    this.button.disabled = false;
  }
}

export function approximateDuration(duration: number): string {
  const minutes = Math.max(1, Math.round(duration / 60));
  return `About ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function div(className: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = className;
  return element;
}
