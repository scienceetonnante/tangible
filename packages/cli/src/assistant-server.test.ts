import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_ASSISTANT_LIMITS, type AssistantContext, type AssistantLimits, type AssistantRequest, type AssistantResponse } from "@tangible/core";
import { AssistantProviderError, AssistantProviderTimeoutError } from "./assistant-service.js";
import { createAssistantApi, type AssistantApiHandler } from "./assistant-server.js";

const CONTEXT: AssistantContext = {
  version: 1,
  lessonId: "circle",
  title: "Circle",
  provider: "huggingface",
  model: "test/model:provider",
  guide: "Circle.",
  script: "Circle.",
  narration: "Circle.",
  schema: { theta: { type: { kind: "scalar", range: [0, 6.28] }, default: 0, interpolate: "lerp", ownership: "script" } },
  presets: {},
  constants: {},
  groups: {},
  commandable: ["theta"],
  limits: DEFAULT_ASSISTANT_LIMITS,
};

const REQUEST: AssistantRequest = {
  lessonId: "circle",
  question: "Why?",
  t: 0,
  state: { theta: 0 },
  position: { chapter: "Intro", narrationJustHeard: "Circle.", pausePrompt: null },
  temporaryAssistantState: {},
  history: [],
};

const ANSWER: AssistantResponse = { answer: "At zero.", beats: [{ say: "At zero.", set: { theta: 0 }, over: 0 }] };
const DEFAULT_LIMITS: AssistantLimits = DEFAULT_ASSISTANT_LIMITS;
const quiet = () => {};

async function siteDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tangible-site-"));
  await writeFile(join(dir, "index.html"), "<h1>Lesson</h1>");
  await writeFile(join(dir, "assistant.json"), JSON.stringify(CONTEXT));
  return dir;
}

async function call(
  api: AssistantApiHandler,
  request: unknown = REQUEST,
  options: { client?: string; contentType?: string; method?: string; address?: string; forwardedFor?: string } = {},
) {
  const req = Readable.from([JSON.stringify(request)]) as unknown as IncomingMessage;
  Object.assign(req, {
    url: "/api/answer",
    method: options.method ?? "POST",
    headers: {
      "content-type": options.contentType ?? "application/json",
      ...(options.client ? { "x-tangible-client-id": options.client } : {}),
      ...(options.forwardedFor ? { "x-forwarded-for": options.forwardedFor } : {}),
    },
    socket: { remoteAddress: options.address ?? "test" },
  });
  let status = 0;
  let body = "";
  let headers: Record<string, string | number> = {};
  const res = {
    writeHead(code: number, sent: Record<string, string | number>) { status = code; headers = sent; },
    end(text = "") { body = text; },
  } as unknown as ServerResponse;

  expect(await api(req, res)).toBe(true);
  return { status, body: body ? JSON.parse(body) as Record<string, unknown> : {}, headers };
}

function limits(rate: Partial<AssistantLimits["rate"]>): AssistantLimits {
  return { ...DEFAULT_LIMITS, rate: { ...DEFAULT_LIMITS.rate, ...rate } };
}

describe("assistant server", () => {
  it("serves a same-origin fake answer without logging prompt content", async () => {
    const logs: Record<string, unknown>[] = [];
    const api = createAssistantApi({ siteDir: await siteDir(), fake: true, limits: DEFAULT_LIMITS, logger: (entry) => logs.push(entry) });
    const response = await call(api, REQUEST, { client: "client_0000000001" });

    expect(response.status).toBe(200);
    expect(response.body.answer).toContain("quarter turn");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(logs.map((entry) => entry.event)).toEqual(["assistant.request", "assistant.success"]);
    expect(logs[1]).toMatchObject({ lessonId: "circle", model: "fake", beats: 2 });
    expect(JSON.stringify(logs)).not.toContain("Why?");
  });

  it("enforces per-browser and global hourly rolling limits", async () => {
    const dir = await siteDir();
    const answer = vi.fn(async () => ANSWER);
    const perClient = createAssistantApi({
      siteDir: dir,
      answer,
      limits: limits({ browserRequestsPerTenMinutes: 2, globalRequestsPerHour: 10 }),
      logger: quiet,
    });

    expect((await call(perClient, REQUEST, { client: "client_0000000001" })).status).toBe(200);
    expect((await call(perClient, REQUEST, { client: "client_0000000001" })).status).toBe(200);
    const clientLimited = await call(perClient, REQUEST, { client: "client_0000000001" });
    expect(clientLimited.status).toBe(429);
    expect(clientLimited.headers["retry-after"]).toBe(600);
    expect((await call(perClient, REQUEST, { client: "client_0000000002" })).status).toBe(200);

    const global = createAssistantApi({
      siteDir: dir,
      answer,
      limits: limits({ browserRequestsPerTenMinutes: 2, globalRequestsPerHour: 2 }),
      logger: quiet,
    });
    expect((await call(global, REQUEST, { client: "client_0000000001" })).status).toBe(200);
    expect((await call(global, REQUEST, { client: "client_0000000002" })).status).toBe(200);
    expect((await call(global, REQUEST, { client: "client_0000000003" })).status).toBe(429);
  });

  it("limits rotating browser identifiers from one forwarded IP", async () => {
    const api = createAssistantApi({
      siteDir: await siteDir(),
      answer: vi.fn(async () => ANSWER),
      limits: limits({ browserRequestsPerTenMinutes: 10, ipRequestsPerTenMinutes: 2 }),
      logger: quiet,
    });

    expect((await call(api, REQUEST, { client: "client_0000000001", forwardedFor: "198.51.100.77, 203.0.113.1" })).status).toBe(200);
    expect((await call(api, REQUEST, { client: "client_0000000002", forwardedFor: "203.0.113.1" })).status).toBe(200);
    expect((await call(api, REQUEST, { client: "client_0000000003", forwardedFor: "203.0.113.1" })).status).toBe(429);
    expect((await call(api, REQUEST, { client: "client_0000000004", forwardedFor: "203.0.113.2" })).status).toBe(200);
  });

  it("enforces a rolling daily global limit", async () => {
    let time = 0;
    const api = createAssistantApi({
      siteDir: await siteDir(),
      answer: vi.fn(async () => ANSWER),
      limits: limits({ browserRequestsPerTenMinutes: 10, globalRequestsPerHour: 10, globalRequestsPerDay: 2 }),
      logger: quiet,
      now: () => time,
    });

    expect((await call(api, REQUEST, { client: "client_0000000001" })).status).toBe(200);
    time = 2 * 60 * 60_000;
    expect((await call(api, REQUEST, { client: "client_0000000002" })).status).toBe(200);
    time = 4 * 60 * 60_000;
    const limited = await call(api, REQUEST, { client: "client_0000000003" });
    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBe(86_400);
    time = 24 * 60 * 60_000 + 1;
    expect((await call(api, REQUEST, { client: "client_0000000004" })).status).toBe(200);
  });

  it("limits concurrent provider calls and releases the slot after failure", async () => {
    let release!: (value: AssistantResponse) => void;
    const pending = new Promise<AssistantResponse>((resolve) => { release = resolve; });
    const answer = vi.fn(() => pending);
    const api = createAssistantApi({ siteDir: await siteDir(), answer, limits: limits({ concurrentProviderCalls: 1 }), logger: quiet });

    const first = call(api, REQUEST, { client: "client_0000000001" });
    await vi.waitFor(() => expect(answer).toHaveBeenCalledTimes(1));
    expect((await call(api, REQUEST, { client: "client_0000000002" })).status).toBe(429);
    release(ANSWER);
    expect((await first).status).toBe(200);

    const failing = createAssistantApi({
      siteDir: await siteDir(),
      answer: vi.fn(async () => { throw new AssistantProviderError(503); }),
      limits: limits({ concurrentProviderCalls: 1 }),
      logger: quiet,
    });
    expect((await call(failing, REQUEST, { client: "client_0000000001" })).status).toBe(502);
    expect((await call(failing, REQUEST, { client: "client_0000000002" })).status).toBe(502);
  });

  it("does not spend provider budget on invalid requests", async () => {
    const answer = vi.fn(async () => ANSWER);
    const api = createAssistantApi({
      siteDir: await siteDir(),
      answer,
      limits: limits({ browserRequestsPerTenMinutes: 1, globalRequestsPerHour: 1, concurrentProviderCalls: 1 }),
      logger: quiet,
    });

    expect((await call(api, { ...REQUEST, lessonId: "wrong" }, { client: "client_0000000001" })).status).toBe(400);
    expect((await call(api, REQUEST, { client: "client_0000000001" })).status).toBe(200);
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("requires JSON and sanitizes provider failures", async () => {
    const logs: Record<string, unknown>[] = [];
    const api = createAssistantApi({
      siteDir: await siteDir(),
      answer: vi.fn(async () => { throw new AssistantProviderError(401); }),
      limits: DEFAULT_LIMITS,
      logger: (entry) => logs.push(entry),
    });

    expect((await call(api, REQUEST, { contentType: "text/plain" })).status).toBe(415);
    const response = await call(api, REQUEST, { client: "client_0000000001" });
    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: "answer provider failed" });
    expect(logs.at(-1)).toMatchObject({ event: "assistant.error", category: "provider_failure", providerStatus: 401 });
    expect(JSON.stringify(logs)).not.toContain("assistant provider returned");
  });

  it("reports provider timeouts without exposing internal errors", async () => {
    const logs: Record<string, unknown>[] = [];
    const api = createAssistantApi({
      siteDir: await siteDir(),
      answer: vi.fn(async () => { throw new AssistantProviderTimeoutError(); }),
      limits: DEFAULT_LIMITS,
      logger: (entry) => logs.push(entry),
    });

    const response = await call(api, REQUEST, { client: "client_0000000001" });
    expect(response.status).toBe(504);
    expect(response.body).toEqual({ error: "answer provider timed out" });
    expect(logs.at(-1)).toMatchObject({ event: "assistant.error", category: "provider_timeout" });
  });

  it("rejects invalid configured limits at startup", () => {
    expect(() => createAssistantApi({
      siteDir: "/unused",
      limits: limits({ globalRequestsPerHour: 0 }),
    })).toThrow("positive integer");
  });
});
