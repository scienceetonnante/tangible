# Write narration and scene hints

The human owns the spoken argument. The agent owns the translation from scene
intent to formal choreography.

## Write for speech first

- Keep one conceptual move per paragraph.
- Use the voice to explain significance and direct attention, not to describe
  every visible movement.
- Introduce terms only when the learner has something visible to attach them to.
- Put prediction or manipulation prompts before the explanation they test.
- Read the prose aloud before tuning animation.

Everything outside front matter, formal directives, and HTML comments is spoken
verbatim and used for captions.

## Add natural-language scene hints

Place a hint near the sentence it supports:

```markdown
I have not changed the step size. I have only made the bowl narrower.
<!-- scene: animate the conditioning from round to a narrow valley across these
two sentences; keep SGD's learning rate fixed -->
```

Useful hints state:

- what conceptual change should become visible;
- which phrase or sentence it should align with;
- what must remain fixed for the comparison to be honest;
- any important camera, emphasis, or interaction intent.

Avoid encoding implementation guesses such as parameter names or exact numeric
values unless they are pedagogically meaningful. The agent should choose those
from the actual scene schema.

HTML comments do not enter TTS or captions and may contain ordinary `@` signs.
Keep a hint until its formal choreography has been reviewed; then either remove it
or keep it synchronized as an intent comment.

## Formal cues belong to the agent loop

After the scene exists, the agent runs `lesson ref` and converts hints into cues:

```markdown
I have not changed the step size. I have only made the bowl
@cue(kappa -> 25, over: 3s) narrower.
```

Directives are anchored to the word immediately following them. They are stripped
before speech synthesis. The complete syntax is in the
[directive reference](../reference/directives.md).

The agent should not rewrite narration merely to simplify choreography. If a hint
cannot be represented by the scene, it should explain the limitation and ask
whether to change the scene or the intent.
