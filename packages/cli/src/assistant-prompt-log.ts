// Readable local copy of the system prompt and current user message.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface ProviderMessage {
  role?: unknown;
  content?: unknown;
}

export async function writeAssistantPromptLog(
  lessonDir: string,
  request: Record<string, unknown>,
): Promise<string> {
  if (!Array.isArray(request.messages)) {
    throw new Error("Assistant provider request has no messages.");
  }

  const messages = request.messages as ProviderMessage[];
  const systemMessage = messages.find((message) => message.role === "system");
  let userMessage: ProviderMessage | undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      userMessage = messages[index];
      break;
    }
  }
  if (typeof systemMessage?.content !== "string" || typeof userMessage?.content !== "string") {
    throw new Error("Assistant provider request must contain system and user text messages.");
  }

  const buildDir = join(lessonDir, "build");
  const path = join(buildDir, "assistant-prompt.txt");
  const transcript = `SYSTEM\n\n${systemMessage.content}\n\nUSER\n\n${userMessage.content}\n`;
  await mkdir(buildDir, { recursive: true });
  await writeFile(path, transcript);
  return path;
}
