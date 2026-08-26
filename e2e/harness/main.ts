// Browser test harness: instantiate the Player against the built unit-circle
// lesson (tracks/captions/audio inlined by prepare.mjs) and expose it on window
// for Playwright to drive.

import { Player, PLAYER_CSS, preferredAudioSource } from "@tangible/player";
import type { AssistantContext, LessonTracks } from "@tangible/core";
import { scene } from "../../lessons/unit-circle/scenes/scene";

declare global {
  interface Window {
    __XV_DATA: { tracks: LessonTracks; vtt: string; audio: string[]; assistant: AssistantContext };
    __player: Player;
  }
}

const data = window.__XV_DATA;
const style = document.createElement("style");
style.textContent = PLAYER_CSS;
document.head.append(style);

const mount = document.getElementById("app")!;
const arrival = new URLSearchParams(location.search).has("arrival");
const audio = preferredAudioSource(data.audio);
const player = new Player({
  mount,
  scene,
  tracks: data.tracks,
  captionsVtt: data.vtt,
  audioSrc: arrival ? [] : [audio],
  audioLoader: arrival
    ? async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return [audio];
      }
    : undefined,
  introduction: arrival
    ? { title: "The unit circle", promise: "See how an angle on the unit circle determines its sine and cosine." }
    : undefined,
  assistant: { context: data.assistant },
});
window.__player = player;
player.start();
