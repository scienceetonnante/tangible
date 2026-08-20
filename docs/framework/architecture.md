# Framework architecture

This document describes the current system and its normative invariants. 
For the historical investigation and original proposal, see archives.

## System boundary

Narrable has three layers:

```text
script.<lang>.md ─┐
                  ├─ compiler ─► audio + tracks.json + captions.vtt
scene.ts ─────────┘                         │
                                           ▼
                    player: audio clock ► state ◄ learner interaction
                                                    │
                                                    ▼
                                          scene render = f(state)
```

The authoring format and scene schema are inputs. The compiler validates them,
resolves narration-relative cues, and emits static tracks. The browser player
consumes built artifacts and a scene bundle; it does not parse scripts or call
TTS providers.

During scene development, the CLI can bundle `scene.ts` directly into a browser
preview. This development path initializes state from schema defaults and uses
the player package's scene host and interaction code, but it does not construct a
lesson player or involve scripts, tracks, audio, or providers.

## Package boundaries

- `core`: schema, types, interpolation, easing, and reconciliation math;
- `compiler`: parsing, validation, authored-state evaluation, timing resolution,
  track expansion, and artifact emission;
- `tts`: fake, ElevenLabs, and private endpoint adapters;
- `player`: clock, state composition, interaction, board, captions, and chrome;
- `ingredients`: reusable scene helpers;
- `cli`: authoring commands and composition root.

`core` depends on nothing. `compiler`, `tts`, `player`, and `ingredients` may
depend only on `core`. `cli` may depend on all framework packages. These rules are
checked by `scripts/check-boundaries.mjs`.

## Normative invariants

Violations of these rules are bugs:

1. **Value at time.** Every authored parameter can be evaluated directly at
   lesson time `t`; playback never has to replay history from zero.
2. **Text-owned source.** Authored state is stored in diffable text. Generated
   artifacts are JSON, VTT, JavaScript, HTML, and audio.
3. **Deterministic builds.** The same authored inputs and cached provider results
   produce byte-identical outputs.
4. **Compiler-led feedback.** `lesson check` catches authoring errors without
   network calls and reports useful source locations.
5. **Framework-free hot path.** The animation loop works on plain state. Signals
   are used at DOM boundaries, not as a per-frame rendering framework.

## Parameter ownership

- `script`: learner changes hold temporarily and then glide back to narration;
- `shared`: a learner change persists until the next scripted write;
- `viewer`: after learner interaction, the scripted track no longer owns the
  value for that session. Cameras normally use this mode.

Pausing freezes modified values. Resuming gives `script` values a fresh
playback-time hold. Seeking clears interaction state. Assistant commands are a
temporary display overlay, not another ownership mode.

## Build-time computation

Scene-exported bakers may compute coupled processes such as optimizer steps.
`@bake` runs them during checking and compilation and turns their absolute outputs
into ordinary tracks. Baker code never runs in the player.

## Assistant boundary

An optional same-origin lesson server sends one request to a written-answer
provider. It validates a bounded sequence of text beats and allowlisted absolute
scene values. Provider credentials remain on the server. The temporary answer
timeline disappears when playback resumes or another question begins.
