import { test, expect } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = "packages/cli/dist/index.js";
const brokenScript = `
@scene(circle)
The point moves @cue(theta = 99) around the circle.
`;
const fixedScript = brokenScript.replace("theta = 99", "theta = 1.5");

test("lesson preview shows compiler errors and recovers without exiting", async ({ page }) => {
  const lessonDir = mkdtempSync(join(tmpdir(), "tangible-preview-error-e2e-"));
  cpSync("lessons/unit-circle/lesson.yaml", join(lessonDir, "lesson.yaml"));
  cpSync("lessons/unit-circle/scenes", join(lessonDir, "scenes"), { recursive: true });
  cpSync("lessons/unit-circle/assistant.md", join(lessonDir, "assistant.md"));
  writeFileSync(join(lessonDir, "script.md"), brokenScript);

  const port = await freePort();
  const child = spawn("node", [CLI, "preview", "--silent", "--lesson", lessonDir, "--port", String(port)], {
    cwd: process.cwd(),
    stdio: "pipe",
  });

  try {
    await waitForPreview(child);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.getByRole("alert")).toContainText("theta: 99 is out of range [0, 6.2832]");

    writeFileSync(join(lessonDir, "script.md"), fixedScript);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    child.kill();
  }
});

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForPreview(child: ChildProcessWithoutNullStreams): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`lesson preview did not start:\n${output}`)), 10_000);
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
      if (!output.includes("preview on")) return;
      clearTimeout(timer);
      resolve();
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`lesson preview exited with ${code}:\n${output}`));
    });
  });
}
