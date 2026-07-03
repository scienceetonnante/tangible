# Explorable Video

A platform for **interactive ("explorable") narrated video** — lessons that are a live 2D/3D scene driven by a recorded voiceover, where the learner can grab the canvas, drag a parameter, or scrub a value at any time and watch everything recompute, then glides back to whatever the narration has reached. Think of the 3blue1brown + Ben Eater quaternion series, but authored from a single **text script** instead of performance capture.

- **[DESIGN.md](./DESIGN.md)** — what the medium is and why (primer + architecture rationale).
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the implementation blueprint (data formats, modules, algorithms).
- **[PLAN.md](./PLAN.md)** — phased build plan with current status.

> Naming note: the project's package scope is `@narrable/*`; the CLI command is `lesson`.

## Status

The vertical slice (a "unit circle" lesson) works end to end: compile a script → synthesize audio (ElevenLabs or a fake adapter) → play, seek, drag-and-catch-up, board equations, captions, and narrated pause checkpoints — verified in Chromium and WebKit (Safari's engine). Deploy and the second lesson are still to come. See **[PLAN.md](./PLAN.md)** for the detailed checklist.

## How it works

Three layers with a hard separation (DESIGN §5):

```
script.md ─┐
           ├─ compile ─► tracks.json + captions.vtt + audio.(m4a|wav)
scene.ts ──┘                              │
                                          ▼
              player (shared): <audio> clock ► interpolator ► state ◄ interaction
                                                                 │
                                                                 ▼
                                                       scene render = f(state)
```

Every parameter's value is a pure function of time `t` (**value-at-time**), which is what makes seeking, catch-up, and headless frame rendering possible. The compiler bakes all easing/timing into dense keyframe tracks; the runtime just looks up and interpolates.

## Repository layout

```
packages/
  core/         shared types, schema, easing, the value-at-time interpolator, reconciliation math
  compiler/     script.md → tracks.json + captions.vtt (parse→check→synthesize→resolve→expand→emit)
  tts/          TTS adapters: fake (deterministic) and ElevenLabs (with-timestamps)
  player/       browser runtime: clock, store, timeline, reconciler, interaction, board, captions, chrome
  ingredients/  reusable scene helpers (e.g. camera-orbit handle)
  cli/          the `lesson` command
lessons/
  unit-circle/  the first lesson: lesson.yaml, scene.ts, script.en.md (+ script.fr.md)
e2e/            Playwright browser tests (Chromium + WebKit)
```

Dependency rule (enforced by `scripts/check-boundaries.mjs`): `core` depends on nothing; `compiler`/`tts`/`player`/`ingredients` depend on `core` only; `cli` depends on everything. **`player` never imports `compiler` or `tts`** — the runtime consumes only built artifacts.

## Prerequisites

- **Node ≥ 22**
- **pnpm** (`corepack enable pnpm`)

## Setup

```bash
pnpm install
pnpm build        # compile all packages (tsc --build)
```

Optional, for real voice synthesis — create a `.env` at the repo root (gitignored):

```
ELEVENLABS_API_KEY=sk_...your_key...
```

## Quick start

Build and preview the unit-circle lesson:

```bash
pnpm build

# Compile the lesson (uses ElevenLabs if a key + voice IDs are set, else pass --fake)
node packages/cli/dist/index.js build --bundle --lesson lessons/unit-circle

# Serve it with live-reload (open http://localhost:5179)
node packages/cli/dist/index.js preview --lesson lessons/unit-circle
```

For a free/offline authoring loop (silent placeholder audio, no API calls) add `--fake` to `build`/`preview`.

## The `lesson` CLI

Run as `node packages/cli/dist/index.js <command>` (after `pnpm build`).

| Command | What it does |
|---|---|
| `new <id>` | Scaffold a lesson directory (manifest, template scene, script skeleton). |
| `check [--lang en]` | Parse + validate a script against the scene schema. No network. Non-zero exit on error. The fast authoring/agent loop. |
| `build [--lang en] [--bundle] [--fake]` | Full pipeline → `build/<lang>/`. `--bundle` also emits a static site under `build/site/`. `--fake` uses the deterministic fake voice. |
| `preview [--fake]` | Serve the static bundle with file-watch + browser live-reload. |
| `frame --at <t> -o <file.png> [--lang en] [--size WxH]` | Headless-render the lesson at time `t` to a PNG (deterministic). |
| `state --at <t> [--lang en] [--drag p=v]` | Print the full scene state at time `t` as JSON (no browser). With `--drag <param>=<value>`, simulate a viewer grabbing that param at `t` and print the reconciled hold-then-glide trajectory (scripted vs displayed) — a headless check of interaction/`shared` behavior. |
| `ref` | Emit the scene's **cue-reference sheet** (params, presets, constants) as Markdown. |

Common flags: `--lesson <dir>` (defaults to the current directory), `--lang <code>`.

## Authoring a lesson

A lesson is a directory with three authored files:

- **`lesson.yaml`** — manifest: id, title, scene path, languages, per-language voices, defaults, and TTS settings:

  ```yaml
  id: unit-circle
  title: { en: The unit circle }
  scene: ./scene.ts
  languages: [en]
  voice:
    en: elevenlabs:YOUR_VOICE_ID
  defaults:
    anticipation: -0.2   # seconds; cues slightly precede the word they illustrate
    ease: inOutCubic
    transition: 1.0
  tts:
    speed: 0.9           # ElevenLabs speaking rate: 0.7 (slow) .. 1.2 (fast)
  ```

- **`scene.ts`** — the visualization: a parameter `schema`, optional `presets`/`constants`, and a `scene` module that renders as a pure function of state.

- **`script.<lang>.md`** — narration prose with embedded directives. Prose is spoken verbatim; directives are stripped and anchored to the word that follows them. A taste:

  ```markdown
  @scene(circle)
  @chapter(The circle and the angle)

  Watch what happens when we let it @cue(theta -> 6.2832, over: 4s) vary.
  @show(projection) Its projection onto the horizontal axis is
  @cue(show.cosLabel = true) the cosine. @board(cosdef: $x = \cos\theta$)

  @pause(prompt: "Drag the red point yourself and watch the cosine.")
  ```

  Directives include `@cue` (assign parameters, instant `=` or animated `-> … over: … ease: …`), `@show`/`@hide`, `@camera`, `@scene`, `@chapter`, `@board`/`@highlight`/`@dim`/`@clear`, and `@pause` (a narrated checkpoint — the prompt is spoken, then the box appears; add `speak: false` to keep it silent). Full grammar in [DESIGN.md §6](./DESIGN.md).

Run `lesson ref` on a scene to get the exact parameters, ranges, and presets you can drive.

## Development

```bash
pnpm check      # typecheck + lint + dependency boundaries + unit tests (hermetic)
pnpm test       # Vitest unit tests
pnpm test:e2e   # Playwright browser tests (Chromium + WebKit)
```

CI (`.github/workflows/ci.yml`) runs the same, hermetically — **fake TTS, no network, no API keys**. Real ElevenLabs synthesis only happens on a local `build` when a key is present.

Handy checks without a browser: `lesson state --at <t>` (numeric state) and `lesson frame --at <t> -o f.png` (visual). Because state is a pure function of `t`, both are deterministic.
