// Browser test harness: instantiate the Player against the built unit-circle
// lesson (tracks/captions/audio inlined by prepare.mjs) and expose it on window
// for Playwright to drive.

import { Player, PLAYER_CSS } from "@narrable/player";
import type { AssistantContext, LessonTracks } from "@narrable/core";
import { scene } from "../../lessons/unit-circle/scenes/scene";

declare global {
  interface Window {
    __XV_DATA: { tracks: LessonTracks; vtt: string; audio: string; assistant: AssistantContext };
    __player: Player;
  }
}

const data = window.__XV_DATA;
const style = document.createElement("style");
style.textContent = PLAYER_CSS;
document.head.append(style);

const mount = document.getElementById("app")!;
const player = new Player({ mount, scene, tracks: data.tracks, captionsVtt: data.vtt, audioSrc: [data.audio], assistant: { context: data.assistant } });
window.__player = player;
player.start();
