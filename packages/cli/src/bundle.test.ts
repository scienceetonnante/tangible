import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { DEFAULT_ASSISTANT_LIMITS } from "@tangible/core";
import { bundleAssistantServer } from "./bundle.js";

const execFileAsync = promisify(execFile);

describe("assistant server bundle", () => {
  it("includes the authored limits and provides require to bundled CommonJS dependencies", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "tangible-server-bundle-"));
    try {
      const limits = {
        ...DEFAULT_ASSISTANT_LIMITS,
        rate: { ...DEFAULT_ASSISTANT_LIMITS.rate, globalRequestsPerDay: 37 },
      };
      await bundleAssistantServer(outDir, limits);

      const server = await readFile(join(outDir, "server.mjs"), "utf8");
      expect(server).toContain("__tangibleCreateRequire(import.meta.url)");
      expect(server).toContain('"globalRequestsPerDay": 37');

      const result = await execFileAsync(process.execPath, ["server.mjs"], {
        cwd: outDir,
        env: { ...process.env, PORT: "invalid" },
      }).catch((error: NodeJS.ErrnoException & { stderr?: string }) => error);

      expect(result.stderr).toContain("ERR_SOCKET_BAD_PORT");
      expect(result.stderr).not.toContain("Dynamic require");
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
