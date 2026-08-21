# Lesson files and manifest

## Authored files

```text
lesson.yaml             identity, defaults, voice provider, assistant
scene.ts                schema, scene implementation, optional helpers
script.md               narration, natural-language hints, and formal directives
assistant.md            optional semantic assistant context
assistant.eval.yaml     optional tracked assistant question cases
assets/                  optional authored assets
```

`build/` and `.cache/` are generated and gitignored.

Narrable currently assumes that every lesson is in English. A lesson has one
script, one voice, one set of captions, and one assistant guide. The manifest
therefore has no language list or language-specific maps.

## Manifest

Minimal example:

```yaml
id: unit-circle
title: The unit circle
scene: ./scene.ts
voice: elevenlabs:VOICE_ID
defaults:
  anticipation: -0.2
  ease: inOutCubic
  transition: 1.0
tts:
  speed: 0.9
```

Voice specifications currently support `elevenlabs:<voice-id>` and
`hf-endpoint:<voice-id>`. `--offline` replaces provider speech with deterministic
silent audio for local iteration.
The CLI loads gitignored `.env` files from both the invocation directory and the
lesson directory.

## Scene exports

- `schema`: required parameter definitions;
- `scene`: runtime scene module;
- `presets`: optional named parameter collections, including cameras;
- `constants`: optional values usable in cues;
- `groups`: optional ordered parameters for compact coupled cues;
- `bakers`: optional deterministic build-time computations.

Run `pnpm lesson ref --lesson <dir>` for the exact lesson-specific contract.

## Optional assistant

```yaml
assistant:
  context: assistant.md
  commandable: [theta, show.projection]
```

The context describes the scene, controls, terminology, and answer guidance. Only
allowlisted parameters may be returned by the provider. Assistant-enabled bundles
include a same-origin server; other lessons remain static. Follow
[the assistant authoring guide](../authoring/5-adding-an-assistant.md) to choose the
allowlist, write the context, and test fake and real answers.

An optional `assistant.eval.yaml` file records representative question
sequences, lesson times, and state overrides for `lesson assistant-eval`. It is a
review artifact rather than part of the deployed lesson bundle.
