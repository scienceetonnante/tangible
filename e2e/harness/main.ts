// Browser test harness: instantiate the Player against the built unit-circle
// lesson (tracks/captions/audio inlined by prepare.mjs) and expose it on window
// for Playwright to drive.

import { Player, PLAYER_CSS, mimeForAudio, preferredAudioSource } from "@tangible/player";
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
const query = new URLSearchParams(location.search);
const arrivalMode = query.get("arrival");
const arrival = arrivalMode !== null;
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
        if (arrivalMode === "blob") {
          const response = await fetch(audio);
          if (!response.ok) throw new Error(`narration returned ${response.status}`);
          const buffer = await response.arrayBuffer();
          return [URL.createObjectURL(new Blob([buffer], { type: mimeForAudio(audio) }))];
        }
        return [audio];
      }
    : undefined,
  introduction: arrival
    ? { title: "The unit circle" }
    : undefined,
  assistant: { context: data.assistant, startOpen: query.get("assistant") === "open" },
});
window.__player = player;
player.start();
