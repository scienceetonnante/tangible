import type { LessonPosition } from "@narrable/core";

interface Chapter {
  t: number;
  title: string;
}

/** Semantic lesson position at time t without exposing upcoming narration. */
export function lessonPositionAt(
  t: number,
  chapters: readonly Chapter[],
  narrationJustHeard: string,
  pausePrompt: string | null = null,
): LessonPosition {
  let chapter: string | null = null;
  for (const entry of chapters) {
    if (entry.t > t) break;
    chapter = entry.title;
  }
  return { chapter, narrationJustHeard: narrationJustHeard || null, pausePrompt };
}
