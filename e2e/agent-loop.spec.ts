// The agent-loop guarantee: a script edit is
// caught by `check` with an actionable diagnostic, and after the fix the lesson
// builds and is inspectable via `state` and `frame` — all from plain text.

import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = "packages/cli/dist/index.js";
const lesson = (args: string[]) => spawnSync("node", [CLI, ...args], { encoding: "utf8" });

const brokenScript = `
@scene(circle)
First @cue(show.projectionn = true) then @cue(theta -> 1.5) finish.
`;
const fixedScript = brokenScript.replace("show.projectionn", "show.projection");

test("agent loop: check catches error → fix → build → state + frame", () => {
  const dir = mkdtempSync(join(tmpdir(), "xv-agent-"));
  cpSync("lessons/unit-circle/lesson.yaml", join(dir, "lesson.yaml"));
  cpSync("lessons/unit-circle/scenes", join(dir, "scenes"), { recursive: true });
  cpSync("lessons/unit-circle/assistant.md", join(dir, "assistant.md"));

  // 1. A broken script fails check with a did-you-mean diagnostic.
  writeFileSync(join(dir, "script.md"), brokenScript);
  const bad = lesson(["check", "--lesson", dir]);
  expect(bad.status).toBe(1);
  expect(bad.stderr).toContain("did you mean");
  expect(bad.stderr).toContain("show.projection");

  // 2. After the fix, check passes.
  writeFileSync(join(dir, "script.md"), fixedScript);
  expect(lesson(["check", "--lesson", dir]).status).toBe(0);

  // 3. Build the static bundle with deterministic placeholder audio.
  expect(lesson(["build", "--bundle", "--offline", "--lesson", dir]).status).toBe(0);

  // 4. State is inspectable and correct (past the end → holds the last cue).
  const st = lesson(["state", "--at", "30", "--lesson", dir]);
  expect(st.status).toBe(0);
  const state = JSON.parse(st.stdout);
  expect(state.theta).toBeCloseTo(1.5, 6);
  expect(state["show.projection"]).toBe(true);

  // 5. A frame renders headlessly.
  const png = join(dir, "frame.png");
  expect(lesson(["frame", "--at", "30", "-o", png, "--lesson", dir]).status).toBe(0);
  expect(existsSync(png)).toBe(true);
});
