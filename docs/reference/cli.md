# CLI reference

Build the framework once, then invoke the local CLI as `pnpm lesson`:

```bash
pnpm build
pnpm lesson <command> [options]
```

| Command | Purpose |
|---|---|
| `new <id>` | Scaffold `brief.md`, a manifest, a scene, and one narration file. |
| `check` | Validate scripts and scene exports without network calls. |
| `build` | Compile narration and tracks into `build/<lang>/`. |
| `preview` | Rebuild on changes and serve a local preview. |
| `serve` | Serve an existing bundle without file watching. |
| `ref` | Print the scene's parameters, ranges, presets, groups, constants, and bakers. |
| `state --at <t>` | Print evaluated scene state at a lesson time. |
| `frame --at <t> -o <file>` | Render a deterministic PNG from a built bundle. |

Common options:

- `--lesson <dir>`: lesson directory; defaults to the current directory;
- `--lang <code>`: select one manifest language;
- `--fake`: use deterministic fake providers;
- `--bundle`: emit the deployable site;
- `--port <number>` and `--host <address>`: preview or server binding;
- `state --drag <param>=<value>`: simulate interaction and reconciliation;
- `frame --size <width>x<height>`: choose output dimensions.

`preview` and `serve` bind to `127.0.0.1` by default. Use `--host 0.0.0.0` only
when another device must reach the local server.
