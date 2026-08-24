# Reference

This document collects the command-line, lesson-format, and narration-directive
reference for Narrable. Start with [the authoring guide](./authoring.md) if you
are creating your first lesson.

## Command line

Build the framework once after cloning the repository or changing framework
code:

```bash
pnpm build
```

All lesson commands then have the same basic form:

```bash
pnpm lesson <command> --lesson lessons/my-lesson
```

`--lesson` selects the lesson directory. You may omit it when your terminal is
already inside that directory.

### Typical command sequence

Create a lesson directory:

```bash
pnpm lesson new my-lesson --lesson lessons/my-lesson
```

Run the `scenes/scene.ts` entry module by itself while building the interaction:

```bash
pnpm lesson scene --lesson lessons/my-lesson
```

After writing `script.md`, validate and preview the integrated lesson:

```bash
pnpm lesson check --lesson lessons/my-lesson
pnpm lesson preview --offline --lesson lessons/my-lesson
```

`--offline` prevents speech and answer provider calls. It creates silent
placeholder audio at a fixed rate of 60 milliseconds per written character. The
placeholder gives the player a predictable clock for testing cues, captions,
seeking, pauses, and interaction. It cannot validate timing against real speech.

Remove `--offline` to synthesize or reuse the configured voice:

```bash
pnpm lesson preview --lesson lessons/my-lesson
```

Provider results are cached. Changing only cues does not synthesize unchanged
narration again. A real voice may require credentials in a gitignored `.env`
file.

Create a deployable site with:

```bash
pnpm lesson build --bundle --lesson lessons/my-lesson
```

Compiled lesson files go to `build/lesson/`. The deployable site goes to
`build/site/`. Both directories are generated.

### Commands

| Command | Purpose |
|---|---|
| `new <id>` | Create `lesson.yaml`, `script.md`, `scenes/scene.ts`, and an assets directory. |
| `scene` | Run the interactive scene alone while it is being built. |
| `ref` | Print scene parameters, ranges, presets, groups, constants, and bakers. |
| `check` | Validate `script.md`, scene cues, and assistant configuration without network calls. |
| `preview` | Rebuild changed files and serve the complete lesson locally. |
| `build` | Compile narration, captions, and animation tracks into `build/lesson/`. |
| `build --bundle` | Also create the deployable site in `build/site/`. |
| `state --at <t>` | Print the computed scene state at a lesson time in seconds. |
| `frame --at <t> -o <file>` | Render a PNG of the built lesson at a chosen time. |
| `serve` | Serve an existing bundle without rebuilding or watching source files. |
| `assistant-eval` | Inspect or run tracked assistant questions against a built lesson. |

### Options

- `--lesson <dir>` selects the lesson directory.
- `--offline` prevents provider calls and uses deterministic local substitutes.
- `--bundle` asks `build` to create the deployable site.
- `--port <number>` and `--host <address>` set the local server address.
- `state --drag <param>=<value>` simulates learner interaction and
  reconciliation.
- `frame --size <width>x<height>` sets PNG dimensions.
- `assistant-eval --variant structured|legacy|both` selects an assistant prompt
  format for comparison.
- `assistant-eval --real` contacts the real answer provider.

`preview` and `serve` bind to `127.0.0.1` by default. Use `--host 0.0.0.0` only
when another device must reach the local server.

### Assistant evaluation

`assistant-eval` reads `assistant.eval.yaml` and existing `build/lesson/`
artifacts. Run an offline build first. Without `--real`, it prints the complete
requests that would be sent to the provider and makes no network calls:

```bash
pnpm lesson build --offline --lesson lessons/my-lesson
pnpm lesson assistant-eval --lesson lessons/my-lesson -o assistant-eval.json
```

Use `--variant structured|legacy|both` only when comparing assistant prompt
formats. `--real` requires `HF_TOKEN` and may incur provider costs.

### Scene development without narration

`lesson scene` reads only `id` and `scene` from `lesson.yaml`. It loads the scene
from schema defaults, preserves interactions until reset or reload, and watches
lesson-local source dependencies. It does not read `script.md`, voice settings,
assistant context, or compiled lesson artifacts. Its temporary browser bundle is
stored in `build/scene-preview/`.

## Lesson files and manifest

### Authored files

```text
lesson.yaml             identity, defaults, voice provider, assistant
script.md               narration, natural-language hints, and formal directives
assistant.md            optional semantic assistant context
assistant.eval.yaml     optional tracked assistant question cases
scenes/
  scene.ts              scene entry module
  ...                   optional scene helpers, tests, and visual assets
assets/                 optional authored assets
```

`build/` and `.cache/` are generated and gitignored. Narrable currently assumes
that every lesson is in English. A lesson has one script, one voice, one set of
captions, one assistant guide, and one scene entry module.

Chapters are markers on the narration timeline. They do not correspond to scene
files. The plural `scenes/` directory groups the entry module with any supporting
scene code and assets. A scene can expose several named visual modes through its
`scene` schema parameter; `@scene(name)` changes that parameter within the same
entry module.

### Manifest

A minimal `lesson.yaml` is:

```yaml
id: unit-circle
title: The unit circle
scene: ./scenes/scene.ts
voice: elevenlabs:VOICE_ID
defaults:
  anticipation: -0.2
  ease: inOutCubic
  transition: 1.0
tts:
  speed: 0.9
player:
  autoplay: true
```

Voice specifications support `elevenlabs:<voice-id>` and
`hf-endpoint:<voice-id>`. `--offline` replaces provider speech with
deterministic silent audio. The CLI loads gitignored `.env` files from both the
invocation directory and the lesson directory.

`player.autoplay` asks the browser to start the narrated lesson when it loads.
Browsers may reject audible autoplay; when that happens, Narrable shows a
`Start Lesson` overlay whose click supplies the required learner interaction.

### Scene exports

- `schema` defines the required parameters.
- `scene` is the runtime scene module.
- `presets` contains optional named parameter collections, including cameras.
- `constants` contains optional named values usable in cues.
- `groups` contains optional ordered parameter lists for compact coupled cues.
- `bakers` contains optional deterministic build-time computations.

Run `pnpm lesson ref --lesson <dir>` for the exact lesson-specific contract.

### Optional assistant

```yaml
assistant:
  context: assistant.md
  commandable: [theta, show.projection]
```

The context describes the scene, controls, terminology, and answer guidance.
Only allowlisted parameters may be returned by the provider. Assistant-enabled
bundles include a same-origin server; other lessons remain static. See
[the assistant section of the authoring guide](./authoring.md#add-a-lesson-assistant).

An optional `assistant.eval.yaml` records representative question sequences,
lesson times, and state overrides for `lesson assistant-eval`. It is a review
artifact rather than part of the deployed lesson.

## Narration directives

Narration is Markdown. Prose is spoken verbatim. Front matter, double-bracket
hints, and formal directives are stripped before speech synthesis and captions.
Inline directives anchor to the onset of the next word. Block directives occupy
their own line.

### State cues

```markdown
@cue(theta = 0)                         instant assignment
@cue(theta -> 3.14, over: 2s)           animated assignment
@cue(theta -> HALF_PI, ease: linear)     named constant and easing
@cue(weights -> [0.1, 0.2, 0.3])        named parameter group
```

Options are `over: <seconds>`,
`ease: linear|inOutCubic|inCubic|outCubic|spring`, and
`at: +0.5s|-0.2s|sentence-end`. Values are absolute and validated against the
scene schema.

Convenience directives are:

```markdown
@show(projection, cosLabel)
@hide(projection)
@camera(sideView, over: 3s)
```

### Structure and pauses

```markdown
@scene(main)
@chapter(Why the path zigzags)
@pause(prompt: "Find where SGD becomes unstable.")
@pause(prompt: "Explore before continuing.", speak: false)
```

A spoken pause inserts its prompt into narration and stops at the prompt
boundary. A silent pause stops without adding text. The normal play control
resumes.

### Board

```markdown
@board(loss: $L = (y - \hat y)^2$)
@board(note: "The update follows the negative gradient.")
@highlight(loss.term)
@dim(loss)
@clear(loss)
@clear(board)
```

KaTeX subexpressions are addressed through `\htmlClass{name}{...}` tags.

### Build-time computation

```markdown
@bake(descent, steps: 3, over: 6s, ease: inOutCubic)
```

The named scene baker receives its declared reads and returns exactly its
declared writes. The compiler validates and expands the result into ordinary
keyframes. Repeat one-step bakes when each update needs a separate narration
anchor.

### Natural-language hints

Double brackets let a human describe choreography before the scene contract is
known:

```markdown
[[Reveal the projection as the narrator says "horizontal".]]
```

The implementing agent translates these hints into formal syntax.
