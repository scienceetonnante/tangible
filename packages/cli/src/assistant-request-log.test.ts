import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAssistantProviderRequest } from "./assistant-request-log.js";

describe("local assistant request log", () => {
  it("writes the complete provider body as readable JSON", async () => {
    const lessonDir = await mkdtemp(join(tmpdir(), "narrable-request-log-"));
    const request = { model: "test/model", messages: [{ role: "system", content: "Complete prompt." }] };

    const path = await writeAssistantProviderRequest(lessonDir, request);

    expect(path).toBe(join(lessonDir, "build", "assistant-provider-request.json"));
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(request);
  });
});
