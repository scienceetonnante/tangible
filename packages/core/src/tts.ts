// TTS adapter contract. The interface lives in core (a cross-module contract) so
// the compiler can depend on core only; concrete adapters (fake, elevenlabs, align)
// live in @narrable/tts and are injected by the CLI.

export interface TtsRequest {
  text: string; // stripped narration, verbatim
  voice: string;
  language: string;
  speed?: number; // speaking rate (provider-specific range); undefined = provider default
}

export interface WordTime {
  word: string;
  start: number;
  end: number;
  charOffset: number; // start offset of this word in the request text
}

export type AudioFormat = "mp3" | "wav" | "webm" | "m4a";

export interface TtsResult {
  audio: Uint8Array;
  format: AudioFormat; // container of the audio bytes; drives the emitted filename + <source> type
  charTimes?: { start: number; end: number }[]; // per character of the request text
  wordTimes: WordTime[];
  duration: number; // seconds
}

export interface TtsAdapter {
  id: string; // "fake", "elevenlabs", "align"
  modelId?: string; // participates in the cache key
  synthesize(req: TtsRequest): Promise<TtsResult>;
}
