---
name: create-narrable-lesson
description: Create, continue, review, or deploy a Narrable interactive lesson from a human-authored pedagogical brief and narration. Use for work in lessons/, including scene design, natural-language scene hints, formal narration cues, fake or real builds, visual and interaction review, assistant context, and Hugging Face Space releases.
---

# Create a Narrable lesson

Treat lesson production as a staged collaboration. The human owns pedagogical
intent and spoken prose. Own the technical scene, formal choreography,
verification, and authorized deployment.

## Load only the required context

Always read:

- `lessons/AGENTS.md`;
- `docs/authoring/0-getting-started.md`;
- the target lesson's `brief.md`, manifest, scene, and relevant narration.

Read additional docs when the stage requires them:

- concept work: `docs/authoring/1-designing-a-lesson.md`;
- narration or choreography: `docs/authoring/3-writing-narration.md` and
  `docs/reference/directives.md`;
- scene work: `docs/authoring/2-building-a-scene.md` and
  `docs/reference/lesson-format.md`;
- assistant work: `docs/authoring/5-adding-an-assistant.md`;
- review: `docs/authoring/4-reviewing.md`;
- release: `docs/deployment/hugging-face-spaces.md` and the installed `hf-cli`
  skill when available.

Use existing lessons as examples, not as normative documentation.

## Determine the current stage

Inspect the lesson before editing. Continue from the earliest incomplete stage;
do not redo approved work.

1. Brief approved.
2. Scene implemented and human-tested.
3. Narration written with natural-language scene hints.
4. Hints translated into formal cues.
5. Lesson reviewed with real narration.
6. Release authorized and deployed.

If a missing human decision would materially alter the scene or teaching strategy,
ask a concise question. Do not fill pedagogical gaps with silent assumptions.

## 1. Establish the brief

For a new lesson, scaffold it:

```bash
pnpm build
pnpm lesson new <id> --lesson lessons/<id> --lang <code>
```

Invite the human to complete `brief.md`. Help sharpen the conceptual obstacle,
explorable relationship, primary action, narrative arc, and review criteria, but
do not turn the brief into a technical design document. Obtain approval before
committing to a substantial scene.

## 2. Implement and test the scene

Design the smallest scene that makes the brief's relationship visible. Choose a
small conceptual schema and deliberate ownership modes. Keep authored state a pure
function of current state and lesson time.

Verify with:

```bash
pnpm lesson ref --lesson lessons/<id>
pnpm lesson scene --lesson lessons/<id>
```

Test scientific or mathematical logic where mistakes would undermine the lesson.
Ask the human to manipulate the scene before encoding final choreography. Capture
their feedback in the scene or brief; do not proceed as though an unreviewed scene
were approved.

## 3. Preserve narration and interpret hints

Treat prose outside hints and formal directives in `script.<lang>.md` as
human-owned and spoken verbatim. Write natural-language hints in double brackets:

```markdown
[[Increase conditioning during this sentence while learning rate stays fixed.]]
```

Interpret each hint against the implemented schema and the surrounding argument.
If it is ambiguous or impossible, explain the mismatch and ask whether to change
the scene or the intent. Never rewrite prose merely to make a cue easier.

## 4. Encode formal choreography

Run `lesson ref` immediately before authoring cues. Translate hints into absolute,
schema-valid `@cue`, `@camera`, visibility, board, bake, chapter, or pause
directives. Anchor each change to the phrase it supports and avoid unnecessary
simultaneous motion.

Keep hints until their cues have been reviewed; then remove them or keep them
synchronized as intent hints. Run `lesson check` after every meaningful cue
pass. Use fake TTS during structural iteration.

## 5. Review in layers

Build a bundle and inspect representative `state` and `frame` outputs across every
chapter. Then review the live preview for interaction, resizing, pause/resume,
seeking, and touch where relevant.

Ask the human to review pedagogy and visual direction. Iterate with fake narration
until prose and cue order are stable. Build with the real voice only then, and tune
timing to its prosody without changing the teaching argument.

Before release, follow every item in `docs/authoring/4-reviewing.md` and run the
lesson-specific tests plus `pnpm lesson check`.

## 6. Deploy only with authorization

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
