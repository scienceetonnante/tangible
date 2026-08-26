import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  commandable: [theta]
deployment:
  provider: huggingface
  space: example/circle
`)).resolves.toMatchObject({
      tts: { provider: "elevenlabs", voice: "voice-id", model: "eleven_multilingual_v2", speed: 0.9 },
      assistant: { provider: "huggingface", model: "test/model:provider" },
      deployment: { provider: "huggingface", space: "example/circle" },
    });
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
