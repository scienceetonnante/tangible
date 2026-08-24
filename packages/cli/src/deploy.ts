// Safe Hugging Face Space deployment from a validated, real-voice lesson build.

import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { Manifest } from "./manifest.js";
import { readSpaceCard, stageRelease } from "./deploy-release.js";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string; capture: boolean },
) => Promise<CommandResult>;

export interface DeployOptions {
  lessonDir: string;
  manifest: Manifest;
  create?: boolean;
  dryRun?: boolean;
  check(): Promise<void>;
  build(): Promise<void>;
  runCommand?: CommandRunner;
  log?: (message: string) => void;
}

export interface DeployResult {
  space: string;
  sourceCommit: string;
  remoteRevision?: string;
  uploadUrl?: string;
  dryRun: boolean;
}

export async function deployLessonToSpace(options: DeployOptions): Promise<DeployResult> {
  const deployment = options.manifest.deployment;
  if (!deployment) throw new Error('lesson deploy requires a "deployment" section in lesson.yaml');

  const run = options.runCommand ?? runCommand;
  const log = options.log ?? ((message: string) => console.error(message));
  const card = await readSpaceCard(options.lessonDir, options.manifest);
  const sourceCommit = await readSourceRevision(options.lessonDir, run);

  if (!options.dryRun) {
    await checked(run, "hf", ["version"], options.lessonDir, true, "Hugging Face CLI check");
    await checked(run, "hf", ["auth", "whoami", "--format", "json"], options.lessonDir, true, "Hugging Face authentication check");
    if (!options.create) {
      const info = await run("hf", ["spaces", "info", deployment.space, "--format", "json"], {
        cwd: options.lessonDir,
        capture: true,
      });
      if (info.code !== 0) {
        throw new Error(
          `Hugging Face Space "${deployment.space}" is not accessible. If it does not exist, rerun with --create.${details(info.stderr)}`,
        );
      }
    }
  }

  await options.check();
  await options.build();

  const staged = await stageRelease(options.lessonDir);
  try {
    log(`release contains ${staged.files} files (${formatBytes(staged.bytes)})`);
    if (options.dryRun) {
      log(`dry run: would ${options.create ? "create privately and deploy" : "deploy"} ${deployment.space}`);
      return { space: deployment.space, sourceCommit, dryRun: true };
    }

    if (options.create) {
      await checked(
        run,
        "hf",
        ["repos", "create", deployment.space, "--type", "space", "--sdk", card.sdk, "--private", "--exist-ok"],
        options.lessonDir,
        false,
        "Space creation",
      );
    }

    if (options.manifest.assistant) {
      const secrets = await checked(
        run,
        "hf",
        ["spaces", "secrets", "list", deployment.space, "--format", "json"],
        options.lessonDir,
        true,
        "Space secret check",
      );
      if (!hasNamedSecret(secrets.stdout, "HF_TOKEN")) {
        throw new Error(
          `Space "${deployment.space}" needs a dedicated HF_TOKEN secret for lesson answers. Add it in the Space settings or with `
          + `"hf spaces secrets add ${deployment.space} --secrets-file <file>", then rerun without --create. No lesson files were uploaded.`,
        );
      }
    }

    const shortCommit = sourceCommit.slice(0, 12);
    log(`uploading ${options.manifest.id} to ${deployment.space}`);
    const upload = await checked(
      run,
      "hf",
      [
        "upload",
        deployment.space,
        staged.path,
        ".",
        "--repo-type",
        "space",
        "--delete",
        "*",
        "--commit-message",
        `Deploy ${options.manifest.id} from ${shortCommit}`,
        "--commit-description",
        `Narrable source commit ${sourceCommit}`,
        "--quiet",
      ],
      options.lessonDir,
      true,
      "Space upload",
    );
    const uploadUrl = lastLine(upload.stdout);

    log(`waiting for ${deployment.space} to finish building`);
    const wait = await run("hf", ["spaces", "wait", deployment.space, "--timeout", "10m"], {
      cwd: options.lessonDir,
      capture: false,
    });
    if (wait.code !== 0) {
      log("Space startup failed; showing recent build and runtime logs.");
      await run("hf", ["spaces", "logs", deployment.space, "--build", "--tail", "100"], {
        cwd: options.lessonDir,
        capture: false,
      });
      await run("hf", ["spaces", "logs", deployment.space, "--tail", "100"], {
        cwd: options.lessonDir,
        capture: false,
      });
      throw new Error(`Space "${deployment.space}" did not reach the RUNNING state`);
    }

    const info = await checked(
      run,
      "hf",
      ["spaces", "info", deployment.space, "--expand", "sha", "--format", "json"],
      options.lessonDir,
      true,
      "Deployed revision check",
    );
    const remoteRevision = findStringProperty(info.stdout, "sha");
    log(`deployed ${deployment.space}${remoteRevision ? ` at ${remoteRevision}` : ""}`);
    log(`https://huggingface.co/spaces/${deployment.space}`);
    return { space: deployment.space, sourceCommit, remoteRevision, uploadUrl, dryRun: false };
  } finally {
    await rm(staged.root, { recursive: true, force: true });
  }
}

async function readSourceRevision(lessonDir: string, run: CommandRunner): Promise<string> {
  const rootResult = await checked(run, "git", ["-C", lessonDir, "rev-parse", "--show-toplevel"], lessonDir, true, "Git repository check");
  const root = rootResult.stdout.trim();
  const status = await checked(run, "git", ["-C", root, "status", "--porcelain", "--untracked-files=all"], root, true, "Git status check");
  if (status.stdout.trim()) throw new Error("lesson deploy requires a clean Git worktree; commit or remove local changes first");
  const revision = await checked(run, "git", ["-C", root, "rev-parse", "HEAD"], root, true, "Git revision check");
  return revision.stdout.trim();
}

async function checked(
  run: CommandRunner,
  command: string,
  args: string[],
  cwd: string,
  capture: boolean,
  label: string,
): Promise<CommandResult> {
  const result = await run(command, args, { cwd, capture });
  if (result.code !== 0) throw new Error(`${label} failed.${details(result.stderr)}`);
  return result;
}

async function runCommand(command: string, args: string[], options: { cwd: string; capture: boolean }): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr?.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", (error) => reject(new Error(`could not run "${command}": ${error.message}`)));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function hasNamedSecret(output: string, name: string): boolean {
  try {
    const visit = (value: unknown): boolean => {
      if (typeof value === "string") return value === name;
      if (Array.isArray(value)) return value.some(visit);
      if (value && typeof value === "object") {
        return Object.entries(value).some(([key, nested]) => key === name || visit(nested));
      }
      return false;
    };
    return visit(JSON.parse(output));
  } catch {
    return new RegExp(`(^|\\W)${name}($|\\W)`).test(output);
  }
}

function findStringProperty(output: string, name: string): string | undefined {
  try {
    const visit = (value: unknown): string | undefined => {
      if (!value || typeof value !== "object") return undefined;
      if (!Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        if (typeof record[name] === "string") return record[name];
      }
      for (const nested of Object.values(value)) {
        const found = visit(nested);
        if (found) return found;
      }
      return undefined;
    };
    return visit(JSON.parse(output));
  } catch {
    return undefined;
  }
}

function details(stderr: string): string {
  const message = stderr.trim();
  return message ? ` ${message.slice(0, 1200)}` : "";
}

function lastLine(value: string): string | undefined {
  return value.trim().split(/\r?\n/).filter(Boolean).at(-1);
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
