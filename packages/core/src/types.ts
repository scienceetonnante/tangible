// Core data contracts shared by all modules (DESIGN §5). The most stable
// part of the system — change deliberately.

/** Camera orbit state; interpolated by direction + magnitude, never through the target. */
export interface OrbitState {
  target: [number, number, number];
  distance: number;
  azimuth: number;
  elevation: number;
}

export type ParamType =
  | { kind: "scalar"; range?: [number, number] }
  | { kind: "vec2" }
  | { kind: "vec3" }
  | { kind: "quaternion" } // [w, x, y, z], unit
  | { kind: "orbit" }
  | { kind: "boolean" }
  | { kind: "enum"; values: string[] }
  | { kind: "boardItem" }; // BoardItemState

export type BoardItemState = "hidden" | "shown" | "dimmed";

export type ParamValue = number | boolean | string | number[] | OrbitState;

/** Build-time computed process exported by a scene module. */
export interface BakerDefinition {
  reads: string[];
  writes: string[];
  run(
    input: Readonly<Record<string, ParamValue>>,
    options: { steps: number },
  ): Array<Record<string, ParamValue>>;
}

export type Bakers = Record<string, BakerDefinition>;

export type InterpolateMode = "lerp" | "nlerp" | "orbit" | "snap";
export type Ownership = "script" | "shared" | "viewer";

export interface ParamSpec {
  type: ParamType;
  default: ParamValue;
  interpolate: InterpolateMode; // must be legal for the type
  ownership: Ownership;
  label?: string; // for the cue-reference sheet
}

/** Keys are dot-namespaced, e.g. "show.projection". */
export type Schema = Record<string, ParamSpec>;

export interface Keyframe {
  t: number; // seconds
  v: ParamValue; // ABSOLUTE value (never a delta)
  ease?: string; // easing INTO this keyframe; absent = hold/snap
}

/** The single build artifact the player consumes, per language. */
export interface LessonTracks {
  version: 1;
  lessonId: string;
  language: string;
  duration: number; // seconds, = audio duration
  audio: { src: string[]; hash: string };
  schemaHash: string;
  tracks: Record<string, Keyframe[]>; // param name → sorted keyframes
  chapters: { t: number; title: string }[];
  pauses: { t: number; id: string; prompt: string }[];
  captions: { src: string };
  boardItems: Record<string, BoardItem>;
  recorded: Record<string, string>; // trackId → asset path
}

/** A board entry: KaTeX/text source per language, with tag ids for highlight targets. */
export interface BoardItem {
  kind: "katex" | "text";
  source: Record<string, string>; // language → source
}

/** Full evaluated scene state at a time t: param name → value. */
export type PlainState = Record<string, ParamValue>;
