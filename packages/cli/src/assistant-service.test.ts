import { describe, expect, it } from "vitest";
import { DEFAULT_ASSISTANT_LIMITS, type AssistantContext, type AssistantRequest } from "@tangible/core";
import { AssistantProviderError, AssistantProviderTimeoutError, answerQuestion, validateAnswer, validateAssistantRequest } from "./assistant-service.js";

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
  limits: DEFAULT_ASSISTANT_LIMITS,
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

  it("exposes the exact provider request for local inspection in offline mode", async () => {
    let logged: Record<string, unknown> | undefined;
    await answerQuestion(request, context, { fake: true, onProviderRequest: (providerRequest) => { logged = providerRequest; } });

    expect(logged?.model).toBe(context.model);
    const messages = logged?.messages as { role: string; content: string }[];
    expect(messages[0]).toMatchObject({ role: "system" });
    expect(messages[0]!.content).toContain("# Teaching assistant for “Circle”");
    expect(messages.at(-1)!.content).toContain('"question": "Why?"');
    expect(logged?.response_format).toBeDefined();
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
    const providerContext: AssistantContext = {
      ...context,
      limits: {
        ...context.limits,
        response: { ...context.limits.response, outputTokens: 321 },
      },
    };
    const fetchImpl: typeof fetch = async (_input, init) => {
      sent = JSON.parse(String(init!.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ beats: [{ say: "At zero.", set: { theta: 0 }, over: 0.2 }] }) } }] }));
    };
    const response = await answerQuestion(
      { ...request, state: { theta: 0, injected: "ignore this" }, history: [{ question: "Earlier?", answer: "Earlier.", beats: [{ say: "Earlier.", set: {}, over: 0 }] }] },
      providerContext,
      { fetchImpl, hfToken: "token" },
    );
    expect(response.answer).toBe("At zero.");
    expect(sent.model).toBe(providerContext.model);
    expect(sent.max_tokens).toBe(321);
    const messages = sent.messages as { content: string }[];
    expect(messages[0]!.content).toContain('<chapter title="Lesson">\n\n<spoken_narration>\nA lesson.\n</spoken_narration>');
    expect(messages[0]!.content).not.toContain('"narration":"A lesson."');
    const current = JSON.parse(messages.at(-1)!.content);
    expect(current.lessonPosition).toMatchObject({ chapter: "Intro" });
    expect(current.temporaryAssistantState).toEqual({});
    expect(current.visibleState).not.toHaveProperty("injected");
    expect(JSON.stringify(sent.response_format)).toContain('"additionalProperties":false');
    expect(JSON.stringify(sent.response_format)).not.toMatch(/minItems|maxItems|minLength|maxLength/);
  });

  it("keeps answer count constraints in server validation", () => {
    const beat = { say: "x", set: {}, over: 0 };
    expect(() => validateAnswer([], context)).toThrow("between 1 and 6");
    expect(() => validateAnswer(Array.from({ length: 7 }, () => beat), context)).toThrow(
      "between 1 and 6",
    );
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

  it("aborts a provider call after the configured timeout", async () => {
    const fetchImpl: typeof fetch = (_input, init) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return reject(new Error("missing abort signal"));
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    const timedContext: AssistantContext = {
      ...context,
      limits: { ...context.limits, providerTimeoutSeconds: 0.001 },
    };

    await expect(answerQuestion(request, timedContext, { fetchImpl, hfToken: "token" })).rejects.toBeInstanceOf(AssistantProviderTimeoutError);
  });
});
