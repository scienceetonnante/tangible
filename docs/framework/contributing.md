# Contributing to the framework

This guide is for changes under `packages/`, shared build tooling, and browser
integration tests. Lesson production follows the
[authoring workflow](../authoring/getting-started.md) instead.

## Setup

Prerequisites are Node 22 or newer and pnpm.

```bash
pnpm install
pnpm build
pnpm check
pnpm test:e2e
```

`pnpm check` runs TypeScript compilation, ESLint, package-boundary checks, and
unit tests. The end-to-end suite uses fake providers and requires no credentials.

## Working conventions

- Preserve the invariants in [architecture.md](./architecture.md).
- Keep package dependencies within the enforced boundary.
- Prefer direct, readable implementations over new abstraction layers.
- Add tests for behavior that is correctness-critical or difficult to inspect.
- Use a real lesson to validate changes to the authoring contract.
- Keep current instructions in task-oriented docs; place rationale in a decision
  record and completed experiments in `docs/archives/`.

## Provider credentials

Real narration and live assistant calls are optional. Store credentials in a
gitignored root or lesson-local `.env`:

```text
ELEVENLABS_API_KEY=...
HF_TOKEN=...
TTS_ENDPOINT_URL=...
HF_TTS_TOKEN=...
```

Never use real providers in hermetic tests or CI.
