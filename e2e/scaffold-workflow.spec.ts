// A generated lesson must survive the exact first-creator command sequence and
// remain visibly editable without provider credentials.

import { test, expect } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CLI = "packages/cli/dist/index.js";
const lesson = (args: string[]) => spawnSync("node", [CLI, ...args], { encoding: "utf8" });

test("a creator can generate, inspect, build, render, and modify a lesson", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The command workflow needs only one browser engine.");

  const root = mkdtempSync(join(tmpdir(), "tangible-first-lesson-"));
  const dir = join(root, "my-lesson");
  try {
    const created = lesson(["new", "my-lesson", "--lesson", dir]);
    expect(created.status, created.stderr).toBe(0);
    expect(created.stderr).toContain("Start with the interactive scene");

    const ref = lesson(["ref", "--lesson", dir]);
    expect(ref.status, ref.stderr).toBe(0);
    expect(ref.stdout).toContain("`amount`");

    const checked = lesson(["check", "--lesson", dir]);
    expect(checked.status, checked.stderr).toBe(0);

    const built = lesson(["build", "--silent", "--bundle", "--lesson", dir]);
    expect(built.status, built.stderr).toBe(0);

    const state = lesson(["state", "--at", "30", "--lesson", dir]);
    expect(state.status, state.stderr).toBe(0);
    expect(JSON.parse(state.stdout).amount).toBeCloseTo(80, 6);

    const png = join(root, "frame.png");
    const frame = lesson(["frame", "--at", "30", "-o", png, "--lesson", dir]);
    expect(frame.status, frame.stderr).toBe(0);
    expect(existsSync(png)).toBe(true);
    expect(statSync(png).size).toBeGreaterThan(10_000);

    const scriptPath = join(dir, "script.md");
    const script = readFileSync(scriptPath, "utf8").replace("amount -> 80", "amount -> 60");
    writeFileSync(scriptPath, script);
    expect(lesson(["check", "--lesson", dir]).status).toBe(0);
    expect(lesson(["build", "--silent", "--lesson", dir]).status).toBe(0);

    const changed = lesson(["state", "--at", "30", "--lesson", dir]);
    expect(changed.status, changed.stderr).toBe(0);
    expect(JSON.parse(changed.stdout).amount).toBeCloseTo(60, 6);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
