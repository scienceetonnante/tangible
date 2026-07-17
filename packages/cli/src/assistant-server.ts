// Same-origin HTTP server for assistant-enabled lessons. It keeps provider keys
// server-side while serving the ordinary static bundle unchanged.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AssistantContext, AssistantRequest, TtsAdapter } from "@narrable/core";
import { ElevenLabsAdapter, FakeTtsAdapter, HuggingFaceVoiceAdapter } from "@narrable/tts";
import { answerQuestion } from "./assistant-service.js";
import { serveFromDir } from "./static-server.js";

export interface AssistantServerOptions {
  siteDir: string;
  port?: number;
  fake?: boolean;
  tts?: TtsAdapter;
  logger?: (entry: Record<string, unknown>) => void;
}

export type AssistantApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

export function createAssistantApi(opts: AssistantServerOptions): AssistantApiHandler {
  const requests = new Map<string, number[]>();
  const log = opts.logger ?? ((entry) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), ...entry })));
  return async (req, res) => {
    if ((req.url ?? "").split("?")[0] !== "/api/answer") return false;
    if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
    if (!allowRequest(requests, req.socket.remoteAddress ?? "unknown")) return json(res, 429, { error: "too many questions; try again shortly" });

    const requestId = randomUUID().slice(0, 8);
    const started = Date.now();
    let request: AssistantRequest | undefined;
    try {
      request = await readJson(req) as AssistantRequest;
      if (!/^[a-zA-Z0-9-]+$/.test(request.language)) throw new Error("invalid language");
      log({
        event: "assistant.request",
        requestId,
        lessonId: request.lessonId,
        language: request.language,
        questionChars: request.question?.length,
        historyTurns: request.history?.length,
      });
      const context = JSON.parse(await readFile(join(opts.siteDir, request.language, "assistant.json"), "utf8")) as AssistantContext;
      const tts = opts.tts ?? selectAssistantTts(context.voice, opts.fake ?? false);
      const answer = await answerQuestion(request, context, { tts, fake: opts.fake });
      log({
        event: "assistant.success",
        requestId,
        lessonId: request.lessonId,
        model: opts.fake ? "fake" : process.env.HF_MODEL,
        tts: tts.id,
        beats: answer.beats.length,
        answerChars: answer.answer.length,
        audioSeconds: answer.duration,
        latencyMs: Date.now() - started,
      });
      return json(res, 200, answer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log({
        event: "assistant.error",
        requestId,
        lessonId: request?.lessonId,
        language: request?.language,
        model: opts.fake ? "fake" : process.env.HF_MODEL,
        error: message,
        latencyMs: Date.now() - started,
      });
      return json(res, 400, { error: message });
    }
  };
}

function selectAssistantTts(voice: string, fake: boolean): TtsAdapter {
  if (fake) return new FakeTtsAdapter();
  if (voice.startsWith("hf-endpoint:")) return new HuggingFaceVoiceAdapter();
  if (voice.startsWith("elevenlabs:")) return new ElevenLabsAdapter();
  throw new Error(`unsupported assistant voice "${voice}"`);
}

export function serveLesson(opts: AssistantServerOptions): Server {
  const api = createAssistantApi(opts);
  const server = createServer((req, res) => {
    void (async () => {
      if (await api(req, res)) return;
      await serveFromDir(opts.siteDir, req, res);
    })().catch((error) => json(res, 500, { error: String(error) }));
  });
  const port = opts.port ?? 7860;
  server.listen(port, () => console.error(`lesson server on http://localhost:${port}`));
  return server;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 64 * 1024) throw new Error("question request exceeds 64 KiB");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function allowRequest(requests: Map<string, number[]>, address: string): boolean {
  const now = Date.now();
  const recent = (requests.get(address) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 12) return false;
  recent.push(now);
  requests.set(address, recent);
  return true;
}

function json(res: ServerResponse, status: number, body: unknown): true {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
  res.end(text);
  return true;
}
