import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAssistantPromptLog } from "./assistant-prompt-log.js";

describe("local assistant prompt log", () => {
  it("writes the system prompt and current user message as plain text", async () => {
    const lessonDir = await mkdtemp(join(tmpdir(), "tangible-prompt-log-"));
    const request = {
      model: "test/model",
      messages: [
        { role: "system", content: "First system line.\nSecond system line." },
        { role: "user", content: '{"question":"Earlier question"}' },
        { role: "assistant", content: '{"beats":["Earlier answer"]}' },
        { role: "user", content: '{"question":"Current question"}' },
      ],
      response_format: { type: "json_schema" },
    };

    const path = await writeAssistantPromptLog(lessonDir, request);

    expect(path).toBe(join(lessonDir, "build", "assistant-prompt.txt"));
    expect(await readFile(path, "utf8")).toBe(
      'SYSTEM\n\nFirst system line.\nSecond system line.\n\nUSER\n\n{"question":"Current question"}\n',
    );
  });

  it("fails when the provider request has no system or user text", async () => {
    const lessonDir = await mkdtemp(join(tmpdir(), "tangible-prompt-log-"));

    await expect(writeAssistantPromptLog(lessonDir, { messages: [] })).rejects.toThrow(
      "must contain system and user text messages",
    );
  });
});
