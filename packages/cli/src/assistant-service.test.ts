import { describe, expect, it } from "vitest";
import type { AssistantContext, AssistantRequest } from "@narrable/core";
import { ASSISTANT_MODEL, answerQuestion, validateAnswer } from "./assistant-service.js";

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
  presets: {}, constants: {}, groups: {}, commandable: ["theta"],
};

const request: AssistantRequest = {
  lessonId: "circle", language: "en", question: "Why?", t: 3, state: { theta: 0 }, history: [],
};

describe("assistant service", () => {
  it("turns fake beats into a written answer", async () => {
    const response = await answerQuestion(request, context, { fake: true });
    expect(response.answer).toContain("quarter turn");
    expect(response.beats).toHaveLength(2);
    expect(response).not.toHaveProperty("audioBase64");
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
      { fetchImpl, hfToken: "token" },
    );
    expect(response.answer).toBe("At zero.");
    expect(sent.model).toBe(ASSISTANT_MODEL);
    const messages = sent.messages as { content: string }[];
    expect(messages[0]!.content).toContain('"script":"A lesson."');
    expect(messages.at(-1)!.content).toContain('"lessonTime":3');
    expect(JSON.stringify(sent.response_format)).toContain('"additionalProperties":false');
    expect(JSON.stringify(sent.response_format)).not.toMatch(/minItems|maxItems|minLength|maxLength/);
  });

  it("keeps answer count constraints in server validation", () => {
    const beat = { say: "x", set: {}, over: 0 };
    expect(() => validateAnswer([], context)).toThrow("one to six");
    expect(() => validateAnswer(Array.from({ length: 7 }, () => beat), context)).toThrow("one to six");
    expect(() => validateAnswer([{ ...beat, say: "x".repeat(601) }], context)).toThrow("600 characters");
  });
});
