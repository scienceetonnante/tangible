import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emitAssistantContext } from "./assistant-context.js";
import type { Manifest } from "./manifest.js";

const manifest: Manifest = {
  id: "circle",
  title: "Circle",
  scene: "scenes/scene.ts",
  defaults: { anticipation: -0.2, ease: "linear", transition: 1 },
  tts: { provider: "elevenlabs", voice: "voice", speed: 0.9 },
  assistant: { provider: "huggingface", model: "test/model:provider", context: "assistant.md", commandable: ["theta"] },
};

const scene = {
  schema: {
    theta: {
      type: { kind: "scalar" as const, range: [0, 6.28] as [number, number] },
      default: 0,
      interpolate: "lerp" as const,
      ownership: "script" as const,
      label: "angle",
    },
  },
  presets: {},
  constants: { PI: 3.14 },
};

describe("assistant context", () => {
  it("combines authored guidance with the full script and scene contract", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tangible-assistant-"));
    await mkdir(join(dir, "build/lesson"), { recursive: true });
    await writeFile(join(dir, "assistant.md"), "The red point controls the angle.\n");
    const script = "The angle is @cue(theta = 3.14) half a turn.";

    await emitAssistantContext(dir, manifest, scene, script);

    const got = JSON.parse(await readFile(join(dir, "build/lesson/assistant.json"), "utf8"));
    expect(got.guide).toContain("red point");
    expect(got.script).toBe(script);
    expect(got.narration).toBe("The angle is half a turn.");
    expect(got.commandable).toEqual(["theta"]);
    expect(got).toMatchObject({ provider: "huggingface", model: "test/model:provider" });
    expect(got).not.toHaveProperty("tts");
  });

  it("rejects an unknown commandable parameter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tangible-assistant-"));
    await mkdir(join(dir, "build/lesson"), { recursive: true });
    await writeFile(join(dir, "assistant.md"), "x");
    const bad = { ...manifest, assistant: { ...manifest.assistant!, commandable: ["missing"] } };
    await expect(emitAssistantContext(dir, bad, scene, "Hello.")).rejects.toThrow('unknown parameter "missing"');
  });
});
