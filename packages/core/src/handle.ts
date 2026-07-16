// Handle — a draggable region. DOM-free (pointer coords are plain numbers) so it
// lives in core, letting both the player's InteractionManager and the ingredients
// library define handles. The player does pointer capture and hit-testing; the
// handle maps pointer position to parameter writes.

import type { ParamValue, PlainState } from "./types.js";

export interface Handle {
  id: string;
  params: string[]; // parameters this handle writes
  hitTest(px: number, py: number, state: Readonly<PlainState>): boolean;
  onDown?(px: number, py: number, state: Readonly<PlainState>): void; // capture drag start
  onDrag(px: number, py: number, state: Readonly<PlainState>): Record<string, ParamValue>;
  onWheel?(px: number, py: number, deltaY: number, state: Readonly<PlainState>): Record<string, ParamValue>;
}
