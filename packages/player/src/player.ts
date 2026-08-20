// Player — composes the runtime: DOM layers, store, clock, timeline driver, scene
// host, reconciler, interaction, board, captions, pause gates, and chrome. One
// Player per lesson page (DESIGN §5.4).

import { buildIndex, type AssistantContext, type AssistantRequest, type AssistantResponse, type LessonTracks, type Schema, type PlainState, type TrackIndex } from "@narrable/core";
import { AudioClock } from "./clock.js";
import { StateStore } from "./store.js";
import { TimelineDriver } from "./timeline.js";
import { SceneHost, type SceneModule } from "./scene-host.js";
import { Reconciler } from "./reconciler.js";
import { InteractionManager } from "./interaction.js";
import { Board } from "./board.js";
import { Captions } from "./captions.js";
import { PauseGate } from "./pause-gate.js";
import { Chrome } from "./chrome.js";
import { parseDevParams } from "./url.js";
import { AnswerTimeline, timeAnswerBeats } from "./answer-timeline.js";
import { AssistantPanel } from "./assistant-panel.js";

declare global {
  interface Window {
    __XV_STATE__?: PlainState;
  }
}

export interface PlayerOptions {
  mount: HTMLElement;
  scene: SceneModule;
  tracks: LessonTracks;
  captionsVtt?: string;
  audioSrc?: string[];
  baseUrl?: string;
  chrome?: boolean; // default true
  assistant?: {
    context: AssistantContext;
    endpoint?: string;
    fetchImpl?: typeof fetch;
  };
}

interface ActiveAnswer {
  timeline: AnswerTimeline;
  state: PlainState;
  claimed: Set<string>;
  startedAt: number;
}

export class Player {
  readonly store: StateStore;
  readonly displayStore: StateStore;
  readonly clock: AudioClock;
  readonly driver: TimelineDriver;
  readonly host: SceneHost;
  readonly reconciler: Reconciler;
  readonly interaction: InteractionManager;
  readonly board: Board;
  readonly captions: Captions;
  readonly pauseGate: PauseGate;
  readonly chrome?: Chrome;
  readonly audio: HTMLAudioElement;
  readonly assistant?: AssistantPanel;

  private canvas: HTMLCanvasElement;
  private container: HTMLElement;
  private shell: HTMLElement;
  private index: TrackIndex;
  private lastFrameT = 0;
  private dumpState = false;
  private unbindKeys?: () => void;
  private resizeObserver?: ResizeObserver;
  private activeAnswer?: ActiveAnswer;
  private answerAbort?: AbortController;
  private assistantFetch?: typeof fetch;
  private assistantEndpoint = "/api/answer";
  private assistantClientId?: string;

  constructor(opts: PlayerOptions) {
    const schema: Schema = { ...opts.scene.schema, ...boardSchema(opts.tracks.tracks) };
    this.index = buildIndex(opts.tracks.tracks, schema);
    this.store = new StateStore(schema);
    this.displayStore = new StateStore(schema);

    // DOM layers, bottom to top.
    this.shell = el("div", "xv-shell");
    this.container = el("div", "xv-player");
    this.canvas = el("canvas", "") as HTMLCanvasElement;
    const overlay = el("div", "xv-overlay");
    const boardPanel = el("aside", "xv-board");

    this.audio = document.createElement("audio");
    this.audio.preload = "auto";
    for (const src of opts.audioSrc ?? []) {
      const s = document.createElement("source");
      s.src = (opts.baseUrl ?? "") + src;
      // A blob: URL carries its own MIME (set at creation); a guessed type would
      // override it. Otherwise set the type — Safari won't select a typeless source.
      if (!s.src.startsWith("blob:")) s.type = mimeForAudio(src);
      this.audio.append(s);
    }
    this.clock = new AudioClock(this.audio);

    this.board = new Board(this.displayStore, opts.tracks.boardItems, opts.tracks.language);
    boardPanel.append(this.board.el);
    this.captions = new Captions(opts.captionsVtt ?? "");
    this.pauseGate = new PauseGate(this.clock, opts.tracks.pauses);

    this.container.append(this.canvas, overlay, boardPanel, this.captions.el, this.audio);
    this.shell.append(this.container);
    opts.mount.append(this.shell);
    this.resize();

    this.host = new SceneHost(opts.scene, {
      canvas: this.canvas,
      overlay,
      viewport: () => ({ width: this.canvas.width, height: this.canvas.height }),
      write: (param, value) => this.writeSceneParam(param, value, schema),
      reset: (param) => {
        this.store.resetInteraction(param);
        this.activeAnswer?.claimed.add(param);
      },
      pause: () => this.clock.pause(),
    });
    this.reconciler = new Reconciler(this.store, this.index, schema);
    this.driver = new TimelineDriver(this.clock, this.index, this.store, { onFrame: (t) => this.frame(t) }, this.reconciler);
    this.interaction = new InteractionManager(
      this.canvas,
      this.host,
      this.store,
      this.clock,
      undefined,
      () => this.displayStore.plain,
      (param) => this.activeAnswer?.claimed.add(param),
    );

    const dev = parseDevParams(typeof location !== "undefined" ? location.search : "");
    if (opts.chrome !== false && !dev.nochrome) {
      this.chrome = new Chrome(this.clock, opts.tracks, { onCaptionsToggle: (on) => this.captions.setVisible(on) });
      this.container.append(this.chrome.el);
      this.unbindKeys = this.chrome.bindKeys();
    }
    if (opts.assistant) {
      this.assistantFetch = opts.assistant.fetchImpl ?? ((input, init) => fetch(input, init));
      this.assistantEndpoint = opts.assistant.endpoint ?? "/api/answer";
      this.assistantClientId = persistentClientId();
      this.assistant = new AssistantPanel({
        onAsk: (question) => void this.ask(question, opts.assistant!.context),
        onCancel: () => this.cancelAnswer("Cancelled"),
      });
      this.shell.append(this.assistant.el);
      let hasPlayed = false;
      this.clock.on("play", () => {
        hasPlayed = true;
        if (this.activeAnswer || this.answerAbort) this.cancelAnswer();
        this.assistant?.setPauseEnabled(false);
      });
      this.clock.on("pause", () => {
        if (hasPlayed) this.assistant?.setPauseEnabled(true);
      });
    }
    if (dev.state) this.dumpState = true;
    if (dev.t !== undefined) {
      this.clock.seek(dev.t);
      this.clock.pause();
    }

    // Keep the canvas backing store matched to its display size (handles fullscreen).
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
        this.driver.tick(); // repaint at the new size even when paused
      });
      this.resizeObserver.observe(this.container);
    }
  }

  start(): void {
    this.driver.tick(); // initial paint
    this.driver.start();
  }

  dispose(): void {
    this.driver.stop();
    this.resizeObserver?.disconnect();
    this.interaction.dispose();
    this.unbindKeys?.();
    this.board.dispose();
    this.host.dispose();
    this.cancelAnswer();
    this.shell.remove();
  }

  private frame(t: number): void {
    const dt = Math.max(0, t - this.lastFrameT);
    this.lastFrameT = t;
    for (const key of this.store.keys()) this.displayStore.set(key, this.store.plain[key]!);
    if (this.activeAnswer) {
      const elapsed = (performance.now() - this.activeAnswer.startedAt) / 1000;
      const answer = this.activeAnswer.timeline.evaluate(elapsed, this.activeAnswer.state);
      for (const [param, value] of Object.entries(answer)) {
        if (!this.activeAnswer.claimed.has(param)) this.displayStore.set(param, value);
      }
    }
    this.host.render(this.displayStore.plain, dt);
    this.captions.update(t);
    this.pauseGate.update(t);
    this.chrome?.update(t);
    if (this.dumpState) window.__XV_STATE__ = { ...this.store.plain };
  }

  private writeSceneParam(param: string, value: PlainState[string], schema: Schema): void {
    if (!(param in schema)) throw new Error(`scene wrote unknown parameter: ${param}`);
    this.store.touch(param, value, performance.now() / 1000, this.clock.t);
    this.activeAnswer?.claimed.add(param);
  }

  private async ask(question: string, context: AssistantContext): Promise<void> {
    this.clearActiveAnswer();
    this.answerAbort = new AbortController();
    this.assistant!.setBusy(true, "Thinking…");
    const body: AssistantRequest = {
      lessonId: context.lessonId,
      language: context.language,
      question,
      t: this.clock.t,
      state: { ...this.displayStore.plain },
      history: this.assistant!.history.slice(-8),
    };
    try {
      const response = await this.assistantFetch!(this.assistantEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-narrable-client-id": this.assistantClientId! },
        body: JSON.stringify(body),
        signal: this.answerAbort.signal,
      });
      if (!response.ok) throw new Error(await response.text());
      const answer = (await response.json()) as AssistantResponse;
      if (!answer.answer || !Array.isArray(answer.beats)) throw new Error("invalid assistant response");
      this.assistant!.addTurn(question, answer.answer, answer.beats);
      this.startAnswer(answer, context);
    } catch (error) {
      if ((error as Error).name !== "AbortError") this.assistant!.fail(`Answer failed: ${(error as Error).message}`);
    } finally {
      this.answerAbort = undefined;
    }
  }

  private startAnswer(answer: AssistantResponse, context: AssistantContext): void {
    const schema: Schema = {};
    for (const param of context.commandable) schema[param] = context.schema[param]!;
    this.activeAnswer = {
      timeline: new AnswerTimeline(schema, this.displayStore.plain, timeAnswerBeats(answer.beats)),
      state: {},
      claimed: new Set(),
      startedAt: performance.now(),
    };
    this.assistant!.finish();
  }

  private clearActiveAnswer(): void {
    this.activeAnswer = undefined;
  }

  private cancelAnswer(status = ""): void {
    this.answerAbort?.abort();
    this.clearActiveAnswer();
    this.assistant?.finish(status);
  }

  private resize(): void {
    // Back the canvas at device resolution so lines and text stay crisp (incl.
    // fullscreen); the scene draws in backing pixels via viewport().
    const dpr = window.devicePixelRatio || 1;
    const r = this.container.getBoundingClientRect();
    const cssW = Math.round(r.width) || 640;
    const cssH = Math.round(r.height) || 360;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
  }
}

/** Derive interpolation specs for board.* tracks (not in the scene schema). */
export function boardSchema(tracks: Record<string, unknown>): Schema {
  const s: Schema = {};
  for (const key of Object.keys(tracks)) {
    if (!key.startsWith("board.")) continue;
    s[key] = key.includes(".highlight")
      ? { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" }
      : { type: { kind: "boardItem" }, default: "hidden", interpolate: "snap", ownership: "script" };
  }
  return s;
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function mimeForAudio(src: string): string {
  if (src.endsWith(".m4a")) return "audio/mp4";
  if (src.endsWith(".mp3")) return "audio/mpeg";
  if (src.endsWith(".webm")) return "audio/webm";
  if (src.endsWith(".ogg")) return "audio/ogg";
  return "audio/wav";
}

const CLIENT_ID_KEY = "narrable.assistantClientId";

function persistentClientId(): string {
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored && /^[a-zA-Z0-9_-]{16,64}$/.test(stored)) return stored;
    const created = randomClientId();
    localStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  } catch {
    return randomClientId();
  }
}

function randomClientId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
