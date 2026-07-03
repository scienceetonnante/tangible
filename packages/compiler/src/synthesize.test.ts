import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TtsAdapter, TtsRequest } from "@xv/core";
import { synthesize, cacheKey } from "./synthesize.js";

// Minimal deterministic adapter (compiler depends on core only, not @xv/tts).
// Counts how many times the network path (synthesize) is actually hit.
class CountingAdapter implements TtsAdapter {
  id = "fake";
  modelId = "fake-v1";
  calls = 0;
  async synthesize(req: TtsRequest) {
    this.calls++;
    const duration = req.text.length * 0.06;
    return { audio: new Uint8Array([1, 2, 3]), format: "wav" as const, wordTimes: [], duration };
  }
}

let cacheDir: string;
beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "xv-tts-"));
  return () => rm(cacheDir, { recursive: true, force: true });
});

describe("synthesize caching", () => {
  it("calls the adapter once, then serves from cache", async () => {
    const a = new CountingAdapter();
    const params = { voice: "v", language: "fr", cacheDir };
    const r1 = await synthesize(a, "bonjour le monde", params);
    const r2 = await synthesize(a, "bonjour le monde", params);
    expect(a.calls).toBe(1);
    expect(r2.duration).toBe(r1.duration);
    expect(r2.wordTimes).toEqual(r1.wordTimes);
    expect(Array.from(r2.audio)).toEqual(Array.from(r1.audio));
  });

  it("re-synthesizes when the text changes", async () => {
    const a = new CountingAdapter();
    const params = { voice: "v", language: "fr", cacheDir };
    await synthesize(a, "texte un", params);
    await synthesize(a, "texte deux", params);
    expect(a.calls).toBe(2);
  });
});

describe("cacheKey", () => {
  it("is stable for identical inputs and differs on text/voice", () => {
    const a = new CountingAdapter();
    expect(cacheKey(a, "v", "abc")).toBe(cacheKey(a, "v", "abc"));
    expect(cacheKey(a, "v", "abc")).not.toBe(cacheKey(a, "v", "abd"));
    expect(cacheKey(a, "v1", "abc")).not.toBe(cacheKey(a, "v2", "abc"));
  });
});
