// Browser test harness: instantiate the Player against the built unit-circle
// lesson (tracks/captions/audio inlined by prepare.mjs) and expose it on window
// for Playwright to drive.

import { Player, PLAYER_CSS } from "@xv/player";
import type { LessonTracks } from "@xv/core";
import { scene } from "../../lessons/unit-circle/scene";

declare global {
  interface Window {
    __XV_DATA: { tracks: LessonTracks; vtt: string; audio: string };
    __player: Player;
  }
}

const data = window.__XV_DATA;
const style = document.createElement("style");
style.textContent = PLAYER_CSS;
document.head.append(style);

const mount = document.getElementById("app")!;
const player = new Player({ mount, scene, tracks: data.tracks, captionsVtt: data.vtt, audioSrc: [data.audio] });
window.__player = player;
player.start();
