# Contributing to Tangible

Thank you for helping improve Tangible. The repository has two related
workstreams, and each has its own detailed guidance.

## Create or improve a lesson

Read [lessons/AGENTS.md](./lessons/AGENTS.md) and the
[authoring guide](./docs/authoring.md). The human author owns the teaching
argument, spoken narration, and final pedagogical and visual judgment. Lesson
changes should use the smallest scene that makes the intended relationship
visible and should be reviewed without paid providers before production voice
or deployment work begins.

## Change the framework

Read [packages/AGENTS.md](./packages/AGENTS.md) and the
[framework contributor guide](./docs/contributing.md). Framework changes must
preserve deterministic value-at-time evaluation, package boundaries, and the
separation between browser code and provider credentials.

## Before submitting a change

Keep each commit focused and preserve unrelated work. Run checks in proportion
to the change:

```bash
pnpm check
```

Run `pnpm test:e2e` when changing the player, browser interaction, bundling, or
the complete authoring workflow. Use silent or offline providers in automated
tests. Do not commit lesson `build/` or `.cache/` directories, credentials, or
generated evaluation results.
