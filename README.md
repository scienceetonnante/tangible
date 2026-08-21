# Narrable

Narrable helps authors create narrated interactive lessons. A recorded voice
guides a live 2D or 3D scene, while learners remain free to manipulate the model
and watch its connected representations update.

The authoring process starts with the scene, not a planning document:

1. Build and test `scene.ts` as an interactive website.
2. Write the spoken narration in `script.md`.
3. Add optional `[[scene hints]]` near the sentences they support.
4. Ask an agent to translate those hints into timed animation cues.
5. Review the complete lesson, tune it against the real voice, and deploy it.

The human owns the narration, teaching intent, and final judgment. The agent can
implement the scene, integrate choreography, validate the result, and prepare an
authorized deployment.

## Create a lesson

Narrable currently requires Node 22 or newer and pnpm. After cloning the
repository, install and build it once:

```bash
pnpm install
pnpm build
```

Create a lesson directory:

```bash
pnpm lesson new my-lesson --lesson lessons/my-lesson
```

Build the scene first and open its narration-free preview:

```bash
pnpm lesson scene --lesson lessons/my-lesson
```

Once `script.md` exists, validate and preview the integrated lesson:

```bash
pnpm lesson check --lesson lessons/my-lesson
pnpm lesson preview --offline --lesson lessons/my-lesson
```

Open <http://localhost:5179>. Offline mode creates predictable silent audio and
does not call a speech or answer provider. It lets you test cues, captions,
seeking, pauses, layout, and interaction without an API key. It cannot tell you
whether animation timing feels right against a real voice.

When the narration and cue order are stable, remove `--offline` to synthesize or
reuse the configured voice:

```bash
pnpm lesson preview --lesson lessons/my-lesson
```

Narrable currently assumes that every lesson is in English.

## Documentation

- [Authoring a lesson](./docs/authoring.md) explains the complete workflow from
  scene development through narration, review, the optional lesson assistant,
  and deployment.
- [Reference](./docs/reference.md) documents commands, lesson files, scene
  exports, manifest fields, and narration directives.

## Example lessons

The repository includes three lessons that can be opened in offline mode:

- `unit-circle` is a compact 2D lesson and the primary integration example;
- `optimizers` is a navigable 3D optimizer comparison; and
- `python-sampler` contains an editable, browser-based Python example.

For example:

```bash
pnpm lesson preview --offline --lesson lessons/unit-circle
```
