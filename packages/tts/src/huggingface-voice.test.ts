import { describe, expect, it } from "vitest";
import { HuggingFaceVoiceAdapter } from "./huggingface-voice.js";

describe("HuggingFaceVoiceAdapter", () => {
  it("generates each answer beat and joins PCM WAV audio with exact start times", async () => {
    const requests: { url: string; authorization: string; body: Record<string, unknown> }[] = [];
    const clips = [pcmWav(0.25), pcmWav(0.5)];
    const fetchImpl: typeof fetch = async (input, init) => {
      const clip = clips[requests.length]!;
      requests.push({
        url: String(input),
        authorization: new Headers(init!.headers).get("authorization") ?? "",
        body: JSON.parse(String(init!.body)),
      });
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => clip.slice().buffer as ArrayBuffer,
        text: async () => "",
      } as Response;
    };
    const adapter = new HuggingFaceVoiceAdapter({ endpointUrl: "https://voice.example/", token: "secret", fetchImpl });

    const result = await adapter.synthesizeSegments!({
      segments: ["First.", "Second."],
      voice: "david_v1",
    });

    expect(result.segmentStarts).toEqual([0, 0.25]);
    expect(result.duration).toBe(0.75);
    expect(result.format).toBe("wav");
    expect(new DataView(result.audio.buffer).getUint32(40, true)).toBe(12_000);
    expect(requests.map((request) => request.url)).toEqual([
      "https://voice.example/generate",
      "https://voice.example/generate",
    ]);
    expect(requests[0]!.authorization).toBe("Bearer secret");
    expect(requests[0]!.body).toMatchObject({ text: "First.", language: "English", speaker: "david_v1", seed: 20260717 });
    expect(requests[1]!.body.seed).toBe(20260718);
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
