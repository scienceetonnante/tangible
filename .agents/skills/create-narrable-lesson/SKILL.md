---
name: create-narrable-lesson
description: Create, continue, review, or deploy a Narrable interactive lesson from a human-built scene and narration. Use for work in lessons/, including scene design, natural-language scene hints, formal narration cues, offline or real-voice builds, visual and interaction review, assistant context, and Hugging Face Space releases.
---

# Create a Narrable lesson

Treat lesson production as a staged collaboration. The human owns pedagogical
intent and spoken prose. Own the technical scene, formal choreography,
verification, and authorized deployment.

## Load only the required context

Always read:

- `lessons/AGENTS.md`;
- `docs/authoring.md`;
- the target lesson's manifest, scene, and relevant narration.

Read additional docs when the stage requires them:

- scene formats or directive syntax: `docs/reference.md`;
- framework architecture: `docs/contributing.md`;
- release: the deployment section of `docs/authoring.md` and the installed
  `hf-cli` skill when available.

Use existing lessons as examples, not as normative documentation.

## Determine the current stage

Inspect the lesson before editing. Continue from the earliest incomplete stage;
do not redo approved work.

1. Scene implemented and human-tested.
2. Narration written with natural-language scene hints.
3. Hints translated into formal cues.
4. Lesson reviewed with real narration.
5. Release authorized and deployed.

If a missing human decision would materially alter the scene or teaching strategy,
ask a concise question. Do not fill pedagogical gaps with silent assumptions.

## 1. Implement and test the scene

For a new lesson, scaffold it:

```bash
pnpm build
pnpm lesson new <id> --lesson lessons/<id>
```

The author may already know the intended lesson and may begin by coding the scene
as an ordinary interactive website. Help implement the smallest scene that makes
the intended relationship visible. Choose a small conceptual schema and
deliberate ownership modes. Keep authored state a pure function of current state
and lesson time.

Verify with:

```bash
pnpm lesson ref --lesson lessons/<id>
pnpm lesson scene --lesson lessons/<id>
```

Test scientific or mathematical logic where mistakes would undermine the lesson.
Ask the human to manipulate the scene before encoding final choreography. Apply
their feedback to the scene; do not proceed as though an unreviewed scene were
approved.

## 2. Preserve narration and interpret hints

Treat prose outside hints and formal directives in `script.md` as
human-owned and spoken verbatim. Write natural-language hints in double brackets:

```markdown
[[Increase conditioning during this sentence while learning rate stays fixed.]]
```

Interpret each hint against the implemented schema and the surrounding argument.
If it is ambiguous or impossible, explain the mismatch and ask whether to change
the scene or the intent. Never rewrite prose merely to make a cue easier.

## 3. Encode formal choreography

Run `lesson ref` immediately before authoring cues. Translate hints into absolute,
schema-valid `@cue`, `@camera`, visibility, board, bake, chapter, or pause
directives. Anchor each change to the phrase it supports and avoid unnecessary
simultaneous motion.

Keep hints until their cues have been reviewed; then remove them or keep them
synchronized as intent hints. Run `lesson check` after every meaningful cue
pass. Use `--offline` during structural iteration so no speech provider is called.

## 4. Review in layers

Build a bundle and inspect representative `state` and `frame` outputs across every
chapter. Then review the live preview for interaction, resizing, pause/resume,
seeking, and touch where relevant.

Ask the human to review pedagogy and visual direction. Iterate with silent
placeholder audio until prose and cue order are stable. Build with the real voice
only then, and tune timing to its prosody without changing the teaching argument.

Before release, follow the review and deployment sections of
`docs/authoring.md` and run the lesson-specific tests plus `pnpm lesson check`.

## 5. Deploy only with authorization

Deployment changes external state. Require an explicit request naming or clearly
identifying the target Space. Use the current `hf` CLI, never the deprecated
`huggingface-cli` command.

Build from a known source commit, publish only the release artifact, keep the
Space private during verification, and add secrets through Space secret controls.
Never put tokens or build-only TTS credentials in browser assets, release branches,
or Space variables.

Wait for the Space to finish building, inspect logs, test the deployed lesson and
one real assistant answer when enabled, then report the deployed revision and
remaining manual visibility decision. Do not make a private Space public unless
the user explicitly requested that transition.
