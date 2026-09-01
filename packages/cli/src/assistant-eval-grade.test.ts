import { describe, expect, it } from "vitest";
import { gradeAssistantEvalResults } from "./assistant-eval-grade.js";

const candidateResults = [{
  lessonId: "optimizers",
  caseId: "explain-learning-rate",
  configurationId: "gemma-direct",
  model: "google/gemma-4-31B-it:cerebras",
  variant: "structured",
  repetition: 1,
  at: 40,
  turns: [{
    question: "What does the learning rate do?",
    rubric: {
      referenceFacts: ["It scales the negative-gradient update."],
      scene: { policy: "forbidden" },
    },
    evaluationContext: {
      lessonPosition: { chapter: "The easy bowl", narrationJustHeard: "Eta controls the step.", pausePrompt: null },
      visibleState: { kappa: 1, "sgd.lr": 0.02 },
      temporaryAssistantState: {},
      history: [],
    },
    answer: "It scales the size of each update.",
    beats: [{ say: "It scales the size of each update.", set: {}, over: 0 }],
    deterministicChecks: [{ id: "scene-policy", passed: true }],
    latencyMs: 800,
  }],
}];

describe("assistant evaluation grading", () => {
  it("blinds the judge and restores candidate identity only in saved grades", async () => {
    let judgeInput = "";
    const fetchImpl: typeof fetch = async (_url, init) => {
      const request = JSON.parse(String(init!.body));
      judgeInput = request.input[1].content;
      return new Response(JSON.stringify({
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: JSON.stringify({
              scientificCorrectness: 4,
              grounding: 4,
              pedagogicalQuality: 3,
              sceneChangeQuality: 4,
              scopeResistance: null,
              criticalError: false,
              explanation: "Correct and concise.",
            }),
          }],
        }],
      }));
    };

    const output = await gradeAssistantEvalResults(candidateResults, {}, {
      fetchImpl,
      openaiApiKey: "test-key",
      now: () => new Date("2026-09-01T08:00:00Z"),
    });
    const records = output.records as Record<string, unknown>[];
    const summary = output.summary as Record<string, unknown>[];

    expect(judgeInput).not.toContain("gemma-direct");
    expect(judgeInput).not.toContain("google/gemma");
    expect(records[0]).toMatchObject({
      configurationId: "gemma-direct",
      candidateModel: "google/gemma-4-31B-it:cerebras",
      status: "graded",
    });
    expect(summary[0]).toMatchObject({
      configurationId: "gemma-direct",
      gradedTurns: 1,
      meanScientificCorrectness: 4,
      medianCandidateLatencyMs: 800,
    });
  });

  it("records an invalid judge response without losing the evaluation", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      output: [{ type: "message", content: [{ type: "output_text", text: "not JSON" }] }],
    }));

    const output = await gradeAssistantEvalResults(candidateResults, {}, {
      fetchImpl,
      openaiApiKey: "test-key",
    });
    expect(output.records).toEqual([
      expect.objectContaining({
        status: "judge_error",
        error: expect.objectContaining({ category: "judge_invalid_response" }),
      }),
    ]);
  });
});
