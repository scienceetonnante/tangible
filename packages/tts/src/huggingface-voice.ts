// Qwen3-TTS voice-cloning endpoint adapter. The private endpoint returns raw
// PCM WAV without alignment, so answer beats are generated separately and
// concatenated to recover exact segment boundaries from their sample counts.

import type { SegmentedTtsRequest, SegmentedTtsResult, TtsAdapter, TtsRequest, TtsResult } from "@narrable/core";

const LANGUAGE_NAMES: Record<string, string> = {
  auto: "Auto",
  zh: "Chinese",
  en: "English",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  ru: "Russian",
  es: "Spanish",
};

export interface HuggingFaceVoiceOptions {
  endpointUrl?: string; // defaults to process.env.TTS_ENDPOINT_URL
  token?: string; // defaults to process.env.HF_TTS_TOKEN, then HF_TOKEN
  speaker?: string; // default david_v1
  seed?: number; // default 20260717
  fetchImpl?: typeof fetch;
}

export class HuggingFaceVoiceAdapter implements TtsAdapter {
  id = "hf-endpoint";
  modelId: string;
  private endpointUrl: string;
  private token: string;
  private speaker: string;
  private seed: number;
  private fetchImpl: typeof fetch;

  constructor(opts: HuggingFaceVoiceOptions = {}) {
    this.endpointUrl = (opts.endpointUrl ?? process.env.TTS_ENDPOINT_URL ?? "").replace(/\/$/, "");
    this.token = opts.token ?? process.env.HF_TTS_TOKEN ?? process.env.HF_TOKEN ?? "";
    this.speaker = opts.speaker ?? "david_v1";
    this.seed = opts.seed ?? 20260717;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.modelId = `qwen3-tts:${this.speaker}`;
  }

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const audio = await this.generate(req.text, req.voice || this.speaker, req.language, this.seed);
    const wav = parsePcmWav(audio);
    return { audio, format: "wav", wordTimes: [], duration: wav.duration };
  }

  async synthesizeSegments(req: SegmentedTtsRequest): Promise<SegmentedTtsResult> {
    if (req.segments.length === 0) throw new Error("voice synthesis requires at least one segment");
    const clips: ParsedWav[] = [];
    const segmentStarts: number[] = [];
    let duration = 0;

    for (const [i, text] of req.segments.entries()) {
      segmentStarts.push(duration);
      const audio = await this.generate(text, req.voice || this.speaker, req.language, this.seed + i);
      const clip = parsePcmWav(audio);
      clips.push(clip);
      duration += clip.duration;
    }

    return {
      audio: concatenatePcmWavs(clips),
      format: "wav",
      wordTimes: [],
      duration,
      segmentStarts,
    };
  }

  private async generate(text: string, speaker: string, language: string, seed: number): Promise<Uint8Array> {
    if (!this.endpointUrl) throw new Error("TTS_ENDPOINT_URL is not set");
    if (!this.token) throw new Error("HF_TTS_TOKEN or HF_TOKEN is not set");
    const languageName = LANGUAGE_NAMES[language.toLowerCase()];
    if (!languageName) throw new Error(`unsupported cloned-voice language "${language}"`);

    const response = await this.fetchImpl(`${this.endpointUrl}/generate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "audio/wav",
        "content-type": "application/json",
      },
      body: JSON.stringify({ text, language: languageName, speaker, seed, temperature: 0.9, top_p: 0.95 }),
    });
    if (!response.ok) throw new Error(`Hugging Face voice endpoint ${response.status}: ${await response.text()}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}

interface ParsedWav {
  format: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  fmt: Uint8Array;
  data: Uint8Array;
  duration: number;
}

function parsePcmWav(audio: Uint8Array): ParsedWav {
  if (audio.length < 44 || ascii(audio, 0, 4) !== "RIFF" || ascii(audio, 8, 4) !== "WAVE") {
    throw new Error("voice endpoint returned an invalid WAV file");
  }
  const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
  let fmt: Uint8Array | undefined;
  let data: Uint8Array | undefined;

  for (let offset = 12; offset + 8 <= audio.length;) {
    const id = ascii(audio, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + size;
    if (end > audio.length) throw new Error("voice endpoint returned a truncated WAV file");
    if (id === "fmt ") fmt = audio.slice(start, end);
    if (id === "data") data = audio.slice(start, end);
    offset = end + (size % 2);
  }

  if (!fmt || fmt.length < 16 || !data) throw new Error("voice endpoint WAV is missing PCM chunks");
  const formatView = new DataView(fmt.buffer, fmt.byteOffset, fmt.byteLength);
  const format = formatView.getUint16(0, true);
  const channels = formatView.getUint16(2, true);
  const sampleRate = formatView.getUint32(4, true);
  const byteRate = formatView.getUint32(8, true);
  const bitsPerSample = formatView.getUint16(14, true);
  if (format !== 1 || channels < 1 || sampleRate < 1 || byteRate < 1 || bitsPerSample !== 16) {
    throw new Error("voice endpoint must return 16-bit PCM WAV audio");
  }
  return { format, channels, sampleRate, bitsPerSample, fmt, data, duration: data.length / byteRate };
}

function concatenatePcmWavs(clips: ParsedWav[]): Uint8Array {
  const first = clips[0]!;
  for (const clip of clips.slice(1)) {
    if (
      clip.format !== first.format
      || clip.channels !== first.channels
      || clip.sampleRate !== first.sampleRate
      || clip.bitsPerSample !== first.bitsPerSample
    ) throw new Error("voice endpoint returned incompatible WAV segments");
  }

  const fmtPadding = first.fmt.length % 2;
  const dataLength = clips.reduce((sum, clip) => sum + clip.data.length, 0);
  const audio = new Uint8Array(12 + 8 + first.fmt.length + fmtPadding + 8 + dataLength);
  const view = new DataView(audio.buffer);
  writeAscii(audio, 0, "RIFF");
  view.setUint32(4, audio.length - 8, true);
  writeAscii(audio, 8, "WAVE");
  writeAscii(audio, 12, "fmt ");
  view.setUint32(16, first.fmt.length, true);
  audio.set(first.fmt, 20);
  const dataOffset = 20 + first.fmt.length + fmtPadding;
  writeAscii(audio, dataOffset, "data");
  view.setUint32(dataOffset + 4, dataLength, true);
  let writeOffset = dataOffset + 8;
  for (const clip of clips) {
    audio.set(clip.data, writeOffset);
    writeOffset += clip.data.length;
  }
  return audio;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
}
