import { describe, expect, it } from "vitest";
import type { AssistantContext } from "@narrable/core";
import { formatAssistantSystemPrompt } from "./assistant-prompt.js";

const context: AssistantContext = {
  version: 1,
  lessonId: "circle",
  title: "A circle",
  provider: "huggingface",
  model: "test/model:provider",
  guide: "# Visual context\n\nThe learner drags a point.\n\n```python\n# This is a code comment.\n```",
  script: "@chapter(Projection)\n\n@cue(theta -> HALF_PI, over: 1s) The cosine becomes zero.\n\n@board(rule: $\\cos(\\pi/2)=0$)\nThis equation records the result.\n\n@pause(prompt: \"Try another angle.\", speak: false)",
  narration: "The cosine becomes zero.",
  schema: {
    theta: { type: { kind: "scalar", range: [0, 6.28] }, default: 0, interpolate: "lerp", ownership: "script", label: "angle" },
    visible: { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
    note: { type: { kind: "text" }, default: "", interpolate: "typewriter", ownership: "shared" },
    mode: { type: { kind: "enum", values: ["a", "b"] }, default: "a", interpolate: "snap", ownership: "script" },
  },
  presets: { side: { theta: 1 } },
  constants: { HALF_PI: 1.57 },
  groups: { display: ["visible", "note"] },
  commandable: ["theta", "visible"],
};

describe("assistant prompt", () => {
  it("formats the lesson artifact as readable structured context", () => {
    const prompt = formatAssistantSystemPrompt(context, "structured");

    expect(prompt).toContain("# Teaching assistant for “A circle”");
    expect(prompt.match(/^## .+$/gm)).toEqual([
      "## 1. Task",
      "## 2. Lesson-specific guidance",
      "## 3. Lesson narration",
      "## 4. Scene controls",
      "## 5. Response",
    ]);
    expect(prompt).toContain("## 2. Lesson-specific guidance\n\n### Visual context");
    expect(prompt).toContain("```python\n# This is a code comment.\n```");
    expect(prompt).toContain("### Changeable controls");
    expect(prompt).toContain("`theta` — angle; number from 0 to 6.28; changes gradually.");
    expect(prompt).toContain("### Read-only values");
    expect(prompt).toContain("`note` — text.");
    expect(prompt).toContain('<lesson_narration>\n\n<chapter title="Projection">');
    expect(prompt).toContain("<spoken_narration>\nThe cosine becomes zero.");
    expect(prompt).toContain("This equation records the result.\n</spoken_narration>");
    expect(prompt).toContain("<demonstrated_settings>\n- angle (`theta`) → `1.57`\n</demonstrated_settings>");
    expect(prompt).toContain("<board_material>\n- Equation: \\(\\cos(\\pi/2)=0\\)\n</board_material>");
    expect(prompt).toContain("<learner_activities>\n- Try another angle.\n</learner_activities>");
    expect(prompt).toContain("</chapter>\n\n</lesson_narration>");
    expect(prompt).toContain("Return only the JSON object required by the response schema.");
    expect(prompt).not.toContain("Default:");
    expect(prompt).not.toContain("@cue");
    expect(prompt).not.toContain("Scene presets used by the script");
    expect(prompt).not.toContain("Output example");
    expect(prompt).not.toContain("### Projection");
    expect(prompt).not.toContain('"narration":"The cosine becomes zero."');
    expect(prompt).not.toContain('"ownership":"script"');
  });

  it("retains the exact old prompt for paired evaluation", () => {
    const prompt = formatAssistantSystemPrompt(context, "legacy");
    expect(prompt).toContain("LESSON CONTEXT:\n");
    expect(prompt).toContain('"narration":"The cosine becomes zero."');
    expect(prompt).toContain('"ownership":"script"');
  });
});
