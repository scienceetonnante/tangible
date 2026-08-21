# Command-line guide

Build the framework once after cloning the repository or changing framework code:

```bash
pnpm build
```

All lesson commands then have the same basic form:

```bash
pnpm lesson <command> --lesson lessons/my-lesson
```

The `--lesson` option tells the command which lesson directory to use. You may
omit it when your terminal is already inside that directory.

## The usual workflow

Create a lesson directory once:

```bash
pnpm lesson new my-lesson --lesson lessons/my-lesson
```

While building `scene.ts`, run the scene by itself:

```bash
pnpm lesson scene --lesson lessons/my-lesson
```

This preview has no narration, timeline, captions, or speech-provider calls. Run
`lesson ref` in another terminal when you need a list of the parameters and named
values that the narration can control.

After writing `script.md`, validate it and preview the integrated lesson:

```bash
pnpm lesson check --lesson lessons/my-lesson
pnpm lesson preview --offline --lesson lessons/my-lesson
```

`--offline` means that Narrable does not call a speech or answer provider. It
creates silent placeholder audio at a fixed rate of 60 milliseconds per written
character. The placeholder supplies a predictable clock, so you can test cue
order, seeking, captions, pauses, and interaction. It cannot tell you whether a
cue feels well timed against the rhythm of a real voice.

When the narration and cue order are stable, remove `--offline` to synthesize or
reuse the configured voice:

```bash
pnpm lesson preview --lesson lessons/my-lesson
```

Provider results are cached, so changing only cues does not synthesize the same
narration again. A real voice may require credentials in a gitignored `.env`
file.

Create the deployable site only when you need a release artifact:

```bash
pnpm lesson build --bundle --lesson lessons/my-lesson
```

The compiled lesson files go to `build/lesson/`. The self-contained site goes to
`build/site/`. Both directories are generated and should not be edited or
committed.

## What each command does

| Command | Purpose |
|---|---|
| `new <id>` | Create `lesson.yaml`, `scene.ts`, `script.md`, and an assets directory. |
| `scene` | Run the interactive scene alone while it is being built. |
| `ref` | Print the scene parameters, ranges, presets, groups, constants, and bakers. |
| `check` | Validate `script.md`, scene cues, and assistant configuration without network calls. |
| `preview` | Rebuild changed files and serve the complete lesson locally. |
| `build` | Compile narration, captions, and animation tracks into `build/lesson/`. |
| `build --bundle` | Also create the deployable site in `build/site/`. |
| `state --at <t>` | Print the computed scene state at a lesson time in seconds. |
| `frame --at <t> -o <file>` | Render a PNG of the built lesson at a chosen time. |
| `serve` | Serve an existing bundle without rebuilding or watching source files. |
| `assistant-eval` | Inspect or run tracked assistant questions against a built lesson. |

The common options are:

- `--lesson <dir>` selects the lesson directory;
- `--offline` prevents provider calls and uses deterministic local substitutes;
- `--bundle` asks `build` to create the deployable site;
- `--port <number>` and `--host <address>` set the local server address;
- `state --drag <param>=<value>` simulates a learner interaction;
- `frame --size <width>x<height>` sets the PNG dimensions.

`preview` and `serve` bind to `127.0.0.1` by default. Use `--host 0.0.0.0` only
when another device must reach the local server.

## Assistant evaluation

`assistant-eval` reads `assistant.eval.yaml` and the existing `build/lesson/`
artifacts. Run an offline build first. By default, the command prints the complete
requests that would be sent to the provider without making network calls:

```bash
pnpm lesson build --offline --lesson lessons/my-lesson
pnpm lesson assistant-eval --lesson lessons/my-lesson -o assistant-eval.json
```

Use `--variant structured|legacy|both` only when comparing assistant prompt
formats. Add `--real` only when you deliberately want to contact the answer
provider. Real evaluation requires `HF_TOKEN` and may incur provider costs.

## Scene development without narration

`lesson scene` reads only `id` and `scene` from `lesson.yaml`. It loads the scene
from its schema defaults, preserves interactions until reset or reload, and
watches lesson-local source dependencies. It does not read `script.md`, voice
settings, assistant context, or compiled lesson artifacts. Its temporary browser
bundle is stored in `build/scene-preview/`.
