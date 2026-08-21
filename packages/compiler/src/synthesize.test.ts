import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SegmentedTtsRequest, TtsAdapter, TtsRequest, TtsResult } from "@narrable/core";
import { synthesize, cacheKey, narrationSegmentOffsets } from "./synthesize.js";

// Minimal deterministic adapter (compiler depends on core only, not @narrable/tts).
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

class SegmentedAdapter implements TtsAdapter {
  id = "segmented";
  segments: string[] = [];
  async synthesize(_req: TtsRequest): Promise<TtsResult> { throw new Error("full-text synthesis should not run"); }
  async synthesizeSegments(req: SegmentedTtsRequest) {
    this.segments = req.segments;
    return {
      audio: new Uint8Array([1, 2, 3]),
      format: "wav" as const,
      wordTimes: [],
      duration: req.segments.length,
      segmentStarts: req.segments.map((_segment, i) => i),
    };
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
    const params = { voice: "v", cacheDir };
    const r1 = await synthesize(a, "hello world", params);
    const r2 = await synthesize(a, "hello world", params);
    expect(a.calls).toBe(1);
    expect(r2.duration).toBe(r1.duration);
    expect(r2.wordTimes).toEqual(r1.wordTimes);
    expect(Array.from(r2.audio)).toEqual(Array.from(r1.audio));
  });

  it("re-synthesizes when the text changes", async () => {
    const a = new CountingAdapter();
    const params = { voice: "v", cacheDir };
    await synthesize(a, "text one", params);
    await synthesize(a, "text two", params);
    expect(a.calls).toBe(2);
  });

  it("derives character timing from exact provider segment boundaries", async () => {
    const a = new SegmentedAdapter();
    const result = await synthesize(a, "one. two", {
      voice: "david_v1",
      cacheDir,
      segmentOffsets: [5],
    });
    expect(a.segments).toEqual(["one.", "two"]);
    expect(result.charTimes).toHaveLength(8);
    expect(result.charTimes![3]!.end).toBe(1);
    expect(result.charTimes![5]!.start).toBe(1);
    expect(result.wordTimes.map((word) => word.word)).toEqual(["one.", "two"]);
  });
});

describe("narrationSegmentOffsets", () => {
  it("combines sentence starts and directive anchors without duplicates", () => {
    expect(narrationSegmentOffsets("One. Two here.", [9, 5])).toEqual([5, 9]);
  });
});

describe("cacheKey", () => {
  it("is stable for identical inputs and differs on text/voice", () => {
    const a = new CountingAdapter();
    expect(cacheKey(a, "v", "abc")).toBe(cacheKey(a, "v", "abc"));
    expect(cacheKey(a, "v", "abc")).not.toBe(cacheKey(a, "v", "abd"));
    expect(cacheKey(a, "v1", "abc")).not.toBe(cacheKey(a, "v2", "abc"));
    expect(cacheKey(a, "v", "abc", undefined, [1])).not.toBe(cacheKey(a, "v", "abc", undefined, [2]));
  });
});
