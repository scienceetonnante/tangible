// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { DEFAULT_ASSISTANT_LIMITS, type AssistantContext, type LessonTracks, type PlainState } from "@tangible/core";
import { Player } from "./player.js";
import type { SceneModule, SceneContext, SceneFrame } from "./scene-host.js";
import { AnswerTimeline } from "./answer-timeline.js";

const tracks: LessonTracks = {
  version: 1,
  lessonId: "t",
  duration: 20,
  audio: { src: [], hash: "" },
  schemaHash: "",
  tracks: {
    theta: [{ t: 0, v: 0 }, { t: 10, v: 100, ease: "linear" }],
    "board.note": [{ t: 0, v: "hidden" }, { t: 4, v: "shown" }],
  },
  chapters: [{ t: 0, title: "Intro" }],
  pauses: [],
  captions: { src: "captions.vtt" },
  boardItems: { note: { kind: "text", source: "x" } },
  recorded: {},
};

const assistantContext: AssistantContext = {
  version: 1,
  lessonId: "t",
  title: "Test",
  provider: "huggingface",
  model: "test/model:provider",
  guide: "A test scene.",
  script: "Test.",
  narration: "Test.",
  schema: { theta: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" } },
  presets: {},
  constants: {},
  groups: {},
  commandable: ["theta"],
  limits: DEFAULT_ASSISTANT_LIMITS,
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubScene(seen: PlainState[]): SceneModule {
  return {
    schema: {
      theta: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
    },
    create: () => ({
      render: (state) => seen.push({ ...state }),
      handles: () => [],
      dispose: () => {},
    }),
  };
}

describe("Player composition", () => {
  it("builds the DOM layers, drives the scene, and updates chrome", () => {
    const mount = document.createElement("div");
    document.body.append(mount);
    const seen: PlainState[] = [];
    const player = new Player({ mount, scene: stubScene(seen), tracks });

    expect(mount.querySelector(".xv-player")).toBeTruthy();
    expect(mount.querySelector(".xv-shell")!.classList.contains("xv-with-assistant")).toBe(false);
    expect(mount.querySelector("canvas")).toBeTruthy();
    expect(mount.querySelector(".xv-chrome")).toBeTruthy();
    expect(mount.querySelector(".xv-portrait-message")?.textContent).toContain("Rotate your phone to landscape");
    expect(mount.querySelector(".xv-gate")).toBeNull();

    player.audio.currentTime = 5;
    player.driver.tick();

    // Scene received scripted state; board param (not in scene schema) is tracked too.
    expect(seen.at(-1)!.theta).toBeCloseTo(50, 6);
    expect(player.store.plain["board.note"]).toBe("shown");
    player.dispose();
  });

  it("reports narration activity to the scene from the current lesson time", () => {
    const mount = document.createElement("div");
    const frames: SceneFrame[] = [];
    const scene = stubScene([]);
    scene.create = () => ({
      render: (_state, frame) => frames.push(frame),
      handles: () => [],
      dispose: () => {},
    });
    const player = new Player({ mount, scene, tracks });

    player.audio.currentTime = 5;
    player.driver.tick();

    expect(frames.at(-1)!.activity.theta).toEqual({ source: "narration", strength: 1 });
    player.dispose();
  });

  it("hides chrome when chrome:false", () => {
    const mount = document.createElement("div");
    const player = new Player({ mount, scene: stubScene([]), tracks, chrome: false });
    expect(mount.querySelector(".xv-chrome")).toBeNull();
    player.dispose();
  });

  it("shows loading and ready states before a deliberate start", async () => {
    const mount = document.createElement("div");
    let finishLoading!: (sources: string[]) => void;
    const audioLoader = vi.fn(() => new Promise<string[]>((resolve) => (finishLoading = resolve)));
    const player = new Player({
      mount,
      scene: stubScene([]),
      tracks,
      introduction: { title: "A useful lesson", promise: "See how the example works." },
      audioLoader,
    });
    player.audio.load = vi.fn();
    player.audio.play = vi.fn().mockResolvedValue(undefined);

    player.start();
    expect(mount.querySelector(".xv-start-screen")?.getAttribute("data-state")).toBe("loading");
    expect(mount.querySelector(".xv-start-title")?.textContent).toBe("A useful lesson");
    expect(mount.querySelector(".xv-start-promise")?.textContent).toBe("See how the example works.");
    expect((mount.querySelector(".xv-start-button") as HTMLButtonElement).disabled).toBe(true);
    expect(player.audio.play).not.toHaveBeenCalled();

    finishLoading(["audio.wav"]);
    await vi.waitFor(() => expect(player.audio.load).toHaveBeenCalledOnce());
    expect(mount.querySelector(".xv-start-screen")?.getAttribute("data-state")).toBe("loading");
    player.audio.dispatchEvent(new Event("canplay"));
    await vi.waitFor(() => expect(mount.querySelector(".xv-start-screen")?.getAttribute("data-state")).toBe("ready"));
    expect(mount.querySelector(".xv-start-status")?.textContent).toBe("Ready");
    (mount.querySelector(".xv-start-button") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(mount.querySelector(".xv-start-screen")).toBeNull());
    expect(player.audio.play).toHaveBeenCalledOnce();
    player.dispose();
  });

  it("shows a useful audio error and retries loading", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const mount = document.createElement("div");
    const audioLoader = vi.fn().mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce(["audio.wav"]);
    const player = new Player({
      mount,
      scene: stubScene([]),
      tracks,
      introduction: { title: "A useful lesson", promise: "See how the example works." },
      audioLoader,
    });
    player.audio.load = vi.fn();

    player.start();
    await vi.waitFor(() => expect(mount.querySelector(".xv-start-screen")?.getAttribute("data-state")).toBe("failed"));
    expect(mount.querySelector(".xv-start-status")?.textContent).toContain("Check your connection");
    (mount.querySelector(".xv-start-button") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(player.audio.load).toHaveBeenCalledOnce());
    player.audio.dispatchEvent(new Event("canplay"));
    await vi.waitFor(() => expect(mount.querySelector(".xv-start-screen")?.getAttribute("data-state")).toBe("ready"));
    expect(audioLoader).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledOnce();
    player.dispose();
  });

  it("turns a stalled play request into a retryable failure", async () => {
    vi.useFakeTimers();
    const mount = document.createElement("div");
    const player = new Player({
      mount,
      scene: stubScene([]),
      tracks,
      introduction: { title: "A useful lesson", promise: "See how the example works." },
    });
    player.audio.play = vi.fn(() => new Promise<void>(() => {}));
    player.audio.pause = vi.fn();

    player.start();
    (mount.querySelector(".xv-start-button") as HTMLButtonElement).click();
    expect(mount.querySelector(".xv-start-screen")?.getAttribute("data-state")).toBe("starting");

    await vi.advanceTimersByTimeAsync(5_000);
    expect(mount.querySelector(".xv-start-screen")?.getAttribute("data-state")).toBe("failed");
    expect(mount.querySelector(".xv-start-status")?.textContent).toContain("could not start");
    expect(player.audio.pause).toHaveBeenCalledOnce();
    player.dispose();
  });

  it("starts with captions off and enables them from the CC button", () => {
    const mount = document.createElement("div");
    const player = new Player({
      mount,
      scene: stubScene([]),
      tracks,
      captionsVtt: "WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nVisible caption.\n",
    });
    const captions = mount.querySelector(".xv-captions")!;

    player.audio.currentTime = 5;
    player.driver.tick();
    expect(captions.textContent).toBe("");

    (mount.querySelector(".xv-captions-toggle") as HTMLButtonElement).click();
    player.driver.tick();
    expect(captions.textContent).toBe("Visible caption.");
    player.dispose();
  });

  it("does not reveal the next caption while an authored pause is active", () => {
    const mount = document.createElement("div");
    const pauseTracks: LessonTracks = {
      ...tracks,
      pauses: [{ t: 1, id: "pause-0", prompt: "Try it." }],
    };
    const player = new Player({
      mount,
      scene: stubScene([]),
      tracks: pauseTracks,
      captionsVtt: `WEBVTT

00:00:00.000 --> 00:00:01.000
Before the pause.

00:00:01.000 --> 00:00:02.000
After the pause.
`,
    });
    player.audio.pause = vi.fn();
    (mount.querySelector(".xv-captions-toggle") as HTMLButtonElement).click();

    player.audio.currentTime = 0.99;
    player.driver.tick();
    expect(mount.querySelector(".xv-captions")!.textContent).toBe("Before the pause.");

    player.audio.currentTime = 1.01;
    player.driver.tick();
    expect(player.pauseGate.activePrompt).toBe("Try it.");
    expect(mount.querySelector(".xv-captions")!.textContent).toBe("Before the pause.");

    player.audio.dispatchEvent(new Event("play"));
    player.driver.tick();
    expect(mount.querySelector(".xv-captions")!.textContent).toBe("After the pause.");
    player.dispose();
  });

  it("enables questions only after playback reaches a manual or scripted pause", () => {
    const mount = document.createElement("div");
    const player = new Player({ mount, scene: stubScene([]), tracks, assistant: { context: assistantContext } });
    const input = mount.querySelector(".xv-assistant-input") as HTMLInputElement;
    expect(mount.querySelector(".xv-shell")!.classList.contains("xv-with-assistant")).toBe(true);
    expect(mount.querySelector(".xv-assistant-toggle")?.getAttribute("aria-expanded")).toBe("false");
    expect((mount.querySelector(".xv-assistant-body") as HTMLElement).hidden).toBe(true);
    expect(input.disabled).toBe(true);

    player.audio.dispatchEvent(new Event("play"));
    expect(input.disabled).toBe(true);
    player.audio.dispatchEvent(new Event("pause"));
    expect(input.disabled).toBe(false);
    player.dispose();
  });

  it("can present the assistant open from the first frame", () => {
    const mount = document.createElement("div");
    const player = new Player({
      mount,
      scene: stubScene([]),
      tracks,
      assistant: { context: assistantContext, startOpen: true },
    });

    expect(mount.querySelector(".xv-shell")!.classList.contains("xv-assistant-expanded")).toBe(true);
    expect(mount.querySelector(".xv-assistant-toggle")?.getAttribute("aria-expanded")).toBe("true");
    expect((mount.querySelector(".xv-assistant-body") as HTMLElement).hidden).toBe(false);
    player.dispose();
  });

  it("sends a persistent anonymous client id with assistant requests", async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => stored.clear(),
      getItem: (key: string) => stored.get(key) ?? null,
      key: (index: number) => [...stored.keys()][index] ?? null,
      get length() {
        return stored.size;
      },
      removeItem: (key: string) => stored.delete(key),
      setItem: (key: string, value: string) => {
        stored.set(key, value);
      },
    } satisfies Storage);
    let requestHeaders: Headers | undefined;
    let requestBody: Record<string, unknown> | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ answer: "At zero.", beats: [{ say: "At zero.", set: {}, over: 0 }] }));
    };
    const mount = document.createElement("div");
    document.body.append(mount);
    const player = new Player({
      mount,
      scene: stubScene([]),
      tracks,
      captionsVtt: "WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nVisible caption.\n",
      assistant: { context: assistantContext, fetchImpl },
    });
    player.audio.dispatchEvent(new Event("play"));
    player.audio.dispatchEvent(new Event("pause"));
    const input = mount.querySelector(".xv-assistant-input") as HTMLInputElement;
    input.value = "Why?";
    mount.querySelector(".xv-assistant-form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(requestHeaders).toBeDefined());

    expect(requestHeaders!.get("x-tangible-client-id")).toMatch(/^[a-f0-9]{32}$/);
    expect(localStorage.getItem("tangible.assistantClientId")).toBe(requestHeaders!.get("x-tangible-client-id"));
    expect(requestBody).toMatchObject({
      position: { chapter: "Intro", narrationJustHeard: "Visible caption.", pausePrompt: null },
      temporaryAssistantState: {},
    });
    player.dispose();
    mount.remove();
  });

  it("identifies temporary values left by the preceding answer", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ answer: "It is eight.", beats: [{ say: "It is eight.", set: {}, over: 0 }] }));
    };
    const mount = document.createElement("div");
    const player = new Player({ mount, scene: stubScene([]), tracks, assistant: { context: assistantContext, fetchImpl } });
    player.audio.dispatchEvent(new Event("play"));
    player.audio.dispatchEvent(new Event("pause"));
    const active = {
      timeline: new AnswerTimeline(assistantContext.schema, { theta: 0 }, [{ t: 0, set: { theta: 8 }, over: 0 }]),
      claimed: new Set<string>(),
      startedAt: performance.now() - 1000,
    };
    (player as unknown as { activeAnswer: typeof active }).activeAnswer = active;
    const input = mount.querySelector(".xv-assistant-input") as HTMLInputElement;
    input.value = "What value is this?";
    mount.querySelector(".xv-assistant-form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(requestBody).toBeDefined());

    expect(requestBody).toMatchObject({ state: { theta: 8 }, temporaryAssistantState: { theta: 8 } });
    player.dispose();
  });

  it("composes answer state over the lesson until the learner claims that parameter", () => {
    const mount = document.createElement("div");
    const seen: PlainState[] = [];
    const player = new Player({ mount, scene: stubScene(seen), tracks, assistant: { context: assistantContext } });
    const active = {
      timeline: new AnswerTimeline(assistantContext.schema, { theta: 0 }, [{ t: 0, set: { theta: 8 }, over: 0 }]),
      claimed: new Set<string>(),
      startedAt: performance.now() - 1000,
    };
    (player as unknown as { activeAnswer: typeof active }).activeAnswer = active;

    player.audio.currentTime = 0;
    player.driver.tick();
    expect(seen.at(-1)!.theta).toBe(8);

    active.claimed.add("theta");
    player.driver.tick();
    expect(seen.at(-1)!.theta).toBe(0);
    (player as unknown as { activeAnswer?: typeof active }).activeAnswer = undefined;
    player.dispose();
  });

  it("routes DOM scene writes and resets through normal reconciliation", () => {
    const mount = document.createElement("div");
    let ctx: SceneContext | undefined;
    const frames: SceneFrame[] = [];
    const scene: SceneModule = {
      schema: {
        code: { type: { kind: "text" }, default: "scripted", interpolate: "typewriter", ownership: "shared" },
      },
      create: (sceneContext) => {
        ctx = sceneContext;
        return { render: (_state, frame) => frames.push(frame), handles: () => [], dispose: () => {} };
      },
    };
    const codeTracks: LessonTracks = {
      ...tracks,
      tracks: { code: [{ t: 0, v: "scripted" }, { t: 10, v: "next" }] },
      boardItems: {},
    };
    const player = new Player({ mount, scene, tracks: codeTracks });

    ctx!.write("code", "learner edit");
    player.driver.tick();
    expect(player.store.plain.code).toBe("learner edit");
    expect(frames.at(-1)!.activity.code!.source).toBe("user");
    expect(frames.at(-1)!.activity.code!.strength).toBeGreaterThan(0.99);

    ctx!.reset("code");
    player.driver.tick();
    expect(player.store.plain.code).toBe("scripted");
    player.dispose();
  });
});
