// Local diagnostic copy of the exact provider body, excluding authorization headers.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeAssistantProviderRequest(lessonDir: string, request: Record<string, unknown>): Promise<string> {
  const buildDir = join(lessonDir, "build");
  const path = join(buildDir, "assistant-provider-request.json");
  await mkdir(buildDir, { recursive: true });
  await writeFile(path, JSON.stringify(request, null, 2) + "\n");
  return path;
}
