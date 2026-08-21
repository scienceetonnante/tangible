import { describe, expect, it } from "vitest";
import type { AssistantContext } from "@narrable/core";
import { formatAssistantSystemPrompt } from "./assistant-prompt.js";

const context: AssistantContext = {
  version: 1,
  lessonId: "circle",
  title: "A circle",
  guide: "The learner drags a point.",
  script: "@cue(theta -> HALF_PI, over: 1s) The cosine becomes zero.",
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

    expect(prompt).toContain("# Role and capabilities");
    expect(prompt).toContain("<lesson_guide>\nThe learner drags a point.\n</lesson_guide>");
    expect(prompt).toContain("`theta`, labelled “angle”: a number from 0 to 6.28.");
    expect(prompt).toContain("You may change it. It can change gradually.");
    expect(prompt).toContain("`note`: text.");
    expect(prompt).toContain("You may observe it but not change it. Text changes appear progressively.");
    expect(prompt).toContain("## Named values used by the script");
    expect(prompt).toContain("`HALF_PI` = `1.57`");
    expect(prompt).toContain("<lesson_script>\n@cue(theta -> HALF_PI, over: 1s)");
    expect(prompt).toContain('"set": {}');
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
