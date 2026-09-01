import { describe, expect, it } from "vitest";
import type { Schema } from "@tangible/core";
import {
  classifyAssistantEvalError,
  validateAssistantEvalFile,
  type AssistantEvalFile,
} from "./assistant-eval.js";
import { AssistantProviderError, AssistantProviderTimeoutError } from "./assistant-service.js";

const schema: Schema = {
  theta: {
    type: { kind: "scalar", range: [0, 6.28] },
    default: 0,
    interpolate: "lerp",
    ownership: "shared",
  },
};

const validFile: AssistantEvalFile = {
  repeats: 3,
  configurations: [
    { id: "gemma-direct", model: "google/gemma-4-31B-it:provider" },
    {
      id: "qwen-thinking",
      model: "Qwen/Qwen3.8-27B:provider",
      request: { reasoning_effort: "medium", chat_template_kwargs: { enable_thinking: true } },
    },
  ],
  cases: [{ id: "explain-angle", at: 12, state: { theta: 3.14 }, turns: ["Why is this pi?"] }],
};

describe("assistant evaluation file", () => {
  it("accepts model configurations, repeats, and valid scene state", () => {
    expect(() => validateAssistantEvalFile(validFile, "assistant.eval.yaml", schema, 30)).not.toThrow();
  });

  it("rejects ambiguous identifiers and unsafe request overrides", () => {
    expect(() => validateAssistantEvalFile(
      { ...validFile, cases: [{ id: "Bad id", at: 1, turns: ["Why?"] }] },
      "assistant.eval.yaml",
      schema,
      30,
    )).toThrow("lowercase id");
    expect(() => validateAssistantEvalFile(
      {
        ...validFile,
        configurations: [{ id: "unsafe", model: "model", request: { response_format: { type: "text" } } }],
      },
      "assistant.eval.yaml",
      schema,
      30,
    )).toThrow('cannot override "response_format"');
  });

  it("rejects invalid repeats, times, and state", () => {
    expect(() => validateAssistantEvalFile(
      { ...validFile, repeats: 0 },
      "assistant.eval.yaml",
      schema,
      30,
    )).toThrow("between 1 and 20");
    expect(() => validateAssistantEvalFile(
      { ...validFile, cases: [{ id: "too-late", at: 31, turns: ["Why?"] }] },
      "assistant.eval.yaml",
      schema,
      30,
    )).toThrow("between 0 and 30");
    expect(() => validateAssistantEvalFile(
      { ...validFile, cases: [{ id: "bad-state", at: 1, state: { theta: 9 }, turns: ["Why?"] }] },
      "assistant.eval.yaml",
      schema,
      30,
    )).toThrow("outside [0, 6.28]");
  });
});

describe("assistant evaluation failures", () => {
  it("classifies expected provider failures without including response bodies", () => {
    expect(classifyAssistantEvalError(new AssistantProviderTimeoutError())).toMatchObject({
      category: "provider_timeout",
    });
    expect(classifyAssistantEvalError(new AssistantProviderError(429))).toEqual({
      category: "provider_failure",
      message: "assistant provider returned HTTP 429",
      status: 429,
    });
    expect(classifyAssistantEvalError(new Error("HF_TOKEN is not set"))).toMatchObject({
      category: "missing_credentials",
    });
    expect(classifyAssistantEvalError(new SyntaxError("bad JSON"))).toMatchObject({
      category: "invalid_response",
    });
  });
});
