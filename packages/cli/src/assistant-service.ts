// Provider orchestration for lesson questions: Hugging Face produces a small,
// declarative written answer plan.

import { validateValue, type AnswerBeat, type AssistantContext, type AssistantRequest, type AssistantResponse, type ParamType, type ParamValue } from "@narrable/core";

export const ASSISTANT_MODEL = "google/gemma-4-31B-it:cerebras";

export class AssistantProviderError extends Error {
  constructor(readonly status: number) {
    super(`assistant provider returned HTTP ${status}`);
    this.name = "AssistantProviderError";
  }
}

export interface AssistantProviders {
  fetchImpl?: typeof fetch;
  hfToken?: string;
  fake?: boolean;
  promptStyle?: AssistantPromptStyle;
}

export type AssistantPromptStyle = "legacy" | "structured";

export async function answerQuestion(
  request: AssistantRequest,
  context: AssistantContext,
  providers: AssistantProviders,
): Promise<AssistantResponse> {
  validateAssistantRequest(request, context);
  const beats = providers.fake ? fakeAnswer(context) : await huggingFaceAnswer(request, context, providers);
  validateAnswer(beats, context);

  let answer = "";
  for (const beat of beats) {
    if (answer) answer += " ";
    answer += beat.say;
  }
  return { answer, beats };
}

async function huggingFaceAnswer(
  request: AssistantRequest,
  context: AssistantContext,
  providers: AssistantProviders,
): Promise<AnswerBeat[]> {
  const token = providers.hfToken ?? process.env.HF_TOKEN ?? "";
  if (!token) throw new Error("HF_TOKEN is not set");

  const providerRequest = buildAssistantProviderRequest(request, context, providers.promptStyle ?? "structured");

  const response = await (providers.fetchImpl ?? fetch)("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(providerRequest),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantProviderError(response.status);
  }
  const responseBody = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = responseBody.choices?.[0]?.message?.content;
  if (!content) throw new Error("Hugging Face returned no answer");
  return (JSON.parse(content) as { beats: AnswerBeat[] }).beats;
}

/** Construct the complete provider body without making a network request. */
export function buildAssistantProviderRequest(
  request: AssistantRequest,
  context: AssistantContext,
  promptStyle: AssistantPromptStyle = "structured",
): Record<string, unknown> {
  validateAssistantRequest(request, context);

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt(context, promptStyle) },
  ];
  for (const turn of request.history.slice(-8)) {
    messages.push({ role: "user", content: turn.question });
    messages.push({ role: "assistant", content: JSON.stringify({ beats: turn.beats }) });
  }
  messages.push({
    role: "user",
    content: JSON.stringify({ question: request.question, lessonTime: request.t, visibleState: visibleState(request, context) }),
  });

  return {
    model: ASSISTANT_MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 1200,
    response_format: {
      type: "json_schema",
      json_schema: { name: "lesson_answer", strict: true, schema: answerJsonSchema(context) },
    },
  };
}

function systemPrompt(context: AssistantContext, _style: AssistantPromptStyle): string {
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

export function validateAnswer(beats: unknown, context: AssistantContext): asserts beats is AnswerBeat[] {
  if (!Array.isArray(beats) || beats.length < 1 || beats.length > 6) throw new Error("answer must contain one to six beats");
  let chars = 0;
  for (const [i, raw] of beats.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`beat ${i + 1} must be an object`);
    const beat = raw as Record<string, unknown>;
    if (typeof beat.say !== "string" || !beat.say.trim()) throw new Error(`beat ${i + 1}.say must be non-empty text`);
    if (beat.say.length > 600) throw new Error(`beat ${i + 1}.say exceeds 600 characters`);
    chars += beat.say.length;
    if (chars > 2000) throw new Error("answer exceeds 2000 characters");
    if (!beat.set || typeof beat.set !== "object" || Array.isArray(beat.set)) throw new Error(`beat ${i + 1}.set must be an object`);
    if (typeof beat.over !== "number" || beat.over < 0 || beat.over > 2) throw new Error(`beat ${i + 1}.over must be between 0 and 2 seconds`);
    for (const [param, value] of Object.entries(beat.set as Record<string, ParamValue>)) {
      if (!context.commandable.includes(param)) throw new Error(`assistant cannot command parameter "${param}"`);
      const spec = context.schema[param]!;
      const error = validateValue(spec.type, value);
      if (error) throw new Error(`${param}: ${error}`);
      if (spec.type.kind === "scalar" && spec.type.range && typeof value === "number") {
        if (value < spec.type.range[0] || value > spec.type.range[1]) throw new Error(`${param}: ${value} is outside [${spec.type.range.join(", ")}]`);
      }
    }
  }
}

export function validateAssistantRequest(request: AssistantRequest, context: AssistantContext): void {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("question request must be an object");
  if (request.lessonId !== context.lessonId || request.language !== context.language) throw new Error("question does not match the lesson context");
  if (typeof request.question !== "string" || !request.question.trim() || request.question.length > 1000) {
    throw new Error("question must contain 1 to 1000 characters");
  }
  if (!Number.isFinite(request.t)) throw new Error("lesson time must be finite");
  if (!request.state || typeof request.state !== "object" || Array.isArray(request.state)) throw new Error("scene state must be an object");
  visibleState(request, context);
  if (!Array.isArray(request.history) || request.history.length > 8) throw new Error("conversation history is limited to eight turns");
  for (const [index, turn] of request.history.entries()) {
    if (!turn || typeof turn !== "object" || Array.isArray(turn)) throw new Error(`history turn ${index + 1} must be an object`);
    if (typeof turn.question !== "string" || !turn.question.trim() || turn.question.length > 1000) {
      throw new Error(`history turn ${index + 1} has an invalid question`);
    }
    if (typeof turn.answer !== "string" || turn.answer.length > 2000) throw new Error(`history turn ${index + 1} has an invalid answer`);
    validateAnswer(turn.beats, context);
  }
}

function visibleState(request: AssistantRequest, context: AssistantContext): Record<string, ParamValue> {
  const state: Record<string, ParamValue> = {};
  for (const [param, spec] of Object.entries(context.schema)) {
    const value = request.state[param];
    if (value === undefined) continue;
    const error = validateValue(spec.type, value);
    if (error) throw new Error(`${param}: ${error}`);
    if (spec.type.kind === "scalar" && spec.type.range && typeof value === "number") {
      if (value < spec.type.range[0] || value > spec.type.range[1]) throw new Error(`${param}: ${value} is outside [${spec.type.range.join(", ")}]`);
    }
    state[param] = value;
  }
  return state;
}

function answerJsonSchema(context: AssistantContext): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const param of context.commandable) properties[param] = valueJsonSchema(context.schema[param]!.type);
  return {
    type: "object",
    additionalProperties: false,
    required: ["beats"],
    properties: {
      beats: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["say", "set", "over"],
          properties: {
            say: { type: "string" },
            set: { type: "object", additionalProperties: false, properties },
            over: { type: "number", minimum: 0, maximum: 2 },
          },
        },
      },
    },
  };
}

function valueJsonSchema(type: ParamType): Record<string, unknown> {
  switch (type.kind) {
    case "scalar": return { type: "number", ...(type.range ? { minimum: type.range[0], maximum: type.range[1] } : {}) };
    case "boolean": return { type: "boolean" };
    case "text": return { type: "string" };
    case "enum": return { type: "string", enum: type.values };
    case "boardItem": return { type: "string", enum: ["hidden", "shown", "dimmed"] };
    case "vec2": return numberArray(2);
    case "vec3": return numberArray(3);
    case "quaternion": return numberArray(4);
    case "orbit":
      return {
        type: "object",
        additionalProperties: false,
        required: ["target", "distance", "azimuth", "elevation"],
        properties: { target: numberArray(3), distance: { type: "number" }, azimuth: { type: "number" }, elevation: { type: "number" } },
      };
  }
}

function numberArray(_length: number): Record<string, unknown> {
  return { type: "array", items: { type: "number" } };
}

function fakeAnswer(context: AssistantContext): AnswerBeat[] {
  if (context.commandable.includes("theta")) {
    const set: Record<string, ParamValue> = { theta: Math.PI / 2 };
    for (const key of ["show.thetaLabel", "show.projection", "show.cosLabel"]) if (context.commandable.includes(key)) set[key] = true;
    const french = context.language === "fr";
    return [
      { say: french ? "Regardons un quart de tour." : "Let’s look at a quarter turn.", set, over: 0.4 },
      { say: french ? "La coordonnée horizontale du point, et donc son cosinus, vaut zéro." : "The point’s horizontal coordinate, and therefore its cosine, is zero.", set: {}, over: 0 },
    ];
  }
  return [{ say: context.language === "fr" ? "Regardons cette situation dans la leçon." : "Let’s look at this situation in the lesson.", set: {}, over: 0 }];
}
