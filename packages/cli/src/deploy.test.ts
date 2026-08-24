import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Manifest } from "./manifest.js";
import { deployLessonToSpace, type CommandResult, type CommandRunner } from "./deploy.js";

const SOURCE_COMMIT = "a".repeat(40);

describe("Hugging Face Space deployment", () => {
  it("syncs only the staged release and reports the deployed revision", async () => {
    const lessonDir = await fixture();
    const calls: string[][] = [];
    let stagedFiles: string[] = [];
    const run = runner(calls, async (_command, args) => {
      if (args[0] === "upload") {
        stagedFiles = (await readdir(args[2]!)).sort();
        expect(await readFile(join(args[2]!, "README.md"), "utf8")).toContain("sdk: docker");
        return ok("https://huggingface.co/spaces/example/circle/tree/main\n");
      }
      if (args[0] === "spaces" && args[1] === "secrets") return ok('[{"key":"HF_TOKEN"}]');
      if (args[0] === "spaces" && args[1] === "info" && args.includes("--expand")) return ok('{"sha":"remote-sha"}');
      return standardResponse(args);
    });

    const result = await deployLessonToSpace({
      lessonDir,
      manifest: manifest(),
      check: async () => {},
      build: () => buildSite(lessonDir),
      runCommand: run,
      log: () => {},
    });

    expect(stagedFiles).toEqual([".gitattributes", "Dockerfile", "README.md", "index.html"]);
    expect(calls.some((args) => args[0] === "repos" && args[1] === "create")).toBe(false);
    const upload = calls.find((args) => args[0] === "upload")!;
    expect(upload).toContain("*");
    expect(upload).toContain(`Deploy circle from ${SOURCE_COMMIT.slice(0, 12)}`);
    expect(result).toMatchObject({
      space: "example/circle",
      sourceCommit: SOURCE_COMMIT,
      remoteRevision: "remote-sha",
      dryRun: false,
    });
  });

  it("creates and deploys a Space while warning when its assistant secret is missing", async () => {
    const lessonDir = await fixture();
    const calls: string[][] = [];
    const messages: string[] = [];
    const run = runner(calls, async (_command, args) => {
      if (args[0] === "spaces" && args[1] === "secrets") return ok("[]");
      if (args[0] === "spaces" && args[1] === "info" && args.includes("--expand")) return ok('{"sha":"remote-sha"}');
      return standardResponse(args);
    });

    await expect(deployLessonToSpace({
      lessonDir,
      manifest: manifest(),
      create: true,
      check: async () => {},
      build: () => buildSite(lessonDir),
      runCommand: run,
      log: (message) => messages.push(message),
    })).resolves.toMatchObject({ remoteRevision: "remote-sha", dryRun: false });

    const create = calls.find((args) => args[0] === "repos" && args[1] === "create")!;
    expect(create).toEqual(expect.arrayContaining(["example/circle", "--sdk", "docker", "--private", "--exist-ok"]));
    expect(calls.some((args) => args[0] === "upload")).toBe(true);
    expect(messages).toContain("https://huggingface.co/spaces/example/circle");
    expect(messages).toContain("The lesson is deployed, but its assistant is not ready because the Space has no HF_TOKEN secret.");
    expect(messages).toContain("Add a dedicated inference token at https://huggingface.co/spaces/example/circle/settings");
    expect(messages.indexOf("https://huggingface.co/spaces/example/circle"))
      .toBeLessThan(messages.indexOf("The lesson is deployed, but its assistant is not ready because the Space has no HF_TOKEN secret."));
  });

  it("performs local release work but makes no Hugging Face calls during a dry run", async () => {
    const lessonDir = await fixture();
    const calls: string[][] = [];
    const events: string[] = [];

    const result = await deployLessonToSpace({
      lessonDir,
      manifest: manifest(),
      create: true,
      dryRun: true,
      check: async () => { events.push("check"); },
      build: async () => { events.push("build"); await buildSite(lessonDir); },
      runCommand: runner(calls, async (_command, args) => standardResponse(args)),
      log: (message) => events.push(message),
    });

    expect(events).toEqual(expect.arrayContaining(["check", "build", "dry run: would create privately and deploy example/circle"]));
    expect(calls.every((args) => args[0] === "-C")).toBe(true);
    expect(result.dryRun).toBe(true);
  });

  it("accepts a static Space card for a lesson without an assistant", async () => {
    const lessonDir = await fixture(false);

    await expect(deployLessonToSpace({
      lessonDir,
      manifest: manifest(false),
      dryRun: true,
      check: async () => {},
      build: () => buildSite(lessonDir),
      runCommand: runner([], async (_command, args) => standardResponse(args)),
      log: () => {},
    })).resolves.toMatchObject({ dryRun: true });
  });

  it("shows both log streams when the Space does not start", async () => {
    const lessonDir = await fixture();
    const calls: string[][] = [];
    const run = runner(calls, async (_command, args) => {
      if (args[0] === "spaces" && args[1] === "secrets") return ok('[{"name":"HF_TOKEN"}]');
      if (args[0] === "upload") return ok("uploaded");
      if (args[0] === "spaces" && args[1] === "wait") return fail("BUILD_ERROR");
      return standardResponse(args);
    });

    await expect(deployLessonToSpace({
      lessonDir,
      manifest: manifest(),
      check: async () => {},
      build: () => buildSite(lessonDir),
      runCommand: run,
      log: () => {},
    })).rejects.toThrow("did not reach the RUNNING state");

    const logs = calls.filter((args) => args[0] === "spaces" && args[1] === "logs");
    expect(logs).toHaveLength(2);
    expect(logs[0]).toContain("--build");
    expect(logs[1]).not.toContain("--build");
  });

  it("rejects a dirty source worktree before checking or building", async () => {
    const lessonDir = await fixture();
    let worked = false;
    const run = runner([], async (_command, args) => {
      if (args.includes("status")) return ok(" M script.md\n");
      return standardResponse(args);
    });

    await expect(deployLessonToSpace({
      lessonDir,
      manifest: manifest(),
      check: async () => { worked = true; },
      build: async () => { worked = true; },
      runCommand: run,
      log: () => {},
    })).rejects.toThrow("requires a clean Git worktree");
    expect(worked).toBe(false);
  });

  it("rejects a local credential copied into the release", async () => {
    const lessonDir = await fixture();
    const former = process.env.ELEVENLABS_API_KEY;
    process.env.ELEVENLABS_API_KEY = "local-secret-value";
    try {
      await expect(deployLessonToSpace({
        lessonDir,
        manifest: manifest(),
        dryRun: true,
        check: async () => {},
        build: async () => {
          await buildSite(lessonDir);
          await writeFile(join(lessonDir, "build", "site", "player.js"), "local-secret-value");
        },
        runCommand: runner([], async (_command, args) => standardResponse(args)),
        log: () => {},
      })).rejects.toThrow("contains the local ELEVENLABS_API_KEY value");
    } finally {
      if (former === undefined) delete process.env.ELEVENLABS_API_KEY;
      else process.env.ELEVENLABS_API_KEY = former;
    }
  });
});

async function fixture(assistant = true): Promise<string> {
  const lessonDir = await mkdtemp(join(tmpdir(), "narrable-deploy-"));
  await mkdir(join(lessonDir, "space"));
  const card = assistant
    ? "---\nsdk: docker\napp_port: 7860\n---\n\n# Circle\n"
    : "---\nsdk: static\napp_file: index.html\n---\n\n# Circle\n";
  await writeFile(join(lessonDir, "space", "README.md"), card);
  await writeFile(join(lessonDir, "space", ".gitattributes"), "*.wav filter=lfs diff=lfs merge=lfs -text\n");
  return lessonDir;
}

async function buildSite(lessonDir: string): Promise<void> {
  await mkdir(join(lessonDir, "build", "site"), { recursive: true });
  await writeFile(join(lessonDir, "build", "site", "index.html"), "<!doctype html>");
  await writeFile(join(lessonDir, "build", "site", "Dockerfile"), "FROM node:22-slim\n");
}

function manifest(assistant = true): Manifest {
  const result: Manifest = {
    id: "circle",
    title: "Circle",
    scene: "./scenes/scene.ts",
    defaults: { anticipation: -0.2, ease: "linear", transition: 1 },
    tts: { provider: "hf-endpoint", voice: "test" },
    deployment: { provider: "huggingface", space: "example/circle" },
  };
  if (assistant) result.assistant = { provider: "huggingface", model: "test/model", context: "assistant.md", commandable: [] };
  return result;
}

function runner(calls: string[][], respond: (command: string, args: string[]) => Promise<CommandResult>): CommandRunner {
  return async (command, args) => {
    calls.push(args);
    return respond(command, args);
  };
}

function standardResponse(args: string[]): CommandResult {
  if (args.includes("--show-toplevel")) return ok("/repo\n");
  if (args.includes("status")) return ok("");
  if (args.includes("HEAD")) return ok(`${SOURCE_COMMIT}\n`);
  if (args[0] === "spaces" && args[1] === "info") return ok('{"id":"example/circle"}');
  return ok("");
}

function ok(stdout: string): CommandResult {
  return { code: 0, stdout, stderr: "" };
}

function fail(stderr: string): CommandResult {
  return { code: 1, stdout: "", stderr };
}
