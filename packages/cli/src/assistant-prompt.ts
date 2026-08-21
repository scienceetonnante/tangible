// Human-readable prompt assembly from the validated assistant build artifact.

import type { AssistantContext, ParamSpec, ParamValue } from "@narrable/core";

export type AssistantPromptStyle = "legacy" | "structured";

export function formatAssistantSystemPrompt(context: AssistantContext, style: AssistantPromptStyle): string {
  return style === "legacy" ? legacyPrompt(context) : structuredPrompt(context);
}

function legacyPrompt(context: AssistantContext): string {
  return [
    "You are the narrator of an interactive lesson. Answer in the lesson language.",
    "Use only the supplied lesson content. Be concise, correct, and pedagogical.",
    "Return one to six written beats. Each beat may set allowed scene parameters using absolute values.",
    "Use an empty set object when no visual change helps. Never mention internal parameter names.",
    "The learner may manipulate the scene while reading, so the explanation must remain understandable if they do.",
    "LESSON CONTEXT:",
    JSON.stringify(context),
  ].join("\n");
}

function structuredPrompt(context: AssistantContext): string {
  return [
    "# Role and capabilities",
    "",
    `You are the teaching assistant for the interactive narrated lesson “${context.title}”.`,
    `Answer in the lesson language, whose language code is \`${context.language}\`. Use only the supplied lesson content.`,
    "Give a concise, correct, and pedagogically useful answer.",
    "",
    "You do not see a screenshot and you do not execute the scene. You receive a semantic description and the current scene state. You may request temporary changes to selected scene controls, but you do not observe the rendered result afterward.",
    "The learner can manipulate the scene while reading, so the explanation must remain understandable if the scene changes.",
    "",
    "# Lesson-specific guide",
    "",
    "<lesson_guide>",
    context.guide.trim(),
    "</lesson_guide>",
    "",
    "# Scene values and controls",
    "",
    "Every value below can be observed in the current scene state. Only values explicitly marked as changeable may appear in a beat’s `set` object.",
    "Internal names are used only in `set`; never mention them in `say`.",
    "",
    ...formatControls(context),
    ...formatNamedReferences(context),
    "# Lesson script",
    "",
    "Ordinary prose in the script is spoken to the learner. Instructions beginning with `@` are not spoken; they describe scene changes synchronized with nearby narration.",
    "",
    "- `@cue(name = value)` assigns an absolute value immediately.",
    "- `@cue(name -> value, over: 2s)` moves toward an absolute value gradually.",
    "- `@show`, `@hide`, `@camera`, and `@scene` change the visible scene.",
    "- `@chapter` begins a section, while `@pause` stops playback for interaction.",
    "- `@board`, `@highlight`, `@dim`, and `@clear` manage written board material.",
    "- `@bake` and `@track` refer to authored sequences that are resolved before playback.",
    "",
    "Named references listed above stand for their displayed absolute values. The script is:",
    "",
    "<lesson_script>",
    context.script.trim(),
    "</lesson_script>",
    "",
    "# How to answer",
    "",
    "Answer the learner’s question directly before adding supporting detail.",
    "Return one to six written beats. Use one beat when one visual state is enough, and use several beats only when the explanation benefits from a sequence of visual states.",
    "",
    "Each beat contains:",
    "",
    "- `say`: text in the lesson language that becomes part of the displayed answer;",
    "- `set`: temporary absolute values for changeable scene controls, or `{}` when no scene change helps;",
    "- `over`: the visual interpolation duration in seconds, from 0 to 2. It does not control reading or speaking time.",
    "",
    "Put a scene change in the same beat as the text that introduces that visual state. Omit unchanged controls. Do not change the scene merely to make an answer look active.",
    "Every `say` must remain understandable if the learner changes the scene. Never mention internal control names in `say`.",
    "The current-turn user message contains the learner’s question, the latest lesson position, the visible scene state, and any temporary values left by your preceding answer. Earlier user and assistant messages are the retained conversation.",
    "",
    "# Output example",
    "",
    "This example shows the structure of an answer that needs no visual change:",
    "",
    "```json",
    "{",
    '  "beats": [',
    "    {",
    '      "say": "Answer the learner directly in the lesson language.",',
    '      "set": {},',
    '      "over": 0',
    "    }",
    "  ]",
    "}",
    "```",
    "",
    "Return only the JSON object required by the response schema.",
  ].join("\n");
}

function formatControls(context: AssistantContext): string[] {
  const lines: string[] = [];
  for (const [name, spec] of Object.entries(context.schema)) {
    const label = spec.label ? `, labelled “${spec.label}”` : "";
    const permission = context.commandable.includes(name) ? "You may change it." : "You may observe it but not change it.";
    lines.push(`- \`${name}\`${label}: ${describeType(spec)} Default: \`${formatInline(spec.default)}\` ${permission} ${describeTransition(spec)}`);
  }
  lines.push("");
  return lines;
}

function describeType(spec: ParamSpec): string {
  switch (spec.type.kind) {
    case "scalar": return spec.type.range ? `a number from ${spec.type.range[0]} to ${spec.type.range[1]}.` : "a finite number.";
    case "boolean": return "true or false.";
    case "text": return "text.";
    case "enum": return `one of ${spec.type.values.map((value) => `\`${value}\``).join(", ")}.`;
    case "boardItem": return "one of `hidden`, `shown`, or `dimmed`.";
    case "vec2": return "an array of two numbers.";
    case "vec3": return "an array of three numbers.";
    case "quaternion": return "a four-number quaternion `[w, x, y, z]`.";
    case "orbit": return "a camera orbit with `target`, `distance`, `azimuth`, and `elevation`.";
  }
}

function describeTransition(spec: ParamSpec): string {
  if (spec.interpolate === "snap") return "It changes immediately.";
  if (spec.interpolate === "typewriter") return "Text changes appear progressively.";
  return "It can change gradually.";
}

function formatNamedReferences(context: AssistantContext): string[] {
  const sections: string[] = [];
  if (Object.keys(context.presets).length) sections.push(...referenceSection("Scene presets used by the script", context.presets));
  if (Object.keys(context.constants).length) sections.push(...referenceSection("Named values used by the script", context.constants));
  if (Object.keys(context.groups).length) sections.push(...referenceSection("Parameter groups used by the script", context.groups));
  if (sections.length) sections.push("These names explain the script. Responses must still use absolute values and exact changeable control names.", "");
  return sections;
}

function referenceSection(title: string, values: Record<string, unknown>): string[] {
  const lines = [`## ${title}`, ""];
  for (const [name, value] of Object.entries(values)) {
    lines.push(`- \`${name}\` = ${formatReference(value)}`);
  }
  lines.push("");
  return lines;
}

function formatReference(value: unknown): string {
  if (typeof value === "string" && value.includes("\n")) return `<reference>\n${value}\n</reference>`;
  return `\`${JSON.stringify(value)}\``;
}

function formatInline(value: ParamValue): string {
  return JSON.stringify(value);
}
