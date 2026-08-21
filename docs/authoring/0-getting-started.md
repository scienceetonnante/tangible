# Create a lesson

Narrable's production model starts after the author has decided what to teach.
There is no required planning document. The work begins with an interactive scene:

- the human owns the narration, scene intent, and final judgment;
- the agent implements the scene, translates scene hints into formal cues, runs
  technical checks, and prepares deployment.

You do not need to understand the compiler or player to begin.

## 1. Create and test the scene

Create the lesson files:

```bash
pnpm build
pnpm lesson new my-lesson --lesson lessons/my-lesson
```

Build `scene.ts` as an ordinary interactive website. You can write it yourself or
ask an agent to implement the smallest scene that expresses your idea. The scene
work should:

1. choose a small set of meaningful parameters;
2. implement a pure rendering function and direct manipulation;
3. run `pnpm lesson ref` and the scene-specific tests; and
4. show you a narration-free local preview with:

```bash
pnpm lesson scene --lesson lessons/my-lesson
```

Test the scene before writing the narration. Try unusual values, resizing, and
touch interaction where relevant. Ask for changes in conceptual terms: what must
be manipulable, connected, visible, or easier to notice.

## 2. Write narration with scene hints

Write `script.md` as spoken prose. Add natural-language instructions inside
double brackets wherever the scene should change:

```markdown
The same algorithm now zigzags from wall to wall.
[[Increase conditioning gradually during this sentence. Use a low camera angle
so the narrow valley is obvious.]]
```

Scene hints are removed from narration and captions. They are instructions for
the implementing agent, not formal Narrable syntax. See
[writing-narration.md](./3-writing-narration.md) for guidance.

## 3. Let the agent encode choreography

The agent reads the scene reference with `pnpm lesson ref`, then translates each
scene hint into validated directives such as `@cue`, `@camera`, `@show`, and
`@pause`. It should preserve the spoken prose unless you explicitly authorize an
edit.

The fast loop is:

```bash
pnpm lesson ref --lesson lessons/my-lesson
pnpm lesson check --lesson lessons/my-lesson
pnpm lesson build --offline --bundle --lesson lessons/my-lesson
```

## Optional: Add a lesson assistant

If the lesson should answer questions while paused, follow
[adding a lesson assistant](./5-adding-an-assistant.md). The assistant is an
optional framework feature that requires lesson-specific context and a deliberate
choice of any scene parameters it may change.

## 4. Review and iterate

Use an offline preview for structural iteration:

```bash
pnpm lesson preview --offline --lesson lessons/my-lesson
```

In offline mode, Narrable generates silence whose duration follows the length of
the narration. This lets you test cue order, interaction, captions, and layout
without an API key or a paid speech call. It does not let you judge pacing or how
an animation aligns with the rhythm of a real voice.

Review the pedagogy, interaction, visual composition, cue order, and pause
prompts. Once the prose is stable, build with the real voice and tune timing
against its prosody. Use the [review checklist](./4-reviewing.md).

## 5. Deploy

Ask the agent to follow the
[Hugging Face Space deployment guide](../deployment/hugging-face-spaces.md). Review
the private deployment before it is made public, especially if the lesson has an
assistant or server-side credentials.

## What each lesson contains

The core authored files are:

```text
lesson.yaml          build and provider configuration
scene.ts             scene schema, rendering, and interaction
script.md            spoken narration, scene hints, and formal cues
assistant.md         optional assistant context
```

Generated `build/` and `.cache/` directories are never edited by hand.
