// Human-readable prompt assembly from the validated assistant build artifact.

import type { AssistantContext, ParamSpec } from "@narrable/core";
import { parseScript, type Directive } from "@narrable/compiler";

export type AssistantPromptStyle = "legacy" | "structured";

export function formatAssistantSystemPrompt(context: AssistantContext, style: AssistantPromptStyle): string {
  return style === "legacy" ? legacyPrompt(context) : structuredPrompt(context);
}

function legacyPrompt(context: AssistantContext): string {
  return [
    "You are the narrator of an interactive lesson. Answer in English.",
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
    `# Teaching assistant for “${context.title}”`,
    "",
    "## 1. Task",
    "",
    "Answer the learner’s question directly in concise, correct English. Use only the supplied lesson material.",
    "You receive a semantic scene state, not a screenshot, and you do not execute the scene. You may request temporary changes to selected controls, but you do not observe the result afterward.",
    "Use the current chapter, the narration just heard, and the conversation history to interpret short or ambiguous questions. Avoid introducing later lesson material unless it is needed to answer the question.",
    "",
    "## 2. Lesson-specific guidance",
    "",
    normalizeGuideHeadings(context.guide),
    "",
    "## 3. Lesson narration",
    "",
    "The content inside `<lesson_narration>` is organized by chapter. Each `<spoken_narration>` block contains words spoken in the lesson. Demonstrated settings, board material, and silent learner activities are supporting context, not narration.",
    "",
    ...formatLessonOutline(context),
    "## 4. Scene controls",
    "",
    "The current user message supplies the actual visible values. Use the exact internal keys below only in a beat’s `set` object, never in its `say` text.",
    "",
    ...formatControls(context),
    "## 5. Response",
    "",
    "Return one to six written beats. Use one beat when one visual state is enough, and use several beats only when the explanation benefits from a sequence of visual states.",
    "",
    "Each beat contains:",
    "",
    "- `say`: English text that becomes part of the displayed answer;",
    "- `set`: temporary absolute values for changeable scene controls, or `{}` when no scene change helps;",
    "- `over`: the visual interpolation duration in seconds, from 0 to 2. It does not control reading or speaking time.",
    "",
    "Put a scene change in the same beat as the text that introduces that visual state. Omit unchanged controls. Do not change the scene merely to make an answer look active.",
    "The learner may manipulate the scene while reading, so every `say` must remain understandable if the visible state changes.",
    "Return only the JSON object required by the response schema.",
  ].join("\n");
}

function formatControls(context: AssistantContext): string[] {
  const lines: string[] = [];
  const changeable = Object.entries(context.schema).filter(([name]) => context.commandable.includes(name));
  const readOnly = Object.entries(context.schema).filter(([name]) => !context.commandable.includes(name));
  if (changeable.length) {
    lines.push("### Changeable controls", "");
    for (const [name, spec] of changeable) lines.push(formatControl(name, spec, true));
    lines.push("");
  }
  if (readOnly.length) {
    lines.push("### Read-only values", "");
    for (const [name, spec] of readOnly) lines.push(formatControl(name, spec, false));
    lines.push("");
  }
  return lines;
}

function formatControl(name: string, spec: ParamSpec, changeable: boolean): string {
  const label = spec.label ? `${spec.label}; ` : "";
  const transition = changeable ? `; ${describeTransition(spec)}` : "";
  return `- \`${name}\` — ${label}${describeType(spec)}${transition}.`;
}

function describeType(spec: ParamSpec): string {
  switch (spec.type.kind) {
    case "scalar": return spec.type.range ? `number from ${spec.type.range[0]} to ${spec.type.range[1]}` : "finite number";
    case "boolean": return "true or false";
    case "text": return "text";
    case "enum": return `one of ${spec.type.values.map((value) => `\`${value}\``).join(", ")}`;
    case "boardItem": return "one of `hidden`, `shown`, or `dimmed`";
    case "vec2": return "array of two numbers";
    case "vec3": return "array of three numbers";
    case "quaternion": return "four-number quaternion `[w, x, y, z]`";
    case "orbit": return "camera orbit with `target`, `distance`, `azimuth`, and `elevation`";
  }
}

function describeTransition(spec: ParamSpec): string {
  if (spec.interpolate === "snap") return "changes immediately";
  if (spec.interpolate === "typewriter") return "text appears progressively";
  return "changes gradually";
}

function normalizeGuideHeadings(guide: string): string {
  let fence: string | undefined;
  return guide.trim().split("\n").map((line) => {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1];
    if (marker) {
      fence = fence === marker ? undefined : fence ?? marker;
      return line;
    }
    if (fence) return line;
    const heading = /^(#{1,6})(\s+.*)$/.exec(line);
    if (!heading) return line;
    return `${"#".repeat(Math.min(6, heading[1]!.length + 2))}${heading[2]}`;
  }).join("\n");
}

function formatLessonOutline(context: AssistantContext): string[] {
  const parsed = parseScript(context.script);
  const chapters = parsed.directives.flatMap((directive, index) => directive.kind === "chapter" ? [{ directive, index }] : []);
  const sections: { title: string; start: number; end: number; directives: Directive[] }[] = [];

  if (!chapters.length) {
    sections.push({ title: "Lesson", start: 0, end: parsed.narration.length, directives: parsed.directives });
  } else {
    const first = chapters[0]!;
    if (parsed.narration.slice(0, first.directive.anchorOffset).trim() || first.index > 0) {
      sections.push({
        title: "Introduction",
        start: 0,
        end: first.directive.anchorOffset,
        directives: parsed.directives.slice(0, first.index),
      });
    }
    for (const [index, chapter] of chapters.entries()) {
      const next = chapters[index + 1];
      sections.push({
        title: chapter.directive.title,
        start: chapter.directive.anchorOffset,
        end: next?.directive.anchorOffset ?? parsed.narration.length,
        directives: parsed.directives.slice(chapter.index + 1, next?.index),
      });
    }
  }

  const lines: string[] = ["<lesson_narration>", ""];
  for (const section of sections) {
    const narration = parsed.narration.slice(section.start, section.end).trim();
    const settings = section.directives.flatMap((directive) => directive.kind === "cue" ? formatCue(directive, context) : []);
    const board = section.directives.flatMap((directive) => directive.kind === "board" ? [formatBoardItem(directive)] : []);
    const silentActivities = section.directives.flatMap((directive) => directive.kind === "pause" && !directive.speak ? [directive.prompt] : []);
    if (!narration && !settings.length && !board.length && !silentActivities.length) continue;

    lines.push(`<chapter title="${escapeXmlAttribute(section.title)}">`, "");
    if (narration) lines.push("<spoken_narration>", narration, "</spoken_narration>", "");
    if (settings.length) lines.push("<demonstrated_settings>", ...settings, "</demonstrated_settings>", "");
    if (board.length) lines.push("<board_material>", ...board, "</board_material>", "");
    if (silentActivities.length) {
      lines.push("<learner_activities>", ...silentActivities.map((prompt) => `- ${prompt}`), "</learner_activities>", "");
    }
    lines.push("</chapter>", "");
  }
  lines.push("</lesson_narration>", "");
  return lines;
}

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatCue(directive: Extract<Directive, { kind: "cue" }>, context: AssistantContext): string[] {
  const assignments = directive.assignments.flatMap((assignment) => {
    const spec = context.schema[assignment.param];
    const value = displayCueValue(assignment.value, spec, context);
    if (!spec || value === undefined) return [];
    const label = spec.label ?? assignment.param;
    return [`${label} (\`${assignment.param}\`) → \`${value}\``];
  });
  return assignments.length ? [`- ${assignments.join("; ")}`] : [];
}

function displayCueValue(raw: string, spec: ParamSpec | undefined, context: AssistantContext): string | undefined {
  if (!spec) return undefined;
  if (spec.type.kind === "enum" && spec.type.values.includes(raw)) return JSON.stringify(raw);
  if (/^(?:true|false|-?(?:\d+(?:\.\d+)?|\.\d+))$/.test(raw)) return raw;
  if (Object.hasOwn(context.constants, raw)) {
    const value = JSON.stringify(context.constants[raw]);
    if (value.length <= 100) return value;
  }
  return undefined;
}

function formatBoardItem(directive: Extract<Directive, { kind: "board" }>): string {
  return directive.itemKind === "katex"
    ? `- Equation: \\(${directive.source}\\)`
    : `- Note: ${JSON.stringify(directive.source)}`;
}
