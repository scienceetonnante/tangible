# CLI reference

Build the framework once, then invoke the local CLI as `pnpm lesson`:

```bash
pnpm build
pnpm lesson <command> [options]
```

| Command | Purpose |
|---|---|
| `new <id>` | Scaffold a manifest, a scene, and one narration file. |
| `check` | Validate scripts and scene exports without network calls. |
| `build` | Compile narration and tracks into `build/<lang>/`. |
| `preview` | Rebuild on changes and serve a local preview. |
| `scene` | Rebuild and serve an interactive scene without narration or lesson playback. |
| `serve` | Serve an existing bundle without file watching. |
| `assistant-eval` | Render or run tracked assistant question cases against a built lesson. |
| `ref` | Print the scene's parameters, ranges, presets, groups, constants, and bakers. |
| `state --at <t>` | Print evaluated scene state at a lesson time. |
| `frame --at <t> -o <file>` | Render a deterministic PNG from a built bundle. |

Common options:

- `--lesson <dir>`: lesson directory; defaults to the current directory;
- `--lang <code>`: select one manifest language;
- `--fake`: use deterministic fake providers;
- `assistant-eval --variant structured|legacy|both`: select the current readable
  prompt, the former raw-context prompt, or both for comparison;
- `assistant-eval --real`: call the real answer provider. Without this flag, the
  command only writes provider requests and makes no network calls;
- `--bundle`: emit the deployable site;
- `--port <number>` and `--host <address>`: preview or server binding;
- `state --drag <param>=<value>`: simulate interaction and reconciliation;
- `frame --size <width>x<height>`: choose output dimensions.

`preview` and `serve` bind to `127.0.0.1` by default. Use `--host 0.0.0.0` only
when another device must reach the local server.

## Assistant evaluation

`assistant-eval` reads `assistant.eval.<lang>.yaml` cases and the existing
`build/<lang>/` artifacts. Run `lesson build --fake` first if the lesson is not
built. By default, the command renders the complete request that would be sent
to the provider, including the system prompt and conversation messages. Use
`-o <file>` to save the JSON output. For a sequence of questions, deterministic
fake answers populate the earlier messages needed by later requests. They are
labelled as simulated output and do not measure answer quality.

The `--real` flag is the only mode that contacts the provider. It requires the
same `HF_TOKEN` as an assistant-enabled lesson server. Ordinary checks, builds,
and dry evaluations never run real assistant calls.

## Scene development without narration

Use `scene` while the scene is being implemented and the narration does not yet
exist:

```bash
pnpm lesson scene --lesson lessons/my-lesson
```

This command reads only `id` and `scene` from `lesson.yaml`. It loads the scene
from its schema defaults, preserves interactions until reset or reload, and
watches the scene's lesson-local source dependencies. It does not read
`script.<lang>.md`, language or voice settings, assistant context, or generated
lesson artifacts. It writes its temporary browser bundle to
`build/scene-preview/`.
