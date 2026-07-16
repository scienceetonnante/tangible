// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { Player } from "./player.js";
import type { SceneModule } from "./scene-host.js";
import type { LessonTracks, PlainState } from "@narrable/core";

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
});
