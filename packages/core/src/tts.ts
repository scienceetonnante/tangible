// TTS adapter contract. The interface lives in core (a cross-module contract) so
// the compiler can depend on core only; concrete adapters (fake, elevenlabs, align)
// live in @xv/tts and are injected by the CLI.

export interface TtsRequest {
  text: string; // stripped narration, verbatim
  voice: string;
  language: string;
}

export interface WordTime {
  word: string;
  start: number;
  end: number;
  charOffset: number; // start offset of this word in the request text
}

export interface TtsResult {
  audio: Uint8Array; // mp3 or wav; the compiler transcodes
  charTimes?: { start: number; end: number }[]; // per character of the request text
  wordTimes: WordTime[];
  duration: number; // seconds
}

export interface TtsAdapter {
  id: string; // "fake", "elevenlabs", "align"
  modelId?: string; // participates in the cache key
  synthesize(req: TtsRequest): Promise<TtsResult>;
}
