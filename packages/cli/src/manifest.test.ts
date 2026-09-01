import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_ASSISTANT_LIMITS } from "@tangible/core";
import { loadManifest } from "./manifest.js";

async function manifest(text: string) {
  const dir = await mkdtemp(join(tmpdir(), "tangible-manifest-"));
  await writeFile(join(dir, "lesson.yaml"), text);
  return loadManifest(dir);
}

describe("lesson manifest", () => {
  it("loads explicit speech and assistant provider configuration", async () => {
    await expect(manifest(`
id: circle
title: Circle
promise: See how a point defines an angle.
scene: ./scenes/scene.ts
defaults:
  anticipation: -0.2
  ease: linear
  transition: 1
tts:
  provider: elevenlabs
  voice: voice-id
  model: eleven_multilingual_v2
  speed: 0.9
assistant:
  provider: huggingface
  model: test/model:provider
  context: assistant.md
  limits:
    request:
      bodyBytes: 65536
      questionCharacters: 900
      historyTurns: 4
      positionCharacters: 1500
    response:
      outputTokens: 800
      beats: 5
      beatCharacters: 500
      answerCharacters: 1600
      transitionSeconds: 1.5
    rate:
      browserRequestsPerTenMinutes: 8
      ipRequestsPerTenMinutes: 40
      globalRequestsPerHour: 120
      globalRequestsPerDay: 500
      concurrentProviderCalls: 2
    providerTimeoutSeconds: 30
  commandable: [theta]
deployment:
  provider: huggingface
  space: example/circle
`)).resolves.toMatchObject({
      tts: { provider: "elevenlabs", voice: "voice-id", model: "eleven_multilingual_v2", speed: 0.9 },
      assistant: {
        provider: "huggingface",
        model: "test/model:provider",
        limits: {
          request: { questionCharacters: 900, historyTurns: 4 },
          response: { outputTokens: 800, transitionSeconds: 1.5 },
          rate: { ipRequestsPerTenMinutes: 40, globalRequestsPerDay: 500 },
          providerTimeoutSeconds: 30,
        },
      },
      deployment: { provider: "huggingface", space: "example/circle" },
    });
  });

  it("uses the documented assistant limits when the block is absent", async () => {
    const loaded = await manifest(`
id: circle
title: Circle
promise: See how a point defines an angle.
scene: ./scenes/scene.ts
defaults:
  anticipation: -0.2
  ease: linear
  transition: 1
tts:
  provider: hf-endpoint
  voice: david_v1
assistant:
  provider: huggingface
  model: test/model:provider
  context: assistant.md
  commandable: []
`);

    expect(loaded.assistant?.limits).toEqual(DEFAULT_ASSISTANT_LIMITS);
  });

  it("rejects non-positive assistant limits", async () => {
    await expect(manifest(`
id: circle
title: Circle
promise: See how a point defines an angle.
scene: ./scenes/scene.ts
defaults:
  anticipation: -0.2
  ease: linear
  transition: 1
tts:
  provider: hf-endpoint
  voice: david_v1
assistant:
  provider: huggingface
  model: test/model:provider
  context: assistant.md
  commandable: []
  limits:
    request:
      bodyBytes: 65536
      questionCharacters: 1000
      historyTurns: 8
      positionCharacters: 2000
    response:
      outputTokens: 1200
      beats: 6
      beatCharacters: 600
      answerCharacters: 2000
      transitionSeconds: 2
    rate:
      browserRequestsPerTenMinutes: 8
      ipRequestsPerTenMinutes: 40
      globalRequestsPerHour: 120
      globalRequestsPerDay: 0
      concurrentProviderCalls: 2
    providerTimeoutSeconds: 30
`)).rejects.toThrow("globalRequestsPerDay");
  });

  it("rejects the former combined voice field", async () => {
    await expect(manifest(`
id: circle
title: Circle
promise: See how a point defines an angle.
scene: ./scenes/scene.ts
voice: elevenlabs:voice-id
defaults:
  anticipation: -0.2
  ease: linear
  transition: 1
`)).rejects.toThrow('lesson.yaml field "tts" must be an object');
  });

  it("rejects settings that the selected speech provider does not support", async () => {
    await expect(manifest(`
id: circle
title: Circle
promise: See how a point defines an angle.
scene: ./scenes/scene.ts
defaults:
  anticipation: -0.2
  ease: linear
  transition: 1
tts:
  provider: hf-endpoint
  voice: david_v1
  speed: 0.9
`)).rejects.toThrow("supported only by ElevenLabs");
  });

  it("rejects a deployment URL in place of a Space identifier", async () => {
    await expect(manifest(`
id: circle
title: Circle
promise: See how a point defines an angle.
scene: ./scenes/scene.ts
defaults:
  anticipation: -0.2
  ease: linear
  transition: 1
tts:
  provider: hf-endpoint
  voice: david_v1
deployment:
  provider: huggingface
  space: https://huggingface.co/spaces/example/circle
`)).rejects.toThrow('must use the "namespace/name" form');
  });
});
