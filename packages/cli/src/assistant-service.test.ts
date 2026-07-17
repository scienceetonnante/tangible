import { describe, expect, it } from "vitest";
import type { AssistantContext, AssistantRequest, TtsAdapter } from "@narrable/core";
import { FakeTtsAdapter } from "@narrable/tts";
import { answerQuestion, validateAnswer } from "./assistant-service.js";

const context: AssistantContext = {
  version: 1,
  lessonId: "circle",
  language: "en",
  title: "Circle",
  guide: "A circle.",
  script: "A lesson.",
  narration: "A lesson.",
  schema: {
    theta: { type: { kind: "scalar", range: [0, 6.28] }, default: 0, interpolate: "lerp", ownership: "script" },
    secret: { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
  },
  presets: {}, constants: {}, groups: {}, commandable: ["theta"], voice: "elevenlabs:voice", speed: 1,
};

const request: AssistantRequest = {
  lessonId: "circle", language: "en", question: "Why?", t: 3, state: { theta: 0 }, history: [],
};

describe("assistant service", () => {
  it("turns fake beats into timed audio using the lesson voice settings", async () => {
    const response = await answerQuestion(request, context, { fake: true, tts: new FakeTtsAdapter() });
    expect(response.answer).toContain("quarter turn");
    expect(response.timedBeats[0]!.t).toBe(0);
    expect(response.timedBeats[1]!.t).toBeGreaterThan(0);
    expect(response.audioFormat).toBe("wav");
    expect(response.audioBase64.length).toBeGreaterThan(10);
  });

  it("uses provider segment boundaries when character alignment is unavailable", async () => {
    const tts: TtsAdapter = {
      id: "segmented",
      async synthesize() { throw new Error("full-text synthesis should not run"); },
      async synthesizeSegments(req) {
        expect(req.voice).toBe("voice");
        expect(req.segments).toHaveLength(2);
        return {
          audio: new Uint8Array([1, 2]),
          format: "wav",
          wordTimes: [],
          duration: 2,
          segmentStarts: [0, 1.25],
        };
      },
    };
    const response = await answerQuestion(request, context, { fake: true, tts });
    expect(response.timedBeats.map((beat) => beat.t)).toEqual([0, 1.25]);
  });

  it("rejects commands outside the allowlist and scalar range", () => {
    expect(() => validateAnswer([{ say: "x", set: { secret: true }, over: 0 }], context)).toThrow("cannot command");
    expect(() => validateAnswer([{ say: "x", set: { theta: 9 }, over: 0 }], context)).toThrow("outside");
  });

  it("sends full context, history, state, and a strict schema to Hugging Face", async () => {
    let sent: Record<string, unknown> = {};
    const fetchImpl: typeof fetch = async (_input, init) => {
      sent = JSON.parse(String(init!.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ beats: [{ say: "At zero.", set: { theta: 0 }, over: 0.2 }] }) } }] }));
    };
    const response = await answerQuestion(
      { ...request, history: [{ question: "Earlier?", answer: "Earlier.", beats: [{ say: "Earlier.", set: {}, over: 0 }] }] },
      context,
      { tts: new FakeTtsAdapter(), fetchImpl, hfToken: "token", hfModel: "model:provider" },
    );
    expect(response.answer).toBe("At zero.");
    expect(sent.model).toBe("model:provider");
    const messages = sent.messages as { content: string }[];
    expect(messages[0]!.content).toContain('"script":"A lesson."');
    expect(messages.at(-1)!.content).toContain('"lessonTime":3');
    expect(JSON.stringify(sent.response_format)).toContain('"additionalProperties":false');
  });
});
