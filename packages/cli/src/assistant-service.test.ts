import { describe, expect, it } from "vitest";
import type { AssistantContext, AssistantRequest } from "@narrable/core";
import { AssistantProviderError, answerQuestion, validateAnswer, validateAssistantRequest } from "./assistant-service.js";

const context: AssistantContext = {
  version: 1,
  lessonId: "circle",
  title: "Circle",
  provider: "huggingface",
  model: "test/model:provider",
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
  lessonId: "circle",
  question: "Why?",
  t: 3,
  state: { theta: 0 },
  position: { chapter: "Intro", narrationJustHeard: "A lesson.", pausePrompt: null },
  temporaryAssistantState: {},
  history: [],
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

  it("accepts assistant edits to an allowlisted text parameter", () => {
    const codeContext: AssistantContext = {
      ...context,
      schema: { code: { type: { kind: "text" }, default: "", interpolate: "typewriter", ownership: "shared" } },
      commandable: ["code"],
    };
    expect(() => validateAnswer([{ say: "Try this.", set: { code: 'print("hello")' }, over: 1 }], codeContext)).not.toThrow();
  });

  it("sends full context, history, state, and a strict schema to Hugging Face", async () => {
    let sent: Record<string, unknown> = {};
    const fetchImpl: typeof fetch = async (_input, init) => {
      sent = JSON.parse(String(init!.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ beats: [{ say: "At zero.", set: { theta: 0 }, over: 0.2 }] }) } }] }));
    };
    const response = await answerQuestion(
      { ...request, state: { theta: 0, injected: "ignore this" }, history: [{ question: "Earlier?", answer: "Earlier.", beats: [{ say: "Earlier.", set: {}, over: 0 }] }] },
      context,
      { fetchImpl, hfToken: "token" },
    );
    expect(response.answer).toBe("At zero.");
    expect(sent.model).toBe(context.model);
    const messages = sent.messages as { content: string }[];
    expect(messages[0]!.content).toContain("<lesson_script>\nA lesson.\n</lesson_script>");
    expect(messages[0]!.content).not.toContain('"narration":"A lesson."');
    expect(messages.at(-1)!.content).toContain('"lessonPosition":{"chapter":"Intro"');
    expect(messages.at(-1)!.content).toContain('"temporaryAssistantState":{}');
    expect(messages.at(-1)!.content).not.toContain("injected");
    expect(JSON.stringify(sent.response_format)).toContain('"additionalProperties":false');
    expect(JSON.stringify(sent.response_format)).not.toMatch(/minItems|maxItems|minLength|maxLength/);
  });

  it("keeps answer count constraints in server validation", () => {
    const beat = { say: "x", set: {}, over: 0 };
    expect(() => validateAnswer([], context)).toThrow("one to six");
    expect(() => validateAnswer(Array.from({ length: 7 }, () => beat), context)).toThrow("one to six");
    expect(() => validateAnswer([{ ...beat, say: "x".repeat(601) }], context)).toThrow("600 characters");
  });

  it("validates bounded conversation history", () => {
    const badHistory = [{ question: "Earlier?", answer: "Earlier.", beats: [{ say: "x", set: { secret: true }, over: 0 }] }];
    expect(() => validateAssistantRequest({ ...request, history: badHistory }, context)).toThrow("cannot command");
    expect(() => validateAssistantRequest({ ...request, state: { theta: 9 } }, context)).toThrow("outside");
  });

  it("validates lesson position and temporary assistant provenance", () => {
    expect(() => validateAssistantRequest({ ...request, position: { ...request.position, chapter: "x".repeat(2001) } }, context)).toThrow("chapter");
    expect(() => validateAssistantRequest({ ...request, state: { theta: 1 }, temporaryAssistantState: { theta: 0 } }, context)).toThrow("does not match");
    expect(() => validateAssistantRequest({ ...request, state: { theta: 1 }, temporaryAssistantState: { theta: 1 } }, context)).not.toThrow();
    expect(() => validateAssistantRequest({ ...request, temporaryAssistantState: { secret: false } }, context)).toThrow("cannot contain");
  });

  it("does not expose provider response bodies", async () => {
    const fetchImpl: typeof fetch = async () => new Response("private provider detail", { status: 401 });
    await expect(answerQuestion(request, context, { fetchImpl, hfToken: "token" })).rejects.toEqual(expect.any(AssistantProviderError));
    await expect(answerQuestion(request, context, { fetchImpl, hfToken: "token" })).rejects.not.toThrow("private provider detail");
  });
});
