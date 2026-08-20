# Create a lesson

Narrable's default production model separates pedagogical authorship from scene
implementation:

- the human owns the brief, narration, scene intent, and final judgment;
- the agent implements the scene, translates scene hints into formal cues, runs
  technical checks, and prepares deployment.

You do not need to understand the compiler or player to begin.

## 1. Write the brief

Create `brief.md` using the scaffold and the prompts in
[designing-a-lesson.md](./1-designing-a-lesson.md):

```bash
pnpm build
pnpm lesson new my-lesson --lesson lessons/my-lesson --lang en
```

Define the learner, conceptual obstacle, relationship to explore, primary action,
narrative arc, and evidence that the lesson worked. Keep the brief about teaching,
not implementation.

## 2. Let the agent design the scene

Ask the agent to implement the smallest scene that realizes the brief. It should:

1. choose a small set of meaningful parameters;
2. implement a pure rendering function and direct manipulation;
3. run `pnpm lesson ref`, `check`, and a fake build;
4. show you a local preview.

Test the scene before writing final narration. Try off-path values, resizing, and
touch interaction where relevant. Ask for changes in conceptual terms: what must
be manipulable, connected, visible, or easier to notice.

## 3. Write narration with scene hints

Write `script.<lang>.md` as spoken prose. Add natural-language instructions inside
double brackets wherever the scene should change:

```markdown
The same algorithm now zigzags from wall to wall.
[[Increase conditioning gradually during this sentence. Use a low camera angle
so the narrow valley is obvious.]]
```

Scene hints are removed from narration and captions. They are instructions for
the implementing agent, not formal Narrable syntax. See
[writing-narration.md](./3-writing-narration.md) for guidance.

## 4. Let the agent encode choreography

The agent reads the scene reference with `pnpm lesson ref`, then translates each
scene hint into validated directives such as `@cue`, `@camera`, `@show`, and
`@pause`. It should preserve the spoken prose unless you explicitly authorize an
edit.

The fast loop is:

```bash
pnpm lesson ref --lesson lessons/my-lesson
pnpm lesson check --lesson lessons/my-lesson
pnpm lesson build --fake --bundle --lesson lessons/my-lesson
```

## 5. Review and iterate

Use a fake-voice preview for structural iteration:

```bash
pnpm lesson preview --fake --lesson lessons/my-lesson
```

Review the pedagogy, interaction, visual composition, cue order, and pause
prompts. Once the prose is stable, build with the real voice and tune timing
against its prosody. Use the [review checklist](./4-reviewing.md).

## 6. Deploy

Ask the agent to follow the
[Hugging Face Space deployment guide](../deployment/hugging-face-spaces.md). Review
the private deployment before it is made public, especially if the lesson has an
assistant or server-side credentials.

## What each lesson contains

The core authored files are:

```text
brief.md             human-owned pedagogical intent
lesson.yaml          build and provider configuration
scene.ts             scene schema, rendering, and interaction
script.<lang>.md      spoken narration, scene hints, and formal cues
assistant.<lang>.md  optional assistant context
```

Generated `build/` and `.cache/` directories are never edited by hand.
