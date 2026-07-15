# Next Implementation Plan — Narrable

This plan contains only work that remains. The completed v0.1 vertical slice is
described in [README.md](./README.md); the durable architecture and invariants live
in [DESIGN.md](./DESIGN.md), especially §10.

## Starting point

The current baseline is `v0.1.0`: the bilingual unit-circle lesson is deployed,
the backpropagation lesson validates agent authoring on a second 2D topic, and the
hermetic unit and dual-browser end-to-end suites are green.

The next phases are deliberately ordered by unresolved product risk:

1. **M-bake** — make computed processes authorable and checkable.
2. **Backprop release** — prove M-bake in a real-voice deployed lesson.
3. **M4** — add performance capture for spatial choreography.
4. **M5** — prove the renderer and abstractions on a 3D lesson.

## Decisions for upcoming work

- Keep the five [DESIGN §10](./DESIGN.md#10-implementation-invariants-normative)
  invariants: value-at-time, text artifacts, deterministic builds, compiler-led
  feedback, and a framework-free hot path.
- Keep pnpm workspaces, direct `<audio>`, binary-search track lookup, sentence-level
  captions, and full-page preview reload until a measured problem justifies change.
- `@bake` is compiler-only. It must emit ordinary keyframes and require no player
  changes.
- M4 is development tooling. Recorded JSON tracks may ship; the recording UI may not.
- The 3D milestone creates the third authored lesson, after unit-circle and backprop.

---

## M-bake — computed processes

### Goal

Let a lesson express “advance this model one step” without running a parallel
offline simulation or pasting unchecked literals into the script.

The backprop lesson should be able to replace each literal weight update with a
build-time call to its real gradient-descent function. The compiler validates the
computed values, then emits the same ordinary value-at-time tracks the player
already consumes.

### Public contract

A scene exports named baker definitions:

```ts
export interface BakerDefinition {
  reads: string[];
  writes: string[];
  run(
    input: Readonly<Record<string, ParamValue>>,
    options: { steps: number },
  ): Array<Record<string, ParamValue>>;
}

export type Bakers = Record<string, BakerDefinition>;
```

Example:

```ts
export const bakers: Bakers = {
  descent: {
    reads: ["w11", "w12", "w21", "w22", "wo1", "wo2", "lr"],
    writes: ["w11", "w12", "w21", "w22", "wo1", "wo2"],
    run: (input, { steps }) => descentSteps(input, steps),
  },
};
```

The compiler passes only the declared `reads`, not the entire scene state. Every
returned step must contain exactly the declared `writes`. `reads` and `writes` must
name scene-schema parameters.

### Directive

```markdown
@bake(descent, steps: 1, over: 2s, ease: inOutCubic)
```

- `steps` is a positive integer and defaults to `1`.
- `over` is the total duration. It defaults to `manifest.defaults.transition × steps`.
- `ease` and `at` have the same meaning as on `@cue`.
- For `N` steps, endpoints are evenly spaced across `over`; each segment uses the
  selected easing.
- Repeat one-step directives when individual steps must align to separate narration
  beats. Use one multi-step directive only when even spacing is pedagogically right.

The backprop lesson will therefore keep its three natural speech anchors and use
three one-step `@bake` directives. The generic compiler fixture will separately
exercise a multi-step bake.

### Timing-independent authored state

`check` cannot depend on TTS timings. Bakers therefore consume **authored state**,
not the interpolated runtime value at an audio timestamp.

Authored state is evaluated once in script order:

1. Start with scene-schema defaults.
2. An ordinary cue or preset immediately updates the authored state to its target,
   regardless of its later transition duration.
3. A bake reads the current authored values declared in `reads`.
4. Each returned step updates authored state; the final step becomes the input to
   later directives.

A shared compiler pass must perform this evaluation for both `check` and `build` so
they cannot disagree. TTS timing affects only where the already-computed steps are
laid onto tracks.

If a resolved bake truncates an earlier runtime transition on one of its written
parameters, the existing overlap warning applies. This affects choreography, not
the baker's computation.

### Validation and determinism

`check` must report precise diagnostics when:

- the baker name is unknown;
- `steps` or another directive option is malformed;
- a declared read/write parameter does not exist;
- a returned step is missing a declared write or contains an undeclared write;
- a returned value has the wrong type or is outside its schema range;
- the baker throws; or
- two runs from cloned identical input produce different output.

Running twice is a useful nondeterminism guard, not a proof of purity. Bakers remain
contractually forbidden from using time, randomness, I/O, DOM state, or mutable
module state. Deterministic build and parity tests are the durable enforcement.

### Implementation increments

- **CBK.1 — contract and loading**
  - Add `BakerDefinition`/`Bakers` to core.
  - Load `bakers` with `schema`/`presets`/`constants`/`groups`.
  - Show baker names, reads, and writes in `lesson ref`.
- **CBK.2 — parse and validate**
  - Parse `@bake(name, steps:, over:, ease:, at:)`.
  - Add the shared authored-state evaluation pass.
  - Add diagnostics for names, options, output shape, values, throws, and unstable
    repeated output.
- **CBK.3 — expand**
  - Carry computed steps into expansion.
  - Emit evenly spaced segments through the existing animation/conflict machinery.
  - Keep the runtime artifact and player unchanged.
- **CBK.4 — backprop proof and docs**
  - Export the real descent baker from `lessons/backprop/scene.ts`.
  - Replace the three literal group cues with three one-step bakes at the same speech
    anchors and durations.
  - Update README and DESIGN grammar.

### Critical tests and exit criterion

- Diagnostic snapshots for every validation case above.
- Unit coverage for authored-state sequencing and multi-step time layout.
- Determinism: repeated compilation produces byte-identical output.
- Backprop parity: each computed weight vector matches the current literal vector
  within `1e-3`, and the losses remain approximately `0.142`, `0.040`, and `0.008`.
- Existing `state --drag` behavior remains unchanged over baked tracks.
- Full unit and dual-browser suites pass with no player changes.

**Exit:** backprop contains no pasted descent targets; `check` validates the real
computed updates; its narration-aligned choreography and interaction still work.

---

## Backprop release

After M-bake:

- Build backprop with its real ElevenLabs voice.
- Review frames across the full timeline and tune cue offsets against real prosody.
- Manually review drag behavior on desktop and touch.
- Bundle and deploy a static Hugging Face Space.
- Record any production findings before starting M4.

**Exit:** a public real-voice backprop lesson demonstrates build-time computation,
live recomputation, and `shared` ownership.

---

## M4 — record mode and fake cursor

- Add a development-only record toolbar.
- While draft audio plays, sample touched viewer-ownable parameters at 30 Hz.
- Simplify recorded tracks by dropping redundant collinear samples.
- Save/download `assets/<name>.track.json` as diffable text.
- Wire `@track(param, "name")` through CLI asset validation, loading, conflict
  checking, compilation, bundling, and playback.
- Record and replay an optional pointer track for a fake cursor.

Commit points:

- `C4.1` record toolbar and sampling.
- `C4.2` simplification and JSON export.
- `C4.3` end-to-end `@track` asset pipeline.
- `C4.4` fake cursor and a recorded choreography acceptance test.

**Exit:** camera choreography can be recorded, trimmed as JSON, rebuilt, and replayed
without shipping the recording UI.

---

## M5 — ingredients and first 3D lesson

- Add the three.js scene-host path.
- Grow ingredients only as demanded by the lesson: axes, grids, vectors, draggable
  points on curves/spheres, linked plot highlights, and scrub-able KaTeX numbers.
- Author a third lesson that exercises orbit cameras, quaternion parameters, nlerp,
  recorded camera choreography, and touch interaction.
- Measure which platform files changed and document the resulting v0.2 refactor,
  targeting less than 30% platform churn.

Commit points:

- `C5.1` three.js scene-host path.
- `C5.2` lesson-driven ingredient additions.
- `C5.3` scrub-able KaTeX number interaction.
- `C5.4` third lesson content and choreography.
- `C5.5` platform-delta report and focused v0.2 cleanup.

**Exit:** the 3D lesson ships with less than 30% platform change and proves the thin
quaternion/orbit paths in real content.

---

## Deferred until demanded

- Forced alignment for a human recording.
- Word-level/karaoke captions.
- Module-level Vite HMR.
- Turborepo or alternate monorepo orchestration.
- An audio abstraction beyond direct `<audio>`.
- Non-uniform step timings inside one `@bake`; use repeated one-step bakes first.
