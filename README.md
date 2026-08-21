# Narrable

Narrable is a framework for building narrated interactive lessons. A recorded
voiceover drives a live 2D or 3D scene, while learners remain free to manipulate
the model and see its connected representations recompute.

Lessons combine narration with timed scene cues, a declarative scene schema, and
TypeScript rendering code.

## Choose your path

- **Create a lesson:** start with the
  [lesson-authoring guide](./docs/authoring/0-getting-started.md). No knowledge of
  Narrable internals is expected.
- **Develop the framework:** read the
  [contributor guide](./docs/framework/contributing.md) and
  [architecture](./docs/framework/architecture.md).
- **Find a command or format:** use the [reference docs](./docs/README.md#reference).
- **See future work:** read the [roadmap](./ROADMAP.md).

The complete documentation index is in [docs/README.md](./docs/README.md).

## What Narrable adds to a scene

You first build an interactive scene as an ordinary small website. Narrable then
adds a narration clock, animation cues anchored to words in `script.md`, captions,
pause checkpoints, and controls for seeking and playback. Learners can still
manipulate the scene while the narration is running.

The framework also provides script validation, deterministic frame and state
inspection, equations, build-time computations, and an optional written lesson
assistant. A lesson can be bundled as a static site, or as a small server-based
site when it includes an assistant. Lessons currently use English only.

Reference lessons live in `lessons/`:

- `unit-circle`: 2D lesson and primary integration example;
- `optimizers`: navigable 3D optimizer comparison;
- `python-sampler`: editable, worker-isolated browser Python.

## Quick start

Prerequisites: Node 22 or newer and pnpm.

```bash
pnpm install
pnpm build
pnpm lesson preview --offline --lesson lessons/unit-circle
```

Open <http://localhost:5179>. The `--offline` option creates silent placeholder
audio instead of calling a speech provider. It lets you test the complete player
without an API key or paid request. The placeholder duration is predictable, but
it cannot be used to judge pacing against a real voice.

To develop an interactive scene before narration exists, run:

```bash
pnpm lesson scene --lesson lessons/unit-circle
```

This command loads schema defaults and the scene runtime without reading scripts,
building audio, or showing lesson playback controls.

Common checks:

```bash
pnpm lesson check --lesson lessons/unit-circle
pnpm lesson build --offline --bundle --lesson lessons/unit-circle
pnpm check
pnpm test:e2e
```

The [command-line guide](./docs/reference/cli.md) explains when to use each
command and follows the workflow from scene development to deployment.

## Repository layout

```text
packages/    framework packages: core, compiler, TTS, player, ingredients, CLI
lessons/     lesson source projects and integration examples
docs/        authoring, reference, deployment, framework, decisions, and archives
e2e/         browser integration tests
```

Framework dependencies follow one enforced rule: `core` depends on nothing;
`compiler`, `tts`, `player`, and `ingredients` depend only on `core`; `cli` may
compose all packages. The runtime player never imports the compiler or TTS.

## Why this repository has continuous integration

The GitHub Actions workflow runs the same type checks, lint rules, dependency
checks, unit tests, and browser tests for every pull request and every push to the
main branch. It does not deploy lessons or call paid speech providers. The browser
tests use placeholder audio and run in Chromium and WebKit on Linux.

This is useful even for a small project because Narrable joins several parts that
can fail independently: compilation, generated artifacts, browser playback,
seeking, interaction, and assistant requests. The workflow also tests in an
environment different from the author's Mac. It can be removed if the repository
will never accept changes from another machine, but keeping it makes refactoring
safer and costs little beyond GitHub runner time.
