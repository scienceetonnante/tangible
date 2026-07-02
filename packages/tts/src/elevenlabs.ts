// ElevenLabs adapter: POST /v1/text-to-speech/{voice}/with-timestamps → character
// -level times. Long scripts are chunked at paragraph boundaries (never inside a
// word) and times re-offset. The API key comes from the environment, never files.

import type { TtsAdapter, TtsRequest, TtsResult, WordTime } from "@xv/core";

interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}
interface ElevenResponse {
  audio_base64: string;
  alignment: Alignment;
}

export interface ElevenLabsOptions {
  apiKey?: string; // defaults to process.env.ELEVENLABS_API_KEY
  modelId?: string; // default eleven_multilingual_v2 (strong in French)
  baseUrl?: string; // default https://api.elevenlabs.io
  fetchImpl?: typeof fetch; // injectable for tests
}

export class ElevenLabsAdapter implements TtsAdapter {
  id = "elevenlabs";
  modelId: string;
  private apiKey: string;
  private baseUrl: string;
  private fetchImpl: typeof fetch;

  constructor(opts: ElevenLabsOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
    this.modelId = opts.modelId ?? "eleven_multilingual_v2";
    this.baseUrl = opts.baseUrl ?? "https://api.elevenlabs.io";
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    if (!this.apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

    const charTimes: { start: number; end: number }[] = [];
    const audioChunks: Uint8Array[] = [];
    let timeOffset = 0;

    // Split into paragraphs and separators; separators carry no audio but keep
    // charTimes aligned 1:1 with the request text.
    for (const part of splitKeepingSeparators(req.text)) {
      if (part.isSeparator) {
        for (let i = 0; i < part.text.length; i++) charTimes.push({ start: timeOffset, end: timeOffset });
        continue;
      }
      const resp = await this.post(part.text, req.voice, req.language);
      const a = resp.alignment;
      for (let i = 0; i < a.characters.length; i++) {
        charTimes.push({ start: timeOffset + a.character_start_times_seconds[i]!, end: timeOffset + a.character_end_times_seconds[i]! });
      }
      audioChunks.push(Buffer.from(resp.audio_base64, "base64"));
      timeOffset += a.character_end_times_seconds[a.character_end_times_seconds.length - 1] ?? 0;
    }

    return {
      audio: new Uint8Array(Buffer.concat(audioChunks)),
      charTimes,
      wordTimes: deriveWordTimes(req.text, charTimes),
      duration: timeOffset,
    };
  }

  private async post(text: string, voice: string, language: string): Promise<ElevenResponse> {
    const url = `${this.baseUrl}/v1/text-to-speech/${voice}/with-timestamps`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "xi-api-key": this.apiKey, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: this.modelId, language_code: language }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
    return (await res.json()) as ElevenResponse;
  }
}

interface Part {
  text: string;
  isSeparator: boolean;
}

/** Split on blank-line paragraph breaks, keeping the separators as their own parts. */
export function splitKeepingSeparators(text: string): Part[] {
  const parts: Part[] = [];
  const re = /\n{2,}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), isSeparator: false });
    parts.push({ text: m[0], isSeparator: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), isSeparator: false });
  return parts;
}

function deriveWordTimes(text: string, charTimes: { start: number; end: number }[]): WordTime[] {
  const words: WordTime[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    const start = m.index;
    const end = start + m[0].length - 1;
    words.push({ word: m[0], start: charTimes[start]?.start ?? 0, end: charTimes[end]?.end ?? 0, charOffset: start });
  }
  return words;
}
