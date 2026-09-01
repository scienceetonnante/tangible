# Tangible

Tangible is a format for interactive lessons with an animated, manipulable
scene, narration generated from a text-to-speech model, and an optional language
model that can answer questions and manipulate the scene.

Tangible lessons can be deployed on Hugging Face Spaces.

## Installation

Tangible currently requires Node 22 or newer and pnpm. After cloning the
repository, install and build it once:

```bash
pnpm install
pnpm build
```

## Create a lesson

New lesson directory:

```bash
pnpm lesson new my-lesson --lesson lessons/my-lesson
```

For a complete first lesson, follow the
[creator quick start](./docs/quickstart.md).

## Create a lesson with a coding agent

The repository includes a `create-tangible-lesson` skill and instructions that
preserve the author's control of the teaching argument. Copy this prompt and
replace the bracketed text:

> Use `$create-tangible-lesson` and help me create a lesson about [subject]. The
> relationship I want learners to see is [relationship]. Build the smallest
> interactive scene first and stop for my review. Preserve my narration, turn
> my double-bracket hints into formal cues, and do not deploy until I explicitly
> authorize it.

The human owns the narration, teaching intent, and final visual judgment. The
agent implements the scene, translates natural-language hints into validated
cues, checks the lesson, and prepares builds.

### Build the scene

Build the interactive scene `scene.ts` in the `scenes` folder (or ask an agent to do it).

Open its narration-free preview:
```bash
pnpm lesson scene --lesson lessons/my-lesson
```

### Write the script

Create and edit the narration in `script.md`. Integrate commands for manipulating the scene (see *Narration directives* in `docs/reference`). You can write them directly or use hints like `[[Move the camera 90° and increase speed from 1 to 3]]` that an agent will convert to commands.

###  Validate and preview the integrated lesson:

```bash
pnpm lesson check --lesson lessons/my-lesson
pnpm lesson preview --offline --lesson lessons/my-lesson
```

Open <http://localhost:5179>. 
Offline mode synthesizes narration locally with Supertonic and uses a local
substitute for assistant answers. The first offline build downloads a pinned
123 MB speech model; later builds need no network connection or API key. This
voice lets you review cues, captions, seeking, pauses, layout, and interaction
against audible draft narration.

Use `--silent` instead of `--offline` when you need the former predictable
silent clock, such as in an automated test:

```bash
pnpm lesson build --silent --lesson lessons/my-lesson
```

When the narration and cue order are stable, remove `--offline` to synthesize
the configured production voice:

```bash
pnpm lesson preview --lesson lessons/my-lesson
```

### Deploy your lesson

Add a deployment target to `lesson.yaml` and keep the Space card in
`space/README.md`:

```yaml
deployment:
  provider: huggingface
  space: namespace/space-name
```

After reviewing the real narration locally, create the private Space with:

```bash
pnpm lesson deploy --lesson lessons/my-lesson --create
```

Assistant-enabled lessons are deployed even when the new Space does not yet have
a dedicated `HF_TOKEN` secret. The command then prints the Space settings URL
and explains that questions will not work until the secret is added. The same
command without `--create` publishes later updates. It builds the real voice,
uploads only the release artifact and Space card, waits for startup, and shows
logs when the Space fails.

Test playback, interaction, captions, and the assistant when enabled before
making the Space public. The complete process is described in
[Deploy to Hugging Face Spaces](./docs/authoring.md#deploy-to-hugging-face-spaces).

## Current viewing and accessibility support

Tangible's first release supports desktop and tablet layouts. A portrait phone
shows a clear request to rotate the device or use a larger screen instead of a
compressed lesson. Phone landscape remains available with a more compact
layout.

The standard playback and assistant controls work with a keyboard, include
visible focus indicators, and provide captions. The optimizer lesson also gives
its canvas a screen-reader description and identifies optimizer paths with
labels, marker shapes, and line patterns as well as color. Its sliders, toggles,
starting point, and camera are still drawn on a canvas and do not yet have
equivalent HTML controls. Keyboard and screen-reader users therefore cannot
operate every scene parameter. Equivalent controls are planned after the first
release.

## Documentation

- [Authoring a lesson](./docs/authoring.md) explains the complete workflow from
  scene development through narration, review, the optional lesson assistant,
  and deployment.
- [Reference](./docs/reference.md) documents commands, lesson files, scene
  exports, manifest fields, and narration directives.
- [Contributing](./docs/contributing.md) to the project.

## Example lessons

The repository includes three lessons that can be opened in offline mode:

- `unit-circle` is a compact 2D lesson and the primary integration example;
- `optimizers` is a navigable 3D optimizer comparison; and
- `python-sampler` contains an editable, browser-based Python example.

For example:

```bash
pnpm lesson preview --offline --lesson lessons/unit-circle
```

## Repository layout

```text
packages/    framework packages and command-line tools
lessons/     authored lessons and integration examples
docs/        authoring, reference, and contributor documentation
e2e/         browser integration tests
scripts/     repository maintenance and deployment helpers
```

A typical lesson directory contains:

```text
lesson.yaml          lesson and provider configuration
script.md            narration and scene directions
assistant.md         optional lesson-assistant guidance
assistant.eval.yaml  optional assistant evaluation cases
scenes/              scene entry module, supporting code, and tests
assets/              optional authored assets
space/               optional Hugging Face Space card files
```

The `build/` and `.cache/` directories are generated locally and must not be
edited or committed.
