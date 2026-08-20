# Add a lesson assistant

The lesson assistant lets a learner pause playback and ask a written question.
The feature is optional. The player, question interface, answer validation, and
server are shared framework features, but each lesson must supply its own context
and decide whether the assistant may change the scene.

## Decide what the assistant should do

Start with the smallest useful role for the assistant. It can answer only in
writing, or it can combine a written explanation with temporary changes to
selected scene parameters.

A written-only assistant is the safer default. Add visual control only when a
scene change makes an explanation substantially clearer. The assistant cannot
run arbitrary scene code. It can only assign valid absolute values to parameters
that the lesson explicitly allows.

## Enable the assistant

Add an `assistant` section to `lesson.yaml`:

```yaml
assistant:
  context:
    en: assistant.en.md
  commandable: []
```

The `context` map must contain one file for every language in `languages`. An
empty `commandable` list enables written answers without giving the assistant
control of the scene.

Then create `assistant.<lang>.md` for each language. A useful context file has
four short sections:

```markdown
# Scene and purpose

Explain what the lesson teaches and what the learner sees.

# Learner controls

Explain what the learner can manipulate and what each control changes.

# Concepts and conventions

Define lesson-specific terminology, units, ranges, assumptions, and limitations.

# Answer guidance

State what good answers should emphasize and which claims the assistant must
avoid.
```

Write the context as instructions for a teaching assistant that receives this
semantic description and the scene state, but no image of the lesson. Include
facts needed to interpret the scene correctly. State important limitations
explicitly. Do not put credentials, private information, or instructions
unrelated to the lesson in this file. The built context is downloaded by the
browser and is not private.

The build adds the lesson title, complete script, spoken narration, scene schema,
presets, constants, and groups to this authored context. At question time, the
assistant also receives the current lesson time, the current scene state, and up
to eight earlier turns from the current page. Authors do not need to repeat those
generated details in the context file.

## Allow visual answers when they help

Run the scene reference command before choosing parameters:

```bash
pnpm lesson ref --lesson lessons/my-lesson
```

Add only parameters that have a clear explanatory purpose:

```yaml
assistant:
  context:
    en: assistant.en.md
  commandable:
    - theta
    - show.projection
```

Choose conceptual parameters whose meaning you can explain in the context file.
Avoid internal layout values, incidental animation state, and controls that could
leave the scene misleading. `lesson check` rejects unknown parameters, and the
server rejects values with the wrong type or values outside a declared scalar
range.

Describe how to use the allowed controls under `# Answer guidance`. For example,
tell the assistant to establish a comparison before explaining it, to use matched
conditions for a fair comparison, or to avoid changing more than one variable at
a time. The [unit-circle assistant](../../lessons/unit-circle/assistant.en.md)
shows a small visual assistant. The
[optimizers assistant](../../lessons/optimizers/assistant.en.md) shows how to
constrain a larger set of controls.

Assistant scene changes are temporary. They appear over the paused lesson state
and disappear when playback resumes or another question begins. If the learner
manipulates a parameter during an answer, the learner's value takes precedence
for that parameter.

## Choose when to invite questions

The question field becomes available after playback has begun and is paused. A
learner can pause manually, so an authored checkpoint is not required.

Use `@pause` when the lesson should deliberately invite exploration or a
question:

```markdown
@pause(prompt: "Try changing the angle. Ask why the projection equals the cosine.")
```

The scene remains interactive while paused. The normal play control resumes the
lesson. See the [directive reference](../reference/directives.md#structure-and-pauses)
for spoken and silent pause syntax.

## Validate the configuration

Run the ordinary lesson checks:

```bash
pnpm lesson ref --lesson lessons/my-lesson
pnpm lesson check --lesson lessons/my-lesson
```

`lesson check` confirms that every language has a context file and that every
commandable parameter exists in the scene schema. It does not contact the answer
provider.

Build and preview with fake providers first:

```bash
pnpm lesson preview --fake --lesson lessons/my-lesson
```

Start playback, pause it, and submit a question. This verifies the question
interface and request path without credentials or provider costs. The fake answer
is deterministic and generic, so it does not test the quality of the authored
context.

To test a real answer without rebuilding narration through a real provider,
first create a fake bundle and then serve that existing bundle without `--fake`:

```bash
pnpm lesson build --fake --bundle --lesson lessons/my-lesson
pnpm lesson serve --lesson lessons/my-lesson
```

Put a dedicated Hugging Face inference token in a gitignored `.env` file as
`HF_TOKEN` before starting the server. Test questions that require a direct
explanation, a clarification at different lesson times, and every kind of visual
change you allow. Confirm that answers remain correct at boundary values and
after the learner has manipulated the scene.

## Review safety and deployment

Assistant-enabled bundles include a same-origin Node server because provider
credentials must not be sent to the browser. They therefore require a server
deployment; lessons without an assistant can remain static.

The server validates question length, conversation history, answer length, and
all scene values. It also applies global, per-browser, and concurrency limits.
These controls reduce operational risk, but they do not replace a review of the
assistant's pedagogy and scientific accuracy.

Before release:

1. Test representative questions in every lesson language.
2. Test each commandable parameter, including the boundaries of scalar ranges.
3. Confirm that resuming and asking another question remove temporary changes.
4. Confirm that browser assets contain no credentials.
5. Review rate limits and structured server logs on the private deployment.

Follow the complete [lesson review checklist](./4-reviewing.md) and the
[Hugging Face Spaces deployment guide](../deployment/hugging-face-spaces.md)
before making an assistant-enabled lesson public.
