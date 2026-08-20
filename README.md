# Narrable

Narrable is a framework for building narrated interactive lessons. A recorded
voiceover drives a live 2D or 3D scene, while learners remain free to manipulate
the model and see its connected representations recompute.

Lessons are authored from text: a pedagogical brief, narration with timed scene
cues, a declarative scene schema, and TypeScript rendering code.

## Choose your path

- **Create a lesson:** start with the
  [lesson-authoring guide](./docs/authoring/getting-started.md). No knowledge of
  Narrable internals is expected.
- **Develop the framework:** read the
  [contributor guide](./docs/framework/contributing.md) and
  [architecture](./docs/framework/architecture.md).
- **Find a command or format:** use the [reference docs](./docs/README.md#reference).
- **See future work:** read the [roadmap](./ROADMAP.md).

The complete documentation index is in [docs/README.md](./docs/README.md).

## Current capabilities

The end-to-end pipeline supports script validation, fake or real TTS, seekable
value-at-time tracks, interactive reconciliation, equations, captions, narrated
pause checkpoints, deterministic frame and state inspection, multilingual
lessons, and optional written lesson assistants. Bundled lessons can be deployed
as static sites or as Docker-based Hugging Face Spaces when a server-side
assistant is enabled.

Reference lessons live in `lessons/`:

- `unit-circle`: bilingual 2D lesson and primary integration example;
- `backprop`: agent-authored network with build-time computed steps;
- `optimizers`: navigable 3D optimizer comparison;
- `python-sampler`: editable, worker-isolated browser Python.

## Quick start

Prerequisites: Node 22 or newer and pnpm.

```bash
pnpm install
pnpm build
pnpm lesson preview --fake --lesson lessons/unit-circle
```

Open <http://localhost:5179>. The `--fake` flag keeps the authoring loop local,
deterministic, and free of provider calls.

Common checks:

```bash
pnpm lesson check --lesson lessons/unit-circle
pnpm lesson build --fake --bundle --lesson lessons/unit-circle
pnpm check
pnpm test:e2e
```

## Repository layout

```text
packages/    framework packages: core, compiler, TTS, player, ingredients, CLI
lessons/     lesson source projects and integration examples
docs/        authoring, reference, deployment, framework, decisions, and research
e2e/         browser integration tests
```

Framework dependencies follow one enforced rule: `core` depends on nothing;
`compiler`, `tts`, `player`, and `ingredients` depend only on `core`; `cli` may
compose all packages. The runtime player never imports the compiler or TTS.
