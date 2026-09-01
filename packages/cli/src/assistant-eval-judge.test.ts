import { describe, expect, it } from "vitest";
import type { AssistantEvalRubric } from "./assistant-eval-format.js";
import {
  buildAssistantJudgeRequest,
  judgeAssistantTurn,
  validateAssistantJudgeGrade,
  type AssistantJudgeGrade,
  type AssistantJudgeInput,
} from "./assistant-eval-judge.js";

const rubric: AssistantEvalRubric = {
  referenceFacts: ["A smaller positive learning rate makes the update smaller."],
  forbiddenClaims: ["A larger learning rate is always better."],
  criticalErrors: ["The answer claims that a larger rate always converges faster."],
  scene: { policy: "forbidden" },
};

const input: AssistantJudgeInput = {
  question: "What does the learning rate do?",
  conversationHistory: [],
  lessonPosition: { chapter: "The easy bowl", narrationJustHeard: "The size is controlled by eta.", pausePrompt: null },
  visibleState: { kappa: 1, "sgd.lr": 0.02 },
  temporaryAssistantState: {},
  answer: "It scales the size of each update.",
  beats: [{ say: "It scales the size of each update.", set: {}, over: 0 }],
  rubric,
  deterministicChecks: [{ id: "scene-policy", passed: true }],
};

const grade: AssistantJudgeGrade = {
  scientificCorrectness: 4,
  grounding: 4,
  pedagogicalQuality: 3,
  sceneChangeQuality: 4,
  scopeResistance: null,
  criticalError: false,
  explanation: "The answer is correct, direct, and obeys the no-change policy.",
};

describe("assistant evaluation judge", () => {
  it("builds a high-reasoning structured-output request", () => {
    const request = buildAssistantJudgeRequest(input);

    expect(request).toMatchObject({
      model: "gpt-5.6-sol",
      reasoning: { effort: "high" },
      store: false,
      text: { format: { type: "json_schema", strict: true } },
    });
    const messages = request.input as { role: string; content: string }[];
    expect(messages[0]!.role).toBe("developer");
    expect(JSON.parse(messages[1]!.content)).toMatchObject({
      question: input.question,
      answer: input.answer,
    });
  });

  it("parses and validates a fake OpenAI Responses result", async () => {
    let sent: Record<string, unknown> | undefined;
    const fetchImpl: typeof fetch = async (_url, init) => {
      sent = JSON.parse(String(init!.body));
      return new Response(JSON.stringify({
        id: "resp_test123",
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(grade) }] }],
        usage: {
          input_tokens: 900,
          output_tokens: 120,
          total_tokens: 1020,
          output_tokens_details: { reasoning_tokens: 80 },
        },
      }));
    };

    const result = await judgeAssistantTurn(input, { fetchImpl, openaiApiKey: "test-key" });

    expect(sent?.model).toBe("gpt-5.6-sol");
    expect(result).toEqual({
      grade,
      responseId: "resp_test123",
      metrics: { inputTokens: 900, outputTokens: 120, totalTokens: 1020, reasoningTokens: 80 },
    });
  });

  it("rejects scores that contradict whether scope grading applies", () => {
    expect(() => validateAssistantJudgeGrade({ ...grade, scopeResistance: 4 }, rubric)).toThrow(
      "scopeResistance must be null",
    );
    expect(() => validateAssistantJudgeGrade(
      { ...grade, scopeResistance: null },
      { ...rubric, evaluateScope: true },
    )).toThrow("scopeResistance must be scored");
  });
});
