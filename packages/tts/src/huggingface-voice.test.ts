import { describe, expect, it } from "vitest";
import { HuggingFaceVoiceAdapter } from "./huggingface-voice.js";

describe("HuggingFaceVoiceAdapter", () => {
  it("generates each answer beat and joins PCM WAV audio with exact start times", async () => {
    const requests: { url: string; authorization: string; scaleUpTimeout: string; body?: Record<string, unknown> }[] = [];
    const statuses: string[] = [];
    const clips = [pcmWav(0.25), pcmWav(0.5)];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init!.headers);
      requests.push({
        url: String(input),
        authorization: headers.get("authorization") ?? "",
        scaleUpTimeout: headers.get("x-scale-up-timeout") ?? "",
        body: init!.body ? JSON.parse(String(init!.body)) : undefined,
      });
      if (String(input).endsWith("/health")) return { ok: true, status: 200, text: async () => "" } as Response;
      const clip = clips[requests.length - 2]!;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => clip.slice().buffer as ArrayBuffer,
        text: async () => "",
      } as Response;
    };
    const adapter = new HuggingFaceVoiceAdapter({
      endpointUrl: "https://voice.example/",
      token: "secret",
      onStatus: (message) => statuses.push(message),
      fetchImpl,
    });

    const result = await adapter.synthesizeSegments!({
      segments: ["First.", "Second."],
      voice: "david_v1",
    });

    expect(result.segmentStarts).toEqual([0, 0.25]);
    expect(result.duration).toBe(0.75);
    expect(result.format).toBe("wav");
    expect(new DataView(result.audio.buffer).getUint32(40, true)).toBe(12_000);
    expect(requests.map((request) => request.url)).toEqual([
      "https://voice.example/health",
      "https://voice.example/generate",
      "https://voice.example/generate",
    ]);
    expect(requests.every((request) => request.authorization === "Bearer secret")).toBe(true);
    expect(requests.every((request) => request.scaleUpTimeout === "600")).toBe(true);
    expect(requests[1]!.body).toMatchObject({ text: "First.", language: "English", speaker: "david_v1", seed: 20260717 });
    expect(requests[2]!.body!.seed).toBe(20260718);
    expect(statuses).toEqual([
      "Tangible is waiting for the Hugging Face voice endpoint; a cold start can take several minutes.",
      "The Hugging Face voice endpoint is ready.",
      "Tangible is generating narration segment 1 of 2.",
      "Tangible is generating narration segment 2 of 2.",
    ]);
  });
});

function pcmWav(duration: number): Uint8Array {
  const rate = 8000;
  const dataLength = Math.round(duration * rate) * 2;
  const audio = new Uint8Array(44 + dataLength);
  const view = new DataView(audio.buffer);
  writeAscii(audio, 0, "RIFF");
  view.setUint32(4, audio.length - 8, true);
  writeAscii(audio, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(audio, 36, "data");
  view.setUint32(40, dataLength, true);
  return audio;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
}
