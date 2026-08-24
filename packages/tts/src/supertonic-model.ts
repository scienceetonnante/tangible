// Download and verify the pinned Supertonic model used for local narration.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { access, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";

export const SUPERTONIC_MODEL_NAME = "sherpa-onnx-supertonic-3-tts-int8-2026-05-11";
export const SUPERTONIC_MODEL_URL =
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${SUPERTONIC_MODEL_NAME}.tar.bz2`;
export const SUPERTONIC_MODEL_SHA256 = "82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427";

export const SUPERTONIC_MODEL_FILES = [
  "duration_predictor.int8.onnx",
  "text_encoder.int8.onnx",
  "vector_estimator.int8.onnx",
  "vocoder.int8.onnx",
  "tts.json",
  "unicode_indexer.bin",
  "voice.bin",
  "LICENSE",
] as const;

export interface SupertonicModelOptions {
  cacheDir?: string;
  fetchImpl?: typeof fetch;
  onStatus?: (message: string) => void;
  /** Test seam for extracting a small synthetic archive. */
  extractArchive?: (archivePath: string, destination: string) => Promise<void>;
  /** Test seam for checking a small synthetic archive. */
  archiveSha256?: string;
}

/** Return the shared Narrable cache, respecting common platform conventions. */
export function defaultNarrableCacheDir(): string {
  if (process.env.NARRABLE_CACHE_DIR) return resolve(process.env.NARRABLE_CACHE_DIR);
  if (process.platform === "darwin") return join(homedir(), "Library", "Caches", "narrable");
  if (process.platform === "win32" && process.env.LOCALAPPDATA) return join(process.env.LOCALAPPDATA, "narrable");
  if (process.env.XDG_CACHE_HOME) return join(process.env.XDG_CACHE_HOME, "narrable");
  return join(homedir(), ".cache", "narrable");
}

export function supertonicModelDir(cacheDir = defaultNarrableCacheDir()): string {
  return join(cacheDir, "tts", SUPERTONIC_MODEL_NAME);
}

/** Ensure the pinned model exists locally, downloading it once when necessary. */
export async function ensureSupertonicModel(options: SupertonicModelOptions = {}): Promise<string> {
  const modelDir = supertonicModelDir(options.cacheDir);
  if (await modelIsComplete(modelDir)) return modelDir;
  if (existsSync(modelDir)) {
    throw new Error(`the local Supertonic model cache is incomplete; remove it and retry: ${modelDir}`);
  }

  const parentDir = dirname(modelDir);
  await mkdir(parentDir, { recursive: true });
  const tempDir = await mkdtemp(join(parentDir, `.${SUPERTONIC_MODEL_NAME}-`));
  const archivePath = join(tempDir, `${SUPERTONIC_MODEL_NAME}.tar.bz2`);
  const fetchImpl = options.fetchImpl ?? fetch;
  const extractArchive = options.extractArchive ?? extractTarBzip2;

  try {
    options.onStatus?.("offline narration: downloading the local Supertonic model once (123 MB)…");
    await download(fetchImpl, SUPERTONIC_MODEL_URL, archivePath);
    const actualHash = await sha256File(archivePath);
    const expectedHash = options.archiveSha256 ?? SUPERTONIC_MODEL_SHA256;
    if (actualHash !== expectedHash) {
      throw new Error(`Supertonic model checksum mismatch: expected ${expectedHash}, received ${actualHash}`);
    }

    options.onStatus?.("offline narration: installing the verified Supertonic model…");
    await extractArchive(archivePath, tempDir);
    const extractedDir = join(tempDir, SUPERTONIC_MODEL_NAME);
    if (!(await modelIsComplete(extractedDir))) {
      throw new Error("the Supertonic model archive did not contain all required files");
    }

    try {
      await rename(extractedDir, modelDir);
    } catch (error) {
      if (!(await modelIsComplete(modelDir))) throw error;
    }
    options.onStatus?.(`offline narration: Supertonic model installed in ${modelDir}`);
    return modelDir;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `could not install the local Supertonic model: ${message}. ` +
      "Connect once to download it, or set NARRABLE_SUPERTONIC_MODEL_DIR to an extracted model directory.",
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function modelIsComplete(modelDir: string): Promise<boolean> {
  try {
    await Promise.all(SUPERTONIC_MODEL_FILES.map((file) => access(join(modelDir, file))));
    return true;
  } catch {
    return false;
  }
}

async function download(fetchImpl: typeof fetch, url: string, outputPath: string): Promise<void> {
  const response = await fetchImpl(url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`model download failed with HTTP ${response.status}`);
  const source = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
  await pipeline(source, createWriteStream(outputPath));
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function extractTarBzip2(archivePath: string, destination: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("tar", ["-xjf", archivePath, "-C", destination], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", (error) => reject(new Error(`could not run tar: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`tar exited with code ${code}${stderr.trim() ? `: ${stderr.trim()}` : ""}`));
    });
  });
}
