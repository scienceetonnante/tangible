import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssistantContext, AssistantRequest } from "@narrable/core";
import { createAssistantApi } from "./assistant-server.js";

describe("assistant server", () => {
  it("serves a same-origin fake answer endpoint", async () => {
    const siteDir = await mkdtemp(join(tmpdir(), "narrable-site-"));
    await mkdir(join(siteDir, "en"));
    await writeFile(join(siteDir, "index.html"), "<h1>Lesson</h1>");
    const context: AssistantContext = {
      version: 1, lessonId: "circle", language: "en", title: "Circle", guide: "Circle.", script: "Circle.", narration: "Circle.",
      schema: { theta: { type: { kind: "scalar", range: [0, 6.28] }, default: 0, interpolate: "lerp", ownership: "script" } },
      presets: {}, constants: {}, groups: {}, commandable: ["theta"],
    };
    await writeFile(join(siteDir, "en/assistant.json"), JSON.stringify(context));
    const request: AssistantRequest = { lessonId: "circle", language: "en", question: "Why?", t: 0, state: { theta: 0 }, history: [] };
    const req = Readable.from([JSON.stringify(request)]) as unknown as IncomingMessage;
    Object.assign(req, { url: "/api/answer", method: "POST", socket: { remoteAddress: "test" } });
    let status = 0;
    let body = "";
    const res = {
      writeHead(code: number) { status = code; },
      end(text: string) { body = text; },
    } as unknown as ServerResponse;
    const logs: Record<string, unknown>[] = [];

    expect(await createAssistantApi({ siteDir, fake: true, logger: (entry) => logs.push(entry) })(req, res)).toBe(true);
    expect(status).toBe(200);
    expect((JSON.parse(body) as { answer: string }).answer).toContain("quarter turn");
    expect(logs.map((entry) => entry.event)).toEqual(["assistant.request", "assistant.success"]);
    expect(logs[1]).toMatchObject({ lessonId: "circle", model: "fake", beats: 2 });
    expect(logs[1]!.requestId).toBe(logs[0]!.requestId);
  });
});
