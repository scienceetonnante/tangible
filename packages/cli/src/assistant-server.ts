// Same-origin HTTP server for assistant-enabled lessons. It keeps provider keys
// server-side while serving the ordinary static bundle unchanged.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AssistantContext, AssistantRequest } from "@narrable/core";
import { ASSISTANT_MODEL, AssistantProviderError, answerQuestion, validateAssistantRequest } from "./assistant-service.js";
import { serveFromDir } from "./static-server.js";

export interface AssistantLimits {
  hourly: number;
  perClient: number;
  concurrent: number;
}

export interface AssistantServerOptions {
  siteDir: string;
  port?: number;
  host?: string;
  fake?: boolean;
  limits?: AssistantLimits;
  logger?: (entry: Record<string, unknown>) => void;
  now?: () => number;
  answer?: typeof answerQuestion;
}

export type AssistantApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

export function createAssistantApi(opts: AssistantServerOptions): AssistantApiHandler {
  const clients = new Map<string, number[]>();
  let globalRequests: number[] = [];
  let active = 0;
  const limits = opts.limits ?? limitsFromEnvironment();
  validateLimits(limits);
  const now = opts.now ?? Date.now;
  const answer = opts.answer ?? answerQuestion;
  const log = opts.logger ?? ((entry) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), ...entry })));
  return async (req, res) => {
    if ((req.url ?? "").split("?")[0] !== "/api/answer") return false;
    if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
    if (!isJson(req)) return json(res, 415, { error: "content type must be application/json" });

    const requestId = randomUUID().slice(0, 8);
    const started = Date.now();
    let request: AssistantRequest | undefined;
    let stage: "request" | "server" | "provider" = "request";
    try {
      request = await readJson(req) as AssistantRequest;
      stage = "server";
      const context = JSON.parse(await readFile(join(opts.siteDir, "assistant.json"), "utf8")) as AssistantContext;
      stage = "request";
      validateAssistantRequest(request, context);

      const time = now();
      const client = clientId(req);
      globalRequests = globalRequests.filter((entry) => time - entry < 60 * 60_000);
      const clientRequests = (clients.get(client) ?? []).filter((entry) => time - entry < 10 * 60_000);
      if (clientRequests.length >= limits.perClient) return limited(log, res, requestId, request, "client", 600);
      if (globalRequests.length >= limits.hourly) return limited(log, res, requestId, request, "global", 3600);
      if (active >= limits.concurrent) return limited(log, res, requestId, request, "concurrent", 5);

      for (const [id, entries] of clients) if (!entries.some((entry) => time - entry < 10 * 60_000)) clients.delete(id);
      clientRequests.push(time);
      clients.set(client, clientRequests);
      globalRequests.push(time);
      active++;

      log({
        event: "assistant.request",
        requestId,
        lessonId: request.lessonId,
        questionChars: request.question?.length,
        historyTurns: request.history?.length,
      });
      stage = "provider";
      let response;
      try {
        response = await answer(request, context, { fake: opts.fake });
      } finally {
        active--;
      }
      log({
        event: "assistant.success",
        requestId,
        lessonId: request.lessonId,
        model: opts.fake ? "fake" : ASSISTANT_MODEL,
        beats: response.beats.length,
        answerChars: response.answer.length,
        latencyMs: Date.now() - started,
      });
      return json(res, 200, response);
    } catch (error) {
      const status = stage === "request" ? 400 : stage === "provider" ? 502 : 500;
      const category = stage === "request" ? "invalid_request" : stage === "provider" ? "provider_failure" : "server_failure";
      log({
        event: "assistant.error",
        requestId,
        lessonId: request?.lessonId,
        model: opts.fake ? "fake" : ASSISTANT_MODEL,
        category,
        ...(error instanceof AssistantProviderError ? { providerStatus: error.status } : {}),
        latencyMs: Date.now() - started,
      });
      return json(res, status, { error: stage === "request" ? "invalid question request" : stage === "provider" ? "answer provider failed" : "internal server error" });
    }
  };
}

export function serveLesson(opts: AssistantServerOptions): Server {
  const api = createAssistantApi(opts);
  const server = createServer((req, res) => {
    void (async () => {
      if (await api(req, res)) return;
      await serveFromDir(opts.siteDir, req, res);
    })().catch(() => json(res, 500, { error: "internal server error" }));
  });
  const port = opts.port ?? 7860;
  const host = opts.host ?? "127.0.0.1";
  server.listen(port, host, () => console.error(`lesson server on http://${host}:${port}`));
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

function limitsFromEnvironment(): AssistantLimits {
  return {
    hourly: positiveInteger("ASSISTANT_HOURLY_LIMIT", 120),
    perClient: positiveInteger("ASSISTANT_CLIENT_10M_LIMIT", 8),
    concurrent: positiveInteger("ASSISTANT_MAX_CONCURRENT", 2),
  };
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function validateLimits(limits: AssistantLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`assistant limit ${name} must be a positive integer`);
  }
}

function clientId(req: IncomingMessage): string {
  const raw = req.headers["x-narrable-client-id"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && /^[a-zA-Z0-9_-]{16,64}$/.test(value)) return `client:${value}`;
  return `address:${req.socket.remoteAddress ?? "unknown"}`;
}

function isJson(req: IncomingMessage): boolean {
  const raw = req.headers["content-type"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.toLowerCase().startsWith("application/json") ?? false;
}

function limited(
  log: (entry: Record<string, unknown>) => void,
  res: ServerResponse,
  requestId: string,
  request: AssistantRequest,
  limit: "client" | "global" | "concurrent",
  retryAfter: number,
): true {
  log({ event: "assistant.limited", requestId, lessonId: request.lessonId, limit });
  return json(res, 429, { error: "too many questions; try again shortly" }, { "retry-after": retryAfter });
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string | number> = {}): true {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(text),
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(text);
  return true;
}
