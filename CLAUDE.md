# Repository agent instructions

`AGENTS.md` links to this file so the same rules apply across agent clients.

## First choose the workstream

- For framework code, shared tooling, or integration tests, read
  `packages/AGENTS.md` and `docs/framework/architecture.md`.
- For lesson design, scenes, narration, review, or deployment, read
  `lessons/AGENTS.md` and `docs/authoring/getting-started.md`.
- For work spanning both, apply both scoped instruction files and explain why the
  boundary must change.

Do not read historical research as current specification. `docs/research/` records
how decisions were reached; current behavior is defined by task-oriented docs,
types, tests, and CLI diagnostics.

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
