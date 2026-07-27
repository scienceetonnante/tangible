import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emitAssistantContext } from "./assistant-context.js";
import type { Manifest } from "./manifest.js";

const manifest: Manifest = {
  id: "circle",
  title: { en: "Circle" },
  scene: "scene.ts",
  languages: ["en"],
  voice: { en: "elevenlabs:voice" },
  defaults: { anticipation: -0.2, ease: "linear", transition: 1 },
  tts: { speed: 0.9 },
  assistant: { context: { en: "assistant.en.md" }, commandable: ["theta"] },
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
    const dir = await mkdtemp(join(tmpdir(), "narrable-assistant-"));
    await mkdir(join(dir, "build/en"), { recursive: true });
    await writeFile(join(dir, "assistant.en.md"), "The red point controls the angle.\n");
    const script = "The angle is @cue(theta = 3.14) half a turn.";

    await emitAssistantContext(dir, manifest, scene, "en", script);

    const got = JSON.parse(await readFile(join(dir, "build/en/assistant.json"), "utf8"));
    expect(got.guide).toContain("red point");
    expect(got.script).toBe(script);
    expect(got.narration).toBe("The angle is half a turn.");
    expect(got.commandable).toEqual(["theta"]);
    expect(got).not.toHaveProperty("voice");
  });

  it("rejects an unknown commandable parameter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "narrable-assistant-"));
    await mkdir(join(dir, "build/en"), { recursive: true });
    await writeFile(join(dir, "assistant.en.md"), "x");
    const bad = { ...manifest, assistant: { ...manifest.assistant!, commandable: ["missing"] } };
    await expect(emitAssistantContext(dir, bad, scene, "en", "Hello.")).rejects.toThrow('unknown parameter "missing"');
  });
});
