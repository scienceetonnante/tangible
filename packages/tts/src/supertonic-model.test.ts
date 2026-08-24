import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureSupertonicModel,
  supertonicModelDir,
  SUPERTONIC_MODEL_FILES,
  SUPERTONIC_MODEL_NAME,
} from "./supertonic-model.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("ensureSupertonicModel", () => {
  it("downloads, verifies, and installs the model once", async () => {
    const cacheDir = await temporaryDir();
    const archive = new TextEncoder().encode("synthetic archive");
    const archiveSha256 = createHash("sha256").update(archive).digest("hex");
    let fetches = 0;
    const statuses: string[] = [];
    const options = {
      cacheDir,
      archiveSha256,
      fetchImpl: async () => {
        fetches++;
        return new Response(archive);
      },
      extractArchive: async (_archivePath: string, destination: string) => {
        await writeSyntheticModel(join(destination, SUPERTONIC_MODEL_NAME));
      },
      onStatus: (message: string) => statuses.push(message),
    };

    const first = await ensureSupertonicModel(options);
    const second = await ensureSupertonicModel(options);

    expect(first).toBe(supertonicModelDir(cacheDir));
    expect(second).toBe(first);
    expect(fetches).toBe(1);
    expect(statuses[0]).toContain("123 MB");
    expect(existsSync(join(first, "LICENSE"))).toBe(true);
  });

  it("rejects an archive whose checksum does not match", async () => {
    const cacheDir = await temporaryDir();
    await expect(ensureSupertonicModel({
      cacheDir,
      archiveSha256: "0".repeat(64),
      fetchImpl: async () => new Response("wrong archive"),
      extractArchive: async () => { throw new Error("must not extract"); },
    })).rejects.toThrow("checksum mismatch");
    expect(existsSync(supertonicModelDir(cacheDir))).toBe(false);
  });
});

async function temporaryDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "narrable-supertonic-test-"));
  tempDirs.push(dir);
  return dir;
}

async function writeSyntheticModel(modelDir: string): Promise<void> {
  await mkdir(modelDir, { recursive: true });
  await Promise.all(SUPERTONIC_MODEL_FILES.map((file) => writeFile(join(modelDir, file), file)));
}
