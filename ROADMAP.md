# Narrable roadmap

This file contains future work only. Current capabilities belong in
[README.md](./README.md), and durable constraints belong in the
[architecture](./docs/framework/architecture.md).

## 1. Release and validate backprop

- Build the backprop lesson with its real voice.
- Review cue timing, frames, desktop interaction, and touch interaction.
- Deploy it as a public static Hugging Face Space.
- Record only findings that change the framework or authoring workflow.

**Done when:** the public lesson demonstrates build-time computation, live
recomputation, and `shared` ownership.

## 2. Performance capture

- Add a development-only record toolbar.
- Sample manipulated viewer-owned parameters and export compact JSON tracks.
- Implement `@track` validation, compilation, bundling, and playback.
- Support an optional recorded pointer track.

**Done when:** spatial choreography can be recorded, edited as text, rebuilt,
and replayed without shipping the recording UI.

## 3. Reusable 3D scene host

- Extract the optimizer lesson's local Three.js viewport into a reusable host.
- Add ingredients only when demanded by a real spatial lesson.
- Exercise orbit cameras, quaternion interpolation, recorded choreography, and
  touch interaction in that lesson.

**Done when:** the spatial lesson ships without requiring broad framework
changes.

## 4. External lesson projects

Keep framework and lessons together while the authoring contract is still
changing. Prepare an eventual split by:

- packaging the CLI and public scene APIs with explicit versions;
- building an external starter lesson against released packages in CI;
- defining compatibility and upgrade expectations;
- automating safe Hugging Face Space deployment; and
- retaining a minimal integration lesson in the framework repository.

Reconsider a separate lesson repository only after several lessons can be made
without simultaneous framework changes.

## Later, when demanded

- Forced alignment for human narration recordings.
- Word-level or karaoke captions.
- Module-level preview hot reload.
- Streaming and persistent assistant conversations.
- Non-uniform timing within a multi-step `@bake`.
