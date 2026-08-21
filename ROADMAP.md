# Narrable roadmap

This file contains future work only. Current capabilities belong in
[README.md](./README.md), and durable constraints belong in the architecture
section of [the contributor guide](./docs/contributing.md#architecture).

## 1. Performance capture

- Add a development-only record toolbar.
- Sample manipulated viewer-owned parameters and export compact JSON tracks.
- Implement `@track` validation, compilation, bundling, and playback.
- Support an optional recorded pointer track.

**Done when:** spatial choreography can be recorded, edited as text, rebuilt,
and replayed without shipping the recording UI.

## 2. Reusable 3D scene host

- Extract the optimizer lesson's local Three.js viewport into a reusable host.
- Add ingredients only when demanded by a real spatial lesson.
- Exercise orbit cameras, quaternion interpolation, recorded choreography, and
  touch interaction in that lesson.

**Done when:** the spatial lesson ships without requiring broad framework
changes.

## 3. External lesson projects

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
