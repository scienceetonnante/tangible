import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = "packages/cli/dist/index.js";

test("scene preview runs and reloads without narration files", async ({ page }) => {
  const lessonDir = mkdtempSync(join(tmpdir(), "narrable-scene-e2e-"));
  const scenesDir = join(lessonDir, "scenes");
  const helper = join(scenesDir, "value.ts");
  mkdirSync(scenesDir);
  writeFileSync(join(lessonDir, "lesson.yaml"), "id: scene-only\nscene: ./scenes/scene.ts\n");
  writeFileSync(helper, "export const INITIAL = 1;\n");
  writeFileSync(
    join(scenesDir, "scene.ts"),
    `import { INITIAL } from "./value.js";
export const schema = {
  theta: { type: { kind: "scalar", range: [0, 10] }, default: INITIAL, interpolate: "lerp", ownership: "script" },
};
export const scene = {
  schema,
  create(ctx) {
    const drawing = ctx.canvas.getContext("2d");
    return {
      render(state) {
        drawing.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        drawing.fillText(String(state.theta), 20, 20);
      },
      handles: () => [{ id: "theta", params: ["theta"], hitTest: () => true, onDrag: (x) => ({ theta: x / 100 }) }],
      dispose() {},
    };
  },
};
`,
  );

  const port = await freePort();
  const child = spawn("node", [CLI, "scene", "--lesson", lessonDir, "--port", String(port)], {
    cwd: process.cwd(),
    stdio: "pipe",
  });

  try {
    await waitForServer(child);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.locator("audio, .xv-chrome, .xv-board, .xv-captions")).toHaveCount(0);
    await expect.poll(() => sceneValue(page)).toBe(1);

    await page.locator("canvas").click({ position: { x: 200, y: 100 } });
    await expect.poll(() => sceneValue(page)).toBe(2);

    writeFileSync(helper, "export const INITIAL = 4;\n");
    await expect.poll(() => sceneValue(page), { timeout: 10_000 }).toBe(4);
  } finally {
    child.kill();
  }
});

async function sceneValue(page: Page): Promise<number> {
  return page.evaluate(() => {
    const preview = (window as unknown as { __scenePreview: { store: { plain: { theta: number } } } }).__scenePreview;
    return preview.store.plain.theta;
  });
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(child: ChildProcessWithoutNullStreams): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`scene preview did not start:\n${output}`)), 10_000);
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
      if (!output.includes("scene preview on")) return;
      clearTimeout(timer);
      resolve();
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`scene preview exited with ${code}:\n${output}`));
    });
  });
}
