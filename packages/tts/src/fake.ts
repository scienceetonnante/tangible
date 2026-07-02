// Deterministic fake TTS adapter: 60 ms per character, silent audio. Makes the
// whole compiler pipeline run hermetically in CI (no network, no API key).

import type { TtsAdapter, TtsRequest, TtsResult, WordTime } from "@xv/core";

const SEC_PER_CHAR = 0.06;

export class FakeTtsAdapter implements TtsAdapter {
  id = "fake";
  modelId = "fake-v1";

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const text = req.text;
    const charTimes = Array.from({ length: text.length }, (_, i) => ({
      start: i * SEC_PER_CHAR,
      end: (i + 1) * SEC_PER_CHAR,
    }));
    const duration = text.length * SEC_PER_CHAR;

    const wordTimes: WordTime[] = [];
    for (const m of text.matchAll(/\S+/g)) {
      const charOffset = m.index;
      const last = charOffset + m[0].length - 1;
      wordTimes.push({
        word: m[0],
        start: charTimes[charOffset]?.start ?? 0,
        end: charTimes[last]?.end ?? duration,
        charOffset,
      });
    }

    return { audio: silentWav(duration), charTimes, wordTimes, duration };
  }
}

/** Minimal 8 kHz 16-bit mono silent WAV of the given duration. */
function silentWav(duration: number): Uint8Array {
  const rate = 8000;
  const samples = Math.max(0, Math.round(duration * rate));
  const dataBytes = samples * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const dv = new DataView(buf);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  dv.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  dv.setUint32(16, 16, true); // PCM chunk size
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true); // byte rate
  dv.setUint16(32, 2, true); // block align
  dv.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  dv.setUint32(40, dataBytes, true);
  return new Uint8Array(buf);
}
