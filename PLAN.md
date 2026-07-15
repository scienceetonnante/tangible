# Next Implementation Plan — Narrable

This plan contains only work that remains. The completed v0.1 vertical slice is
described in [README.md](./README.md); the durable architecture and invariants live
in [DESIGN.md](./DESIGN.md), especially §10.

## Starting point

The current baseline includes the completed M-bake compiler milestone: the bilingual
unit-circle lesson is deployed, and backpropagation uses its real gradient-descent
function for three build-time computed steps. The hermetic unit and dual-browser
end-to-end suites are green.

The next phases are deliberately ordered by unresolved product risk:

1. **Backprop release** — prove M-bake in a real-voice deployed lesson.
2. **M4** — add performance capture for spatial choreography.
3. **M5** — prove the renderer and abstractions on a 3D lesson.

## Decisions for upcoming work

- Keep the five [DESIGN §10](./DESIGN.md#10-implementation-invariants-normative)
  invariants: value-at-time, text artifacts, deterministic builds, compiler-led
  feedback, and a framework-free hot path.
- Keep pnpm workspaces, direct `<audio>`, binary-search track lookup, sentence-level
  captions, and full-page preview reload until a measured problem justifies change.
- M4 is development tooling. Recorded JSON tracks may ship; the recording UI may not.
- The 3D milestone creates the third authored lesson, after unit-circle and backprop.

## Backprop release

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
