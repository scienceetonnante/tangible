// Core data contracts shared by all modules. The most stable
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
  | { kind: "text" }
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

export type InterpolateMode = "lerp" | "nlerp" | "orbit" | "typewriter" | "snap";
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

/** The single build artifact the player consumes. */
export interface LessonTracks {
  version: 1;
  lessonId: string;
  duration: number; // seconds, = audio duration
  audio: { src: string[]; hash: string };
  schemaHash: string;
  tracks: Record<string, Keyframe[]>; // param name → sorted keyframes
  chapters: { t: number; title: string }[];
  pauses: { t: number; id: string; prompt: string; tail?: number }[];
  captions: { src: string };
  boardItems: Record<string, BoardItem>;
  recorded: Record<string, string>; // trackId → asset path
}

/** A board entry with tag ids for highlight targets. */
export interface BoardItem {
  kind: "katex" | "text";
  source: string;
}

/** Full evaluated scene state at a time t: param name → value. */
export type PlainState = Record<string, ParamValue>;

/** Server-enforced limits for a lesson assistant. */
export interface AssistantLimits {
  request: {
    bodyBytes: number;
    questionCharacters: number;
    historyTurns: number;
    positionCharacters: number;
  };
  response: {
    outputTokens: number;
    beats: number;
    beatCharacters: number;
    answerCharacters: number;
    transitionSeconds: number;
  };
  rate: {
    browserRequestsPerTenMinutes: number;
    ipRequestsPerTenMinutes: number;
    globalRequestsPerHour: number;
    globalRequestsPerDay: number;
    concurrentProviderCalls: number;
  };
  queue: {
    maxPendingRequests: number;
    waitTimeoutSeconds: number;
  };
  providerTimeoutSeconds: number;
}

export const DEFAULT_ASSISTANT_LIMITS: AssistantLimits = {
  request: {
    bodyBytes: 64 * 1024,
    questionCharacters: 1000,
    historyTurns: 8,
    positionCharacters: 2000,
  },
  response: {
    outputTokens: 1200,
    beats: 6,
    beatCharacters: 600,
    answerCharacters: 2000,
    transitionSeconds: 2,
  },
  rate: {
    browserRequestsPerTenMinutes: 8,
    ipRequestsPerTenMinutes: 40,
    globalRequestsPerHour: 120,
    globalRequestsPerDay: 500,
    concurrentProviderCalls: 2,
  },
  queue: {
    maxPendingRequests: 0,
    waitTimeoutSeconds: 20,
  },
  providerTimeoutSeconds: 30,
};

/** Build-time context supplied to the lesson question-answering model. */
export interface AssistantContext {
  version: 1;
  lessonId: string;
  title: string;
  provider: "huggingface";
  model: string;
  guide: string;
  script: string;
  narration: string;
  schema: Schema;
  presets: Record<string, Record<string, ParamValue>>;
  constants: Record<string, ParamValue>;
  groups: Record<string, string[]>;
  commandable: string[];
  limits: AssistantLimits;
}

/** One model-authored answer beat and its declarative scene writes. */
export interface AnswerBeat {
  say: string;
  set: PlainState;
  over: number;
}

export interface AssistantHistoryTurn {
  question: string;
  answer: string;
  beats: AnswerBeat[];
}

export interface LessonPosition {
  chapter: string | null;
  narrationJustHeard: string | null;
  pausePrompt: string | null;
}

export interface AssistantRequest {
  lessonId: string;
  question: string;
  t: number;
  state: PlainState;
  position: LessonPosition;
  temporaryAssistantState: PlainState;
  history: AssistantHistoryTurn[];
}

export interface TimedAnswerBeat {
  t: number;
  set: PlainState;
  over: number;
}

export interface AssistantResponse {
  answer: string;
  beats: AnswerBeat[];
}
