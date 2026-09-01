// Same-origin HTTP server for assistant-enabled lessons. It keeps provider keys
// server-side while serving the ordinary static bundle unchanged.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { join } from "node:path";
import type { AssistantContext, AssistantLimits, AssistantRequest } from "@tangible/core";
import { AssistantProviderError, AssistantProviderTimeoutError, answerQuestion, validateAssistantRequest } from "./assistant-service.js";
import { serveFromDir } from "./static-server.js";

export interface AssistantServerOptions {
  siteDir: string;
  port?: number;
  host?: string;
  fake?: boolean;
  limits: AssistantLimits;
  logger?: (entry: Record<string, unknown>) => void;
  onProviderRequest?: (request: Record<string, unknown>) => Promise<void> | void;
  now?: () => number;
  answer?: typeof answerQuestion;
}

export type AssistantApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

export function createAssistantApi(opts: AssistantServerOptions): AssistantApiHandler {
  const browsers = new Map<string, number[]>();
  const ips = new Map<string, number[]>();
  let globalRequests: number[] = [];
  let active = 0;
  const limits = limitsFromEnvironment(opts.limits);
  validateLimits(limits);
  const ipSalt = randomBytes(16);
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
    let context: AssistantContext | undefined;
    let stage: "request" | "server" | "provider" = "request";
    try {
      request = await readJson(req, limits.request.bodyBytes) as AssistantRequest;
      stage = "server";
      context = {
        ...JSON.parse(await readFile(join(opts.siteDir, "assistant.json"), "utf8")) as AssistantContext,
        limits,
      };
      stage = "request";
      validateAssistantRequest(request, context);

      const time = now();
      const ip = hashedClientIp(req, ipSalt);
      const browser = browserId(req, ip);
      globalRequests = globalRequests.filter((entry) => time - entry < 24 * 60 * 60_000);
      const hourlyRequests = globalRequests.filter((entry) => time - entry < 60 * 60_000);
      const browserRequests = recentRequests(browsers, browser, time);
      const ipRequests = ip ? recentRequests(ips, ip, time) : [];
      if (browserRequests.length >= limits.rate.browserRequestsPerTenMinutes) return limited(log, res, requestId, request, "browser", 600);
      if (ip && ipRequests.length >= limits.rate.ipRequestsPerTenMinutes) return limited(log, res, requestId, request, "ip", 600);
      if (hourlyRequests.length >= limits.rate.globalRequestsPerHour) return limited(log, res, requestId, request, "hourly", 3600);
      if (globalRequests.length >= limits.rate.globalRequestsPerDay) return limited(log, res, requestId, request, "daily", 86_400);
      if (active >= limits.rate.concurrentProviderCalls) return limited(log, res, requestId, request, "concurrent", 5);

      removeInactive(browsers, time);
      removeInactive(ips, time);
      browserRequests.push(time);
      browsers.set(browser, browserRequests);
      if (ip) {
        ipRequests.push(time);
        ips.set(ip, ipRequests);
      }
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
        response = await answer(request, context, { fake: opts.fake, onProviderRequest: opts.onProviderRequest });
      } finally {
        active--;
      }
      log({
        event: "assistant.success",
        requestId,
        lessonId: request.lessonId,
        model: opts.fake ? "fake" : context.model,
        beats: response.beats.length,
        answerChars: response.answer.length,
        latencyMs: Date.now() - started,
      });
      return json(res, 200, response);
    } catch (error) {
      const timedOut = error instanceof AssistantProviderTimeoutError;
      const status = stage === "request" ? 400 : timedOut ? 504 : stage === "provider" ? 502 : 500;
      const category = stage === "request" ? "invalid_request" : timedOut ? "provider_timeout" : stage === "provider" ? "provider_failure" : "server_failure";
      log({
        event: "assistant.error",
        requestId,
        lessonId: request?.lessonId,
        model: opts.fake ? "fake" : context?.model,
        category,
        ...(error instanceof AssistantProviderError ? { providerStatus: error.status } : {}),
        latencyMs: Date.now() - started,
      });
      return json(res, status, { error: stage === "request" ? "invalid question request" : timedOut ? "answer provider timed out" : stage === "provider" ? "answer provider failed" : "internal server error" });
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

async function readJson(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBytes) throw new Error(`question request exceeds ${maxBytes} bytes`);
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function limitsFromEnvironment(configured: AssistantLimits): AssistantLimits {
  return {
    ...configured,
    rate: {
      browserRequestsPerTenMinutes: positiveInteger("ASSISTANT_CLIENT_10M_LIMIT", configured.rate.browserRequestsPerTenMinutes),
      ipRequestsPerTenMinutes: positiveInteger("ASSISTANT_IP_10M_LIMIT", configured.rate.ipRequestsPerTenMinutes),
      globalRequestsPerHour: positiveInteger("ASSISTANT_HOURLY_LIMIT", configured.rate.globalRequestsPerHour),
      globalRequestsPerDay: positiveInteger("ASSISTANT_DAILY_LIMIT", configured.rate.globalRequestsPerDay),
      concurrentProviderCalls: positiveInteger("ASSISTANT_MAX_CONCURRENT", configured.rate.concurrentProviderCalls),
    },
    providerTimeoutSeconds: positiveNumber("ASSISTANT_PROVIDER_TIMEOUT_SECONDS", configured.providerTimeoutSeconds),
  };
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function positiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

function validateLimits(limits: AssistantLimits): void {
  const { transitionSeconds, ...responseIntegers } = limits.response;
  const integers = { ...limits.request, ...responseIntegers, ...limits.rate };
  for (const [name, value] of Object.entries(integers)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`assistant limit ${name} must be a positive integer`);
  }
  if (!Number.isFinite(transitionSeconds) || transitionSeconds < 0) {
    throw new Error("assistant limit transitionSeconds must be non-negative");
  }
  if (!Number.isFinite(limits.providerTimeoutSeconds) || limits.providerTimeoutSeconds <= 0) {
    throw new Error("assistant limit providerTimeoutSeconds must be positive");
  }
}

function browserId(req: IncomingMessage, ip: string | undefined): string {
  const raw = req.headers["x-tangible-client-id"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && /^[a-zA-Z0-9_-]{16,64}$/.test(value)) return `browser:${value}`;
  return `browser-ip:${ip ?? "unknown"}`;
}

function hashedClientIp(req: IncomingMessage, salt: Buffer): string | undefined {
  const forwarded = header(req, "x-forwarded-for")?.split(",").at(-1)?.trim();
  const ip = normalizeIp(forwarded) ?? normalizeIp(req.socket.remoteAddress);
  if (!ip) return undefined;
  return createHash("sha256").update(salt).update(ip).digest("hex");
}

function normalizeIp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.startsWith("::ffff:") ? value.slice(7) : value;
  return isIP(normalized) ? normalized : undefined;
}

function header(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

function recentRequests(entries: Map<string, number[]>, id: string, time: number): number[] {
  return (entries.get(id) ?? []).filter((entry) => time - entry < 10 * 60_000);
}

function removeInactive(entries: Map<string, number[]>, time: number): void {
  for (const [id, requests] of entries) if (!requests.some((entry) => time - entry < 10 * 60_000)) entries.delete(id);
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
  limit: "browser" | "ip" | "hourly" | "daily" | "concurrent",
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
