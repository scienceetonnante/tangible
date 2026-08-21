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
  context: assistant.md
  commandable: []
```

An empty `commandable` list enables written answers without giving the assistant
control of the scene.

Then create `assistant.md`. A useful context file has four short sections:

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
presets, constants, and groups to the assistant artifact. Authors do not need to
repeat those generated details in the context file.

## Understand the assembled prompt

The server turns the built artifact into a readable system message. It does not
send the raw `assistant.json` object to the model. The system message contains,
in this order:

1. The assistant's teaching role, limitations, and scene capabilities.
2. The complete authored `assistant.md` guide, preserved as lesson-specific
   instructions.
3. A readable list of every scene value. Each entry gives its internal name,
   label when available, type, range, default, transition behavior, and whether
   the assistant may change it.
4. The lesson's presets, constants, and groups, when present.
5. The complete authored script and a short explanation of narration and `@`
   directives. The separate generated narration is omitted because it duplicates
   the prose in the script.
6. Instructions for composing written beats, deciding when a visual change
   helps, and returning only the required JSON. A written-only example shows the
   output structure. Authors can add lesson-specific visual examples to the
   context guide.

The current user message is a JSON object with this shape:

```json
{
  "question": "Why is it zero here?",
  "lessonPosition": {
    "chapter": "Projection",
    "narrationJustHeard": "The horizontal projection is the cosine.",
    "pausePrompt": "Try changing the angle."
  },
  "visibleState": {
    "theta": 1.5708,
    "show.projection": true
  },
  "temporaryAssistantState": {
    "theta": 1.5708
  }
}
```

`lessonPosition` contains the latest chapter, the current or most recently
started narration sentence, and the active authored pause prompt. It never
contains upcoming narration. `visibleState` contains validated scene values at
the moment of the question. `temporaryAssistantState` identifies the subset of
those values that still comes from the preceding assistant answer, rather than
from the lesson or the learner.

For a follow-up question, the server inserts up to eight earlier successful turns
between the system message and the current user message. Each earlier learner
question is a user message. Each earlier answer is an assistant message containing
its validated beats. History remains only in the current browser page and is
cleared by a reload; it is not stored by the lesson server.

The provider has no tools and cannot call scene code. It must return one JSON
object that conforms to a strict response schema:

```json
{
  "beats": [
    {
      "say": "The written explanation shown to the learner.",
      "set": {},
      "over": 0
    }
  ]
}
```

The schema permits one to six beats after server validation. `set` accepts only
the allowlisted scene parameters and valid absolute values. `over` is a visual
transition duration from zero to two seconds. The server concatenates the `say`
fields to form the displayed answer.

## Allow visual answers when they help

Run the scene reference command before choosing parameters:

```bash
pnpm lesson ref --lesson lessons/my-lesson
```

Add only parameters that have a clear explanatory purpose:

```yaml
assistant:
  context: assistant.md
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
a time. The [unit-circle assistant](../../lessons/unit-circle/assistant.md)
shows a small visual assistant. The
[optimizers assistant](../../lessons/optimizers/assistant.md) shows how to
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

`lesson check` confirms that the context file exists and that every commandable
parameter exists in the scene schema. It does not contact the answer provider.

Build and preview offline first:

```bash
pnpm lesson preview --offline --lesson lessons/my-lesson
```

Start playback, pause it, and submit a question. This verifies the question
interface and request path without credentials or provider costs. The fake answer
is deterministic and generic, so it does not test the quality of the authored
context.

For repeatable prompt review, add `assistant.eval.yaml` beside the lesson:

```yaml
cases:
  - id: visual-follow-up
    at: 18.8
    state:
      theta: 1.5708
    turns:
      - What does cosine represent here?
      - Can you show me a case where it is zero?
```

Create a fake build, then render the complete provider requests without making
network calls:

```bash
pnpm lesson build --offline --lesson lessons/my-lesson
pnpm lesson assistant-eval --lesson lessons/my-lesson -o assistant-eval.json
```

Use `--variant both` to compare the structured prompt with the former raw-context
prompt. This comparison mode exists for evaluation; the lesson server uses the
structured prompt. Inspect whether each request contains the intended lesson
position, state, prior turns, and instructions.

In dry mode, a deterministic fake answer supplies the history and temporary
scene values needed to assemble each later question in a sequence. The result
labels these fields as `simulatedAnswer` and `simulatedBeats`. They verify prompt
structure and follow-up handling, not answer quality.

Add `--real` only when you deliberately want to call the configured answer
provider. Real evaluation requires `HF_TOKEN`, can incur provider costs, and is
never run by ordinary checks:

```bash
pnpm lesson assistant-eval --lesson lessons/my-lesson --real -o assistant-results.json
```

To test a real answer without rebuilding narration through a real provider,
first create an offline bundle and then serve that existing bundle:

```bash
pnpm lesson build --offline --bundle --lesson lessons/my-lesson
pnpm lesson serve --lesson lessons/my-lesson
```

Put a dedicated Hugging Face inference token in a gitignored `.env` file as
`HF_TOKEN` before starting the server. Test questions that require a direct
explanation, a clarification at different lesson positions, and every kind of
visual change you allow. Confirm that answers remain correct at boundary values,
after the learner has manipulated the scene, and across follow-up questions.

## Review safety and deployment

Assistant-enabled bundles include a same-origin Node server because provider
credentials must not be sent to the browser. They therefore require a server
deployment; lessons without an assistant can remain static.

The server validates question length, conversation history, answer length, and
all scene values. It also applies global, per-browser, and concurrency limits.
These controls reduce operational risk, but they do not replace a review of the
assistant's pedagogy and scientific accuracy.

Before release:

1. Test representative questions at several lesson positions.
2. Test each commandable parameter, including the boundaries of scalar ranges.
3. Confirm that resuming and asking another question remove temporary changes.
4. Confirm that browser assets contain no credentials.
5. Review rate limits and structured server logs on the private deployment.

Follow the complete [lesson review checklist](./4-reviewing.md) and the
[Hugging Face Spaces deployment guide](../deployment/hugging-face-spaces.md)
before making an assistant-enabled lesson public.
