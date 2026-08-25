// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { Player } from "./player.js";
import type { SceneModule, SceneContext } from "./scene-host.js";
import type { AssistantContext, LessonTracks, PlainState } from "@narrable/core";
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
};

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
    expect(mount.querySelector(".xv-gate")).toBeNull();

    player.audio.currentTime = 5;
    player.driver.tick();

    // Scene received scripted state; board param (not in scene schema) is tracked too.
    expect(seen.at(-1)!.theta).toBeCloseTo(50, 6);
    expect(player.store.plain["board.note"]).toBe("shown");
    player.dispose();
  });

  it("hides chrome when chrome:false", () => {
    const mount = document.createElement("div");
    const player = new Player({ mount, scene: stubScene([]), tracks, chrome: false });
    expect(mount.querySelector(".xv-chrome")).toBeNull();
    player.dispose();
  });

  it("shows a Start Lesson overlay when configured autoplay is rejected", async () => {
    const mount = document.createElement("div");
    const player = new Player({ mount, scene: stubScene([]), tracks, autoplay: true });
    player.audio.play = vi.fn().mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError")).mockResolvedValue(undefined);

    player.start();
    await vi.waitFor(() => expect(mount.querySelector(".xv-start-overlay")).toBeTruthy());
    (mount.querySelector(".xv-start-overlay") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(mount.querySelector(".xv-start-overlay")).toBeNull());
    expect(player.audio.play).toHaveBeenCalledTimes(2);
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
    expect(input.disabled).toBe(true);

    player.audio.dispatchEvent(new Event("play"));
    expect(input.disabled).toBe(true);
    player.audio.dispatchEvent(new Event("pause"));
    expect(input.disabled).toBe(false);
    player.dispose();
  });

  it("sends a persistent anonymous client id with assistant requests", async () => {
    localStorage.clear();
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

    expect(requestHeaders!.get("x-narrable-client-id")).toMatch(/^[a-f0-9]{32}$/);
    expect(localStorage.getItem("narrable.assistantClientId")).toBe(requestHeaders!.get("x-narrable-client-id"));
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
    const scene: SceneModule = {
      schema: {
        code: { type: { kind: "text" }, default: "scripted", interpolate: "typewriter", ownership: "shared" },
      },
      create: (sceneContext) => {
        ctx = sceneContext;
        return { render: () => {}, handles: () => [], dispose: () => {} };
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

    ctx!.reset("code");
    player.driver.tick();
    expect(player.store.plain.code).toBe("scripted");
    player.dispose();
  });
});
