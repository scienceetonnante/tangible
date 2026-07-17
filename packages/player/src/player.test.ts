// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { Player } from "./player.js";
import type { SceneModule } from "./scene-host.js";
import type { AssistantContext, LessonTracks, PlainState } from "@narrable/core";
import { AnswerTimeline } from "./answer-timeline.js";

const tracks: LessonTracks = {
  version: 1,
  lessonId: "t",
  language: "fr",
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
  boardItems: { note: { kind: "text", source: { fr: "x" } } },
  recorded: {},
};

const assistantContext: AssistantContext = {
  version: 1,
  lessonId: "t",
  language: "fr",
  title: "Test",
  guide: "A test scene.",
  script: "Test.",
  narration: "Test.",
  schema: { theta: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" } },
  presets: {},
  constants: {},
  groups: {},
  commandable: ["theta"],
  voice: "elevenlabs:test",
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

  it("enables questions only after playback reaches a manual or scripted pause", () => {
    const mount = document.createElement("div");
    const player = new Player({ mount, scene: stubScene([]), tracks, assistant: { context: assistantContext } });
    const input = mount.querySelector(".xv-assistant-input") as HTMLInputElement;
    expect(input.disabled).toBe(true);

    player.audio.dispatchEvent(new Event("play"));
    expect(input.disabled).toBe(true);
    player.audio.dispatchEvent(new Event("pause"));
    expect(input.disabled).toBe(false);
    player.dispose();
  });

  it("composes answer state over the lesson until the learner claims that parameter", () => {
    const mount = document.createElement("div");
    const seen: PlainState[] = [];
    const player = new Player({ mount, scene: stubScene(seen), tracks, assistant: { context: assistantContext } });
    const active = {
      audio: { currentTime: 1 },
      timeline: new AnswerTimeline(assistantContext.schema, { theta: 0 }, [{ t: 0, set: { theta: 8 }, over: 0 }]),
      state: {},
      claimed: new Set<string>(),
      url: "",
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
});
