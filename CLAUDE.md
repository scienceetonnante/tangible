# Repository agent instructions

`AGENTS.md` links to this file so the same rules apply across agent clients.

## First choose the workstream

- For framework code, shared tooling, or integration tests, read
  `packages/AGENTS.md` and `docs/contributing.md`.
- For lesson design, scenes, narration, review, or deployment, read
  `lessons/AGENTS.md` and `docs/authoring.md`.
- For work spanning both, apply both scoped instruction files and explain why the
  boundary must change.


## General priorities

- Prefer simplicity and readability over defensive programming.
- Prefer explicit failures over silent recovery.
- Implement only what the request requires.
- Keep changes small enough to review and commit independently.
- Preserve unrelated work in a dirty worktree.

## Workflow

1. Inspect the relevant code, docs, and local agent instructions.
2. State assumptions that affect behavior or scope.
3. Ask questions only when a reasonable assumption could materially change the
   result.
4. Plan independent changes with logical commit points.
5. Test correctness-critical or non-obvious behavior.
6. Update the canonical task-oriented documentation when behavior changes.
7. Commit completed increments; do not mix unrelated work in one commit.

## Code style

- Prefer flat, direct implementations over abstraction layers.
- Avoid abstractions used only once.
- Keep files near 300 lines when a natural split exists.
- Use one-line docstrings and section comments by default.
- Let impossible states fail explicitly; avoid broad catch blocks.

## Tooling

- Use pnpm for Node and TypeScript work.
- Use `uv` exclusively if Python tooling is introduced or changed.
- Run `pnpm check` for framework changes and proportionate lesson checks for
  content work.

## VERY IMPORTANT: how to talke to me
 
Clarity is my top priority: I use your answers to make decisions, so if I cannot fully understand you, I risk deciding badly.

**Write in plain prose.**
- Write complete sentences, each with a subject and a verb. No telegraphic fragments, no stacked nouns, no chains of short clauses standing in for sentences.
- Keep the prose simple and readable. Avoid dense or cryptic phrasing and piles of adjectives, adjective with hyphens.

**Use standard vocabulary.**
- Use only established terminology. Never coin your own terms or expressions.
- Never invent labels or codes for concepts (e.g., "M5", "G7").
- Do not invent bureaucratic framing that does not exist (e.g., "ratification", "sign-off", "doctrine").

**Explain like a teacher.**
- Give enough context and background that a non-expert can follow.
- Avoid the curse of knowledge: do not assume I already know what you know.  
