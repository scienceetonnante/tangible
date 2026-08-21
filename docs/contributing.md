# Contributing to Narrable

This guide covers framework code under `packages/`, shared tooling, and browser
integration tests. Lesson production follows [the authoring guide](./authoring.md).

## Setup

Prerequisites are Node 22 or newer and pnpm.

```bash
pnpm install
pnpm build
pnpm check
pnpm test:e2e
```

`pnpm check` runs TypeScript compilation, ESLint, package-boundary checks, and
unit tests. The end-to-end suite uses local provider substitutes and requires no
credentials.

## Repository layout

```text
packages/    framework packages
lessons/     lesson sources and integration examples
docs/        authoring, contributing, and reference documentation
e2e/         browser integration tests
```

## Architecture

Narrable has three layers:

```text
script.md ─────────┐
                   ├─ compiler ─► audio + tracks.json + captions.vtt
scenes/scene.ts ───┘                         │
                                            ▼
                    player: audio clock ► state ◄ learner interaction
                                                    │
                                                    ▼
                                          scene render = f(state)
```

The authoring format and scene schema are compiler inputs. The compiler validates
them, resolves narration-relative cues, and emits static tracks. The browser
player consumes the built artifacts and scene bundle. It does not parse scripts
or call speech providers.

During scene development, the CLI bundles `scenes/scene.ts` directly into a
browser preview. This path initializes state from schema defaults and uses the
player package's scene host and interaction code. It does not construct a lesson
player or involve scripts, tracks, audio, or providers.

## Package boundaries

- `core` contains schemas, types, interpolation, easing, and reconciliation
  mathematics. It depends on nothing.
- `compiler` contains parsing, validation, authored-state evaluation, timing
  resolution, track expansion, and artifact emission.
- `tts` contains the offline substitute, ElevenLabs, and private endpoint
  adapters.
- `player` contains the clock, state composition, interaction, board, captions,
  and playback controls.
- `ingredients` contains reusable scene helpers.
- `cli` is the composition root and may depend on every framework package.

`compiler`, `tts`, `player`, and `ingredients` may depend only on `core`. The
player never imports the compiler, speech providers, or authored scripts. These
rules are enforced by `scripts/check-boundaries.mjs`.

## Invariants

Violations of these rules are bugs:

1. **Value at time.** Every authored parameter can be evaluated directly at
   lesson time `t`. Playback never needs to replay history from zero.
2. **Text-owned source.** Authored state is stored in readable, diffable text.
   Generated artifacts are JSON, VTT, JavaScript, HTML, and audio.
3. **Deterministic builds.** The same authored inputs and cached provider results
   produce byte-identical outputs.
4. **Compiler-led feedback.** `lesson check` finds authoring errors without
   provider calls and reports useful source locations.
5. **Framework-free hot path.** The animation loop works on plain state. Signals
   are used at DOM boundaries, not as a per-frame rendering framework.

## Parameter ownership

- `script` values temporarily yield to learner interaction and then glide back
  to the narration timeline.
- `shared` values preserve a learner change until the next scripted write.
- `viewer` values stop following the script after learner interaction during the
  current session. Cameras normally use this mode.

Pausing freezes modified values. Resuming gives `script` values a fresh
playback-time hold. Seeking clears interaction state. Assistant commands are a
temporary display overlay, not another ownership mode.

## Build-time computation

Scene-exported bakers may compute coupled processes such as optimizer steps.
`@bake` runs during checking and compilation and turns absolute outputs into
ordinary tracks. Baker code never runs in the player.

## Assistant boundary

An optional same-origin lesson server sends one request to a written-answer
provider. It assembles a readable system message from the authored assistant
guide, scene contract, named references, script, and answer rules. It does not
dump the raw build artifact into the prompt or repeat generated narration beside
the script.

The current user message contains a semantic lesson position, visible scene
state, and provenance for values temporarily left by the preceding answer. The
position includes only the latest chapter, current or most recent narration cue,
and active pause prompt. It never reveals future narration. Up to eight
successful page-local turns precede the current message, and the server does not
persist this history.

The provider receives no tools. A strict JSON schema and server validation bound
the returned written beats and allowlisted absolute scene values. Provider
credentials remain on the server. The temporary answer timeline disappears when
playback resumes or another question begins.

## Working conventions

- Preserve the invariants above.
- Keep package dependencies within the enforced boundaries.
- Prefer direct, readable implementations over new abstraction layers.
- Add tests for behavior that is correctness-critical or difficult to inspect.
- Keep scene schemas loadable without a DOM.
- Keep provider credentials out of browser bundles.
- Use a real lesson to validate changes to the authoring contract.
- Update [the authoring guide](./authoring.md) or
  [the reference](./reference.md) when behavior changes.
- Check [the roadmap](../ROADMAP.md) before expanding scope.

Run `pnpm boundaries` after dependency changes. Run `pnpm check` for every
framework change. Run `pnpm test:e2e` when changing the player, bundling, browser
interaction, or end-to-end authoring behavior.

## Provider credentials

Real narration and live assistant calls are optional. Store credentials in a
gitignored root or lesson-local `.env` file:

```text
ELEVENLABS_API_KEY=...
HF_TOKEN=...
TTS_ENDPOINT_URL=...
HF_TTS_TOKEN=...
```

Never use real providers in automated tests or continuous integration.

## Continuous integration

The GitHub Actions workflow runs type checks, lint rules, dependency checks,
unit tests, and browser tests for every pull request and every push to the main
branch. It does not deploy lessons or call paid providers. Browser tests use
placeholder audio and run in Chromium and WebKit on Linux.

This catches integration failures across compilation, generated artifacts,
browser playback, seeking, interaction, and assistant requests. It also tests in
an environment different from the author's development machine.
