import { describe, expect, it } from "vitest";
import { lessonPositionAt } from "./lesson-position.js";

describe("lessonPositionAt", () => {
  const chapters = [{ t: 2, title: "First" }, { t: 10, title: "Second" }];

  it("does not expose a future chapter", () => {
    expect(lessonPositionAt(1, chapters, "")).toEqual({ chapter: null, narrationJustHeard: null, pausePrompt: null });
  });

  it("uses the latest chapter and supplied narration", () => {
    expect(lessonPositionAt(12, chapters, "Just heard.")).toEqual({
      chapter: "Second",
      narrationJustHeard: "Just heard.",
      pausePrompt: null,
    });
  });

  it("includes only an actively supplied authored pause prompt", () => {
    expect(lessonPositionAt(5, chapters, "Try it.", "Try it.").pausePrompt).toBe("Try it.");
  });
});
