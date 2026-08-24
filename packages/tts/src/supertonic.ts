// Fast local narration with the quantized Supertonic 3 model through Sherpa-ONNX.

import { createRequire } from "node:module";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { TtsAdapter, TtsRequest, TtsResult, WordTime } from "@narrable/core";
import {
  ensureSupertonicModel,
  SUPERTONIC_MODEL_FILES,
  SUPERTONIC_MODEL_NAME,
  type SupertonicModelOptions,
} from "./supertonic-model.js";

const require = createRequire(import.meta.url);
const SAMPLE_STEPS = 5;
const SPEAKER_ID = 0;
const RANDOM_SEED = 20260824;

interface GeneratedAudio {
  samples: Float32Array;
  sampleRate: number;
}

interface OfflineTts {
  generate(request: { text: string; generationConfig: object }): GeneratedAudio;
}

interface SherpaRuntime {
  OfflineTts: new (config: object) => OfflineTts;
  GenerationConfig: new (config: object) => object;
}

export interface SupertonicOptions extends SupertonicModelOptions {
  modelDir?: string;
  /** Test seam for replacing the native runtime. */
  runtime?: SherpaRuntime;
}

export class SupertonicTtsAdapter implements TtsAdapter {
  id = "supertonic";
  modelId = `${SUPERTONIC_MODEL_NAME}:speaker=${SPEAKER_ID}:steps=${SAMPLE_STEPS}:seed=${RANDOM_SEED}`;
  private engine?: OfflineTts;
  private runtime?: SherpaRuntime;

  constructor(private options: SupertonicOptions = {}) {}

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const { engine, runtime } = await this.getEngine();
    const charTimes = Array.from({ length: req.text.length }, () => ({ start: 0, end: 0 }));
    const chunks: Float32Array[] = [];
    let sampleRate = 0;
    let sampleCount = 0;

    for (const part of sentenceParts(req.text)) {
      const trimmed = part.text.trim();
      const leading = part.text.length - part.text.trimStart().length;
      const contentStart = part.start + leading;
      const contentEnd = contentStart + trimmed.length;
      const startTime = sampleRate === 0 ? 0 : sampleCount / sampleRate;

      for (let i = part.start; i < contentStart; i++) charTimes[i] = { start: startTime, end: startTime };
      if (!trimmed) {
        for (let i = contentStart; i < part.start + part.text.length; i++) charTimes[i] = { start: startTime, end: startTime };
        continue;
      }

      const generationConfig = new runtime.GenerationConfig({
        sid: SPEAKER_ID,
        speed: req.speed ?? 1,
        numSteps: SAMPLE_STEPS,
        extra: { lang: "en", seed: RANDOM_SEED },
      });
      const generated = engine.generate({ text: trimmed, generationConfig });
      if (!Number.isInteger(generated.sampleRate) || generated.sampleRate <= 0) {
        throw new Error(`Supertonic returned an invalid sample rate: ${generated.sampleRate}`);
      }
      if (sampleRate !== 0 && generated.sampleRate !== sampleRate) {
        throw new Error(`Supertonic changed sample rate from ${sampleRate} to ${generated.sampleRate}`);
      }
      sampleRate = generated.sampleRate;
      const samples = new Float32Array(generated.samples);
      chunks.push(samples);
      const endTime = (sampleCount + samples.length) / sampleRate;
      const contentLength = contentEnd - contentStart;
      for (let i = contentStart; i < contentEnd; i++) {
        charTimes[i] = {
          start: startTime + ((i - contentStart) / contentLength) * (endTime - startTime),
          end: startTime + ((i - contentStart + 1) / contentLength) * (endTime - startTime),
        };
      }
      for (let i = contentEnd; i < part.start + part.text.length; i++) charTimes[i] = { start: endTime, end: endTime };
      sampleCount += samples.length;
    }

    const samples = concatenate(chunks, sampleCount);
    const duration = sampleRate === 0 ? 0 : samples.length / sampleRate;
    return {
      audio: pcm16Wav(samples, sampleRate || 44100),
      format: "wav",
      charTimes,
      wordTimes: deriveWordTimes(req.text, charTimes, duration),
      duration,
    };
  }

  private async getEngine(): Promise<{ engine: OfflineTts; runtime: SherpaRuntime }> {
    if (this.engine && this.runtime) return { engine: this.engine, runtime: this.runtime };
    const configuredDir = this.options.modelDir ?? process.env.NARRABLE_SUPERTONIC_MODEL_DIR;
    const modelDir = configuredDir
      ? resolve(configuredDir)
      : await ensureSupertonicModel(this.options);
    if (configuredDir) await validateModelDir(modelDir);
    const runtime = this.options.runtime ?? loadSherpaRuntime();
    this.engine = new runtime.OfflineTts({
      model: {
        supertonic: {
          durationPredictor: join(modelDir, "duration_predictor.int8.onnx"),
          textEncoder: join(modelDir, "text_encoder.int8.onnx"),
          vectorEstimator: join(modelDir, "vector_estimator.int8.onnx"),
          vocoder: join(modelDir, "vocoder.int8.onnx"),
          ttsJson: join(modelDir, "tts.json"),
          unicodeIndexer: join(modelDir, "unicode_indexer.bin"),
          voiceStyle: join(modelDir, "voice.bin"),
        },
        numThreads: 4,
        debug: false,
        provider: "cpu",
      },
      maxNumSentences: 1,
    });
    this.runtime = runtime;
    return { engine: this.engine, runtime };
  }
}

async function validateModelDir(modelDir: string): Promise<void> {
  try {
    await Promise.all(SUPERTONIC_MODEL_FILES.map((file) => access(join(modelDir, file))));
  } catch {
    throw new Error(`NARRABLE_SUPERTONIC_MODEL_DIR does not contain a complete model: ${modelDir}`);
  }
}

function loadSherpaRuntime(): SherpaRuntime {
  try {
    return require("sherpa-onnx-node") as SherpaRuntime;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`the local Supertonic runtime is unavailable for ${process.platform}/${process.arch}: ${detail}`);
  }
}

function sentenceParts(text: string): { text: string; start: number }[] {
  if (!text) return [];
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  return [...segmenter.segment(text)].map((part) => ({ text: part.segment, start: part.index }));
}

function concatenate(chunks: Float32Array[], length: number): Float32Array {
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function deriveWordTimes(text: string, charTimes: { start: number; end: number }[], duration: number): WordTime[] {
  return [...text.matchAll(/\S+/g)].map((match) => {
    const charOffset = match.index;
    const last = charOffset + match[0].length - 1;
    return {
      word: match[0],
      start: charTimes[charOffset]?.start ?? 0,
      end: charTimes[last]?.end ?? duration,
      charOffset,
    };
  });
}

function pcm16Wav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}
