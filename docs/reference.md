# Reference

This document collects the command-line, lesson-format, and narration-directive
reference for Tangible. Start with the [creator quick start](./quickstart.md) if
you are creating your first lesson, then use the
[authoring guide](./authoring.md) for production decisions.

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

Run `pnpm lesson --help` for a short overview or
`pnpm lesson help <command>` for common options and examples.

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

`--offline` prevents speech and answer provider calls. It synthesizes English
narration locally with a pinned, quantized Supertonic 3 model and uses the local
assistant substitute. The first offline build downloads a 123 MB model archive;
later builds use the shared local copy. The local voice is intended for quick
iteration, but its sentence-based character timings are approximate and still
need a final check against the production voice.

Use `--silent` when a build needs deterministic silent audio and must not
download the local speech model. Silent audio advances at 60 milliseconds per
written character. Automated tests use this option.

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
| `check` | Validate the runtime scene, `script.md`, cues, and assistant configuration without network calls. |
| `preview` | Rebuild changed files and serve the complete lesson locally. |
| `build` | Compile narration, captions, and animation tracks into `build/lesson/`. |
| `build --bundle` | Also create the deployable site in `build/site/`. |
| `state --at <t>` | Print the computed scene state at a lesson time in seconds. |
| `frame --at <t> -o <file>` | Render a PNG of the built lesson at a chosen time. |
| `serve` | Serve an existing bundle without rebuilding or watching source files. |
| `deploy --prepare --space <namespace/name>` | Create or complete local Space metadata without contacting Hugging Face. |
| `deploy` | Build real narration and publish the lesson to its configured Hugging Face Space. |
| `assistant-eval` | Inspect or run tracked assistant questions against a built lesson. |
| `assistant-eval-grade` | Grade a saved real evaluation with an independent OpenAI model. |

### Options

- `--lesson <dir>` selects the lesson directory.
- `--offline` uses local Supertonic narration and the local assistant substitute.
- `--silent` uses deterministic silent narration and the local assistant substitute.
- `--bundle` asks `build` to create the deployable site.
- `deploy --create` creates the configured Space privately before the first deployment.
- `deploy --dry-run` performs local release checks and builds without contacting Hugging Face.
- `deploy --prepare --space <namespace/name>` records the target and prepares
  the Space card and audio Git LFS rules without a remote operation.
- `--port <number>` and `--host <address>` set the local server address.
- `state --drag <param>=<value>` simulates learner interaction and
  reconciliation.
- `frame --size <width>x<height>` sets PNG dimensions.
- `assistant-eval --variant structured|legacy|both` selects an assistant prompt
  format for comparison.
- `assistant-eval --configuration <id>[,<id>]` runs only the named model
  configurations.
- `assistant-eval --case <id>[,<id>]` runs only the named cases.
- `assistant-eval --repeats <number>` overrides the file's repetition count.
- `assistant-eval --real` contacts the real answer provider.
- `assistant-eval-grade --input <file>` reads a saved real evaluation result.
- `assistant-eval-grade --configuration <id>[,<id>]` and `--case <id>[,<id>]`
  grade a selected subset.

`preview` and `serve` bind to `127.0.0.1` by default. Use `--host 0.0.0.0` only
when another device must reach the local server.

### Assistant evaluation

`assistant-eval` reads `assistant.eval.yaml` and existing `build/lesson/`
artifacts. Run a silent or offline build first. Without `--real`, it prints the
complete requests that would be sent to the provider and makes no network calls:

```bash
pnpm lesson build --silent --lesson lessons/my-lesson
pnpm lesson assistant-eval --lesson lessons/my-lesson -o assistant-eval.json
```

Use `--variant structured|legacy|both` only when comparing assistant prompt
formats. An evaluation file may define several model configurations, with
provider-specific request settings, and a repetition count. Cases and
configurations are interleaved so that changing provider conditions do not
systematically favor one configuration. `--real` requires `HF_TOKEN` and may
incur provider costs.

Each turn can include an authored rubric with reference facts, forbidden
claims, critical errors, and a scene policy. Successful answers are checked for
required or forbidden scene actions, preserved parameters, final-value
assertions, and exposed internal parameter names. The rubric is written to the
result for grading but is not included in the candidate model request.

Grade a saved real result separately:

```bash
pnpm lesson assistant-eval-grade \
  --input assistant-results.json \
  -o assistant-grades.json
```

This command uses `gpt-5.6-sol` with high reasoning effort and strict structured
output. It sends the question, conversation, visible state, answer, scene
actions, rubric, and deterministic checks. It does not send the candidate
configuration id or model name. The saved grade restores those identifiers so
scores can be summarized by configuration. The command requires
`OPENAI_API_KEY`, makes one paid judge request per gradeable turn, and records
judge failures without discarding other grades.

### Scene development without narration

`lesson scene` reads only `id` and `scene` from `lesson.yaml`. It loads the scene
from schema defaults, preserves interactions until reset or reload, and watches
lesson-local source dependencies. It does not read `script.md`, voice settings,
assistant context, or compiled lesson artifacts. Its temporary browser bundle is
stored in `build/scene-preview/`.

## Lesson files and manifest

### Authored files

```text
lesson.yaml             identity, visitor promise, defaults, voice provider, assistant
script.md               narration, natural-language hints, and formal directives
assistant.md            optional semantic assistant context
assistant.eval.yaml     optional tracked assistant question cases
scenes/
  scene.ts              scene entry module
  ...                   optional scene helpers, tests, and visual assets
assets/                 optional authored assets
```

`build/` and `.cache/` are generated and gitignored. Tangible currently assumes
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
promise: See how an angle on the unit circle determines its sine and cosine.
tags: [mathematics, trigonometry]
scene: ./scenes/scene.ts
defaults:
  anticipation: -0.2
  ease: inOutCubic
  transition: 1.0
tts:
  provider: elevenlabs
  voice: VOICE_ID
  model: eleven_multilingual_v2
  speed: 0.9
deployment:
  provider: huggingface
  space: example/lesson-space
```

`promise` is the one-sentence explanation shown on the lesson's start screen.
Tangible supplies the rest of that screen: the title, approximate duration,
Start button, interaction guidance, loading and failure states, and the
portrait-phone orientation notice. The framework shows this content in a
translucent card over the initial lesson scene and prevents scene interaction
until narration starts.

The optional `tags` list contains subject terms for Hugging Face discovery.
When Tangible creates a Space card, it removes duplicates and combines these
terms with the automatic `tangible`, `education`, and `interactive-learning`
tags. It also uses the promise as the start of the Space's short description and
appends “an interactive Tangible lesson.” An existing custom Space card remains
under the author's control.

The `tts` section is optional while a lesson is being developed with `--offline`
or `--silent`. A provider-backed preview and deployment require it. When present,
`tts.provider` supports `elevenlabs` and `hf-endpoint`. Both providers require a
`voice`. ElevenLabs also accepts an optional `model` and `speed`. The private
Hugging Face endpoint selects its own model and generation settings, so those
values are not declared by the lesson. `--offline` replaces provider speech
with the fixed local Supertonic voice, independently of the manifest voice.
`--silent` selects deterministic silent audio instead. The CLI loads gitignored
`.env` files from both the invocation directory and the lesson directory.

Offline and provider-backed builds require ffmpeg. Tangible converts provider
WAV or MP3 output into WebM/Opus and M4A/AAC-LC files, preserving the original
narration timing. The player asks the browser which format it supports and
downloads only that file. Hermetic `--silent` builds retain their small WAV and
do not require ffmpeg.

The local model is stored in the operating system's user cache and shared by
all lessons. Set `TANGIBLE_CACHE_DIR` to choose another Tangible cache root, or
set `TANGIBLE_SUPERTONIC_MODEL_DIR` to an already extracted model directory for
an air-gapped installation. Tangible verifies the archive checksum before
installing it and keeps the model's license file. The Supertonic model uses the
[OpenRAIL-M license](https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE).

Narration never autoplays. The player waits until its audio is ready and begins
only after the visitor presses Start.

`deployment.space` records the stable Hugging Face Space identifier in
`namespace/name` form. It is optional unless `lesson deploy` is used. Do not put
tokens, visibility, hardware, or deployment status in `lesson.yaml`; those are
remote Space settings.

### Scene exports

- `schema` defines the required parameters.
- `scene` is the runtime scene module.
- `presets` contains optional named parameter collections, including cameras.
- `constants` contains optional named values usable in cues.
- `groups` contains optional ordered parameter lists for compact coupled cues.
- `bakers` contains optional deterministic build-time computations.

Run `pnpm lesson ref --lesson <dir>` for the exact lesson-specific contract.

The runtime scene instance renders with `render(state, frame)`. `state` is the
complete visible parameter state. `frame.dt` is the elapsed rendering time, and
`frame.activity` maps currently manipulated parameter names to:

```ts
{
  source: "narration" | "user" | "assistant";
  strength: number; // zero to one
}
```

Animated narration tracks remain active for their complete transition. Instant
changes and completed transitions fade for a short period. User activity remains
active during a drag or scene-control write and then fades. Assistant activity
follows the temporary answer timeline. Scenes choose whether and how to render
this information; the player does not assume that a parameter is represented by
a slider or any other particular interface.

### Optional assistant

```yaml
assistant:
  provider: huggingface
  model: google/gemma-4-31B-it:cerebras
  context: assistant.md
  startOpen: true
  commandable: [theta, show.projection]
```

The `model` is a Hugging Face router model identifier and may include an
inference-provider suffix. The context describes the scene, controls,
terminology, and answer guidance. Only allowlisted parameters may be returned
by the provider. Assistant-enabled bundles include a same-origin server; other
lessons remain static. See
[the assistant section of the authoring guide](./authoring.md#add-a-lesson-assistant).
`startOpen: true` displays the question field immediately when the viewport has
room. The player keeps the panel collapsed on phone-width or short-landscape
viewports. The field is optional and defaults to `false`.
The optional nested `assistant.limits` block records all request, response,
traffic, queue, and provider-timeout values. See
[Configure assistant limits](./authoring.md#configure-assistant-limits) for the
complete block and its defaults. `lesson check` rejects invalid limit values
before a provider is called.

An optional `assistant.eval.yaml` records model configurations, representative
question sequences, lesson times, state overrides, and repetitions for
`lesson assistant-eval`. It is a review artifact rather than part of the
deployed lesson.

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
@camera(target: [0, 0.5, 0], distance: 7, azimuth: -45°, elevation: 30deg)
@camera(azimuth: 45, over: 2s)
```

`@camera` accepts either a named scene preset or inline orbit-camera fields.
The fields are `target: [x, y, z]`, `distance`, `azimuth`, and `elevation`.
`target` contains three numbers and `distance` must be positive. Angles may use
`deg` or `°`; a number without a unit also means degrees.

An inline directive may provide only the fields that change. Missing fields keep
their latest authored values, starting from the camera default in the scene
schema. The compiler resolves every partial directive to a complete camera value
at build time, so it never depends on camera movement made by the learner.

Orbit interpolation follows the shortest path between two viewing directions.
A complete turn therefore needs intermediate camera directives rather than one
directive whose final angle differs from its initial angle by 360 degrees.

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

Board content belongs to the script rather than the scene schema. The player
renders it as an overlay in the rightmost 28 percent of the player by default.
Scene authors must reserve that area in the visual composition so equations and
notes do not cover important scene content or interactive controls. A lesson may
change the board's bounds with scoped `.xv-board` CSS, but there is currently no
scene export for declaring those bounds.

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
