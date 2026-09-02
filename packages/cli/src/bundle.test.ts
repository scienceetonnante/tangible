import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { DEFAULT_ASSISTANT_LIMITS } from "@tangible/core";
import { bundleAssistantServer, precompressSiteAssets } from "./bundle.js";

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

  it("writes deterministic Brotli and gzip representations for browser text assets", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "tangible-compression-"));
    try {
      const source = Buffer.from("const lesson = 'tangible';\n".repeat(1000));
      await writeFile(join(outDir, "player.js"), source);
      await writeFile(join(outDir, "audio.webm"), source);
      await writeFile(join(outDir, "obsolete.js.br"), "stale");
      await writeFile(join(outDir, "obsolete.js.gz"), "stale");

      await precompressSiteAssets(outDir);
      const firstBrotli = await readFile(join(outDir, "player.js.br"));
      const firstGzip = await readFile(join(outDir, "player.js.gz"));
      expect(brotliDecompressSync(firstBrotli)).toEqual(source);
      expect(gunzipSync(firstGzip)).toEqual(source);
      expect(firstBrotli.length).toBeLessThan(source.length);
      expect(firstGzip.length).toBeLessThan(source.length);
      await expect(readFile(join(outDir, "audio.webm.br"))).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readFile(join(outDir, "obsolete.js.br"))).rejects.toMatchObject({ code: "ENOENT" });

      await precompressSiteAssets(outDir);
      expect(await readFile(join(outDir, "player.js.br"))).toEqual(firstBrotli);
      expect(await readFile(join(outDir, "player.js.gz"))).toEqual(firstGzip);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
