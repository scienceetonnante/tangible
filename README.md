# Narrable

Narrable is a new format of interactive lessons involving an animated and interactable scene, a narrated voice-over build from a TTS model, and optionnaly an LLM that can answer questions and manipulate the scene. 

Narrable lessons can be deployed on 🤗·HuggingFace Space.

## Installation

Narrable currently requires Node 22 or newer and pnpm. After cloning the
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
Offline mode creates predictable silent audio and does not call a speech or answer provider. It lets you test cues, captions,
seeking, pauses, layout, and interaction without an API key. 

When the narration and cue order are stable, remove `--offline` to synthesize the voice:

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

Assistant-enabled lessons stop before their first upload until the new Space has
a dedicated `HF_TOKEN` secret. Add the secret, then rerun without `--create`.
The same command without `--create` publishes later updates. It builds the real
voice, uploads only the release artifact and Space card, waits for startup, and
shows logs when the Space fails.

Test playback, interaction, captions, and the assistant when enabled before
making the Space public. The complete process is described in
[Deploy to Hugging Face Spaces](./docs/authoring.md#deploy-to-hugging-face-spaces).

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
