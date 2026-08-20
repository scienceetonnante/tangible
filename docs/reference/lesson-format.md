# Lesson files and manifest

## Authored files

```text
brief.md                pedagogical intent and review criteria
lesson.yaml             identity, languages, defaults, providers, assistant
scene.ts                schema, scene implementation, optional helpers
script.<lang>.md         narration, natural-language hints, and formal directives
assistant.<lang>.md      optional semantic assistant context
assets/                  optional authored assets
```

`build/` and `.cache/` are generated and gitignored.

## Manifest

Minimal example:

```yaml
id: unit-circle
title:
  en: The unit circle
scene: ./scene.ts
languages: [en]
voice:
  en: elevenlabs:VOICE_ID
defaults:
  anticipation: -0.2
  ease: inOutCubic
  transition: 1.0
tts:
  speed: 0.9
```

Voice specifications currently support `elevenlabs:<voice-id>` and
`hf-endpoint:<voice-id>`. `--fake` overrides real synthesis for local iteration.
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
  context:
    en: assistant.en.md
  commandable: [theta, show.projection]
```

The context describes the scene, controls, terminology, and answer guidance. Only
allowlisted parameters may be returned by the provider. Assistant-enabled bundles
include a same-origin server; other lessons remain static.
