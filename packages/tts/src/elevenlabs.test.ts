import { describe, it, expect } from "vitest";
import { ElevenLabsAdapter, splitKeepingSeparators } from "./elevenlabs.js";

// Mock fetch: returns per-character alignment at 0.05s/char and 2 bytes of audio.
function mockFetch(sent: string[]) {
  return async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init!.body));
    sent.push(body.text);
    const chars = [...body.text];
    return {
      ok: true,
      status: 200,
      json: async () => ({
        audio_base64: Buffer.from([1, 2]).toString("base64"),
        alignment: {
          characters: chars,
          character_start_times_seconds: chars.map((_c, i) => i * 0.05),
          character_end_times_seconds: chars.map((_c, i) => (i + 1) * 0.05),
        },
      }),
      text: async () => "",
    } as unknown as Response;
  };
}

describe("splitKeepingSeparators", () => {
  it("keeps separators so concatenation reconstructs the text", () => {
    const parts = splitKeepingSeparators("aa\n\nbb");
    expect(parts).toEqual([
      { text: "aa", isSeparator: false },
      { text: "\n\n", isSeparator: true },
      { text: "bb", isSeparator: false },
    ]);
    expect(parts.map((p) => p.text).join("")).toBe("aa\n\nbb");
  });
});

describe("ElevenLabsAdapter", () => {
  it("throws without an API key", async () => {
    const a = new ElevenLabsAdapter({ apiKey: "", fetchImpl: mockFetch([]) });
    await expect(a.synthesize({ text: "hi", voice: "v", language: "fr" })).rejects.toThrow(/API_KEY/);
  });

  it("returns char and word times for a single request", async () => {
    const a = new ElevenLabsAdapter({ apiKey: "k", fetchImpl: mockFetch([]) });
    const r = await a.synthesize({ text: "ab cd", voice: "v", language: "fr" });
    expect(r.charTimes).toHaveLength(5);
    expect(r.duration).toBeCloseTo(0.25, 9);
    expect(r.wordTimes.map((w) => w.word)).toEqual(["ab", "cd"]);
    expect(r.wordTimes[1]!.charOffset).toBe(3);
  });

  it("chunks at paragraph boundaries (never inside a word) and re-offsets times", async () => {
    const sent: string[] = [];
    const a = new ElevenLabsAdapter({ apiKey: "k", fetchImpl: mockFetch(sent) });
    const r = await a.synthesize({ text: "aa\n\nbb", voice: "v", language: "fr" });
    expect(sent).toEqual(["aa", "bb"]); // separators are not sent; paragraphs intact
    expect(r.charTimes).toHaveLength(6); // aa(2) + \n\n(2) + bb(2)
    // "bb" starts after "aa"'s duration (0.1s), separators pinned to the boundary.
    expect(r.charTimes![4]!.start).toBeCloseTo(0.1, 9);
    expect(r.charTimes![2]!.start).toBeCloseTo(0.1, 9); // first separator char at boundary
  });
});
