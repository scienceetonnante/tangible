import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SupertonicTtsAdapter } from "./supertonic.js";
import { SUPERTONIC_MODEL_FILES } from "./supertonic-model.js";

describe("SupertonicTtsAdapter", () => {
  it("synthesizes deterministic sentence chunks with approximate character timing", async () => {
    const modelDir = await mkdtemp(join(tmpdir(), "narrable-supertonic-adapter-test-"));
    await mkdir(modelDir, { recursive: true });
    await Promise.all(SUPERTONIC_MODEL_FILES.map((file) => writeFile(join(modelDir, file), file)));
    const generatedTexts: string[] = [];
    const generationConfigs: Record<string, unknown>[] = [];
    let engineConfig: Record<string, unknown> | undefined;
    class GenerationConfig {
      constructor(config: object) {
        generationConfigs.push(config as Record<string, unknown>);
        Object.assign(this, config);
      }
    }
    class OfflineTts {
      constructor(config: object) { engineConfig = config as Record<string, unknown>; }
      generate({ text }: { text: string }) {
        generatedTexts.push(text);
        return { samples: new Float32Array(text.length).fill(0.25), sampleRate: 10 };
      }
    }
    const adapter = new SupertonicTtsAdapter({
      modelDir,
      runtime: { OfflineTts, GenerationConfig },
    });

    try {
      const first = await adapter.synthesize({ text: "One. Two!", voice: "ignored" });
      const second = await adapter.synthesize({ text: "One. Two!", voice: "ignored" });

      expect(generatedTexts).toEqual(["One.", "Two!", "One.", "Two!"]);
      expect(first.duration).toBe(0.8);
      expect(first.charTimes).toHaveLength(9);
      expect(first.charTimes![3]!.end).toBe(0.4);
      expect(first.charTimes![4]).toEqual({ start: 0.4, end: 0.4 });
      expect(first.charTimes![5]!.start).toBe(0.4);
      expect(first.wordTimes.map((word) => word.word)).toEqual(["One.", "Two!"]);
      expect(new TextDecoder().decode(first.audio.slice(0, 4))).toBe("RIFF");
      expect(first.audio).toEqual(second.audio);
      expect(generationConfigs[0]).toMatchObject({
        sid: 0,
        speed: 1,
        numSteps: 5,
        extra: { lang: "en", seed: 20260824 },
      });
      expect(engineConfig).toMatchObject({
        model: {
          supertonic: {
            durationPredictor: join(modelDir, "duration_predictor.int8.onnx"),
            voiceStyle: join(modelDir, "voice.bin"),
          },
          numThreads: 4,
          provider: "cpu",
        },
        maxNumSentences: 1,
      });
    } finally {
      await rm(modelDir, { recursive: true, force: true });
    }
  });
});
