# Build a scene

This is the advanced lane for implementing agents and technical authors. Human
lesson directors can stay in the [brief-first workflow](./getting-started.md).

## Scene contract

`scene.ts` exports a parameter `schema` and, when the lesson is rendered, a scene
module. It may also export presets, named constants, parameter groups, and
build-time bakers.

Parameters are the shared vocabulary between scene, narration, interaction, and
the lesson assistant. Keep the schema small and conceptual. Choose ownership
deliberately:

- `script` for narration-bound values that return to the timeline;
- `shared` for learner choices that persist until the next cue;
- `viewer` for persistent navigation, normally the camera.

The scene must render from the complete current state. Do not accumulate authored
state frame by frame; seeking to any time must reconstruct the same view directly.

## Implementation loop

```bash
pnpm lesson ref --lesson lessons/<id>
pnpm lesson check --lesson lessons/<id>
pnpm lesson build --fake --bundle --lesson lessons/<id>
pnpm lesson state --lesson lessons/<id> --at 10
pnpm lesson frame --lesson lessons/<id> --at 10 -o /tmp/frame.png
```

Use `state --drag <param>=<value>` to inspect reconciliation without a browser.
Use representative frames to check visibility and composition, then use the live
preview for interaction and responsive layout.

## Design rules

- Implement the smallest scene that proves the relationship in the brief.
- Prefer one clear learner handle and a few supporting controls.
- Make off-path states scientifically meaningful.
- Update connected representations from the same state rather than synchronizing
  them manually.
- Keep schema exports loadable in Node; DOM and renderer creation belong in the
  scene instance.
- Add a baker only for genuinely coupled build-time computation.
- Add a reusable ingredient only after more than one scene needs the pattern.

Use existing lessons as examples, not as additional API specification. The
current platform contract is defined by the
[architecture](../framework/architecture.md), compiler diagnostics, types, and
the [lesson format reference](../reference/lesson-format.md).
