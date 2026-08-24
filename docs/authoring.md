# Authoring a lesson

Narrable's production model starts after the author has decided what to teach.
There is no required planning document. The work begins with an interactive
scene, followed by narration and integration:

1. Build and test the interactive scene.
2. Write the spoken narration with optional scene hints.
3. Let an agent translate the hints into formal choreography.
4. Review offline, then tune the timing against the real voice.
5. Deploy only after the complete lesson has been reviewed.

The human owns the narration, scene intent, and final pedagogical and aesthetic
judgment. The agent implements the scene, translates scene hints into formal
cues, runs technical checks, and prepares an authorized deployment. The agent
must preserve human-written narration unless the author explicitly asks for an
edit.

## Create the lesson files

Build the framework and create a lesson directory:

```bash
pnpm build
pnpm lesson new my-lesson --lesson lessons/my-lesson
```

The authored files are:

```text
lesson.yaml          build and provider configuration
script.md            spoken narration, scene hints, and formal cues
assistant.md         optional lesson-assistant guidance
assistant.eval.yaml  optional tracked assistant question cases
scenes/
  scene.ts           scene schema, rendering, and interaction
  ...                optional scene helpers, tests, and visual assets
assets/              optional authored assets
```

The generated `build/` and `.cache/` directories must not be edited or
committed. Narrable currently assumes that every lesson is in English.

Each lesson has one scene entry module, selected by the `scene` field in
`lesson.yaml`. Narration chapters are sections on the lesson timeline; they do
not select different scene files. The `scenes/` directory is plural because a
complex scene can have supporting modules, tests, and visual assets alongside
the entry module. If the scene contains several named visual modes, the entry
module composes them and the script can select a mode with `@scene`.

## Build and test the scene

Build `scenes/scene.ts` as an ordinary interactive website before writing final
narration. You can write it yourself or ask an agent to implement the smallest
scene that expresses the intended relationship.

### Scene contract

`scenes/scene.ts` exports a parameter `schema` and, when rendered, a scene
module. It may also export presets, named constants, parameter groups, and
build-time bakers.

Parameters are the shared vocabulary between the scene, narration, learner
interaction, and optional lesson assistant. Keep the schema small and
conceptual. Choose parameter ownership deliberately:

- `script` means that a learner's change holds temporarily and then glides back
  to the narration timeline;
- `shared` means that a learner's change persists until the next scripted write;
- `viewer` means that the script stops controlling the value after learner
  interaction during that session. Cameras normally use this mode.

The scene must render from the complete current state. Do not accumulate
authored state frame by frame. Seeking directly to any lesson time must recreate
the same view.

### Reserve a board region

Every scene intended for a narrated lesson must reserve a stable region for the
board, even if the first version of the script does not use it. The board holds
short equations and notes introduced by narration directives. It is a player
overlay, so showing an item does not move or resize the scene underneath it.

The default board occupies the rightmost 28 percent of the player. Keep
important data, labels, controls, and drag targets out of that region, and leave
enough clear space above the captions and playback controls for at least one
equation or a few short lines of text. Check the result at both desktop and
narrow sizes. Board text must remain legible against the scene, and board items
should be concise enough that scrolling is exceptional.

There is currently no `boardRegion` export in the scene contract. Reserving the
region is therefore an explicit scene-layout responsibility rather than a
compiler-validated declaration. A scene that needs a smaller or differently
placed region may override `.xv-board` in lesson-local CSS, scoped under a class
on that scene's player root. The narration later declares the actual content and
visibility with `@board`, `@highlight`, `@dim`, and `@clear`.

### Scene development loop

Run the scene without narration:

```bash
pnpm lesson ref --lesson lessons/my-lesson
pnpm lesson scene --lesson lessons/my-lesson
```

`lesson ref` prints the exact parameters, ranges, presets, groups, constants,
and bakers exposed by the scene. `lesson scene` starts from schema defaults and
does not read `script.md`, call a provider, or show playback controls. It rebuilds
when the scene or one of its lesson-local dependencies changes.

Test the scene before writing narration. Try ordinary, boundary, and unusual
values. Check resizing and touch interaction where relevant. Ask for changes in
conceptual terms: what must be manipulable, connected, visible, or easier to
notice.

Follow these design rules:

- Implement the smallest scene that proves the intended relationship.
- Prefer one clear learner action and only a few supporting controls.
- Make states outside the narrated path scientifically meaningful.
- Update connected representations from the same state instead of synchronizing
  them manually.
- Keep schema exports loadable in Node. DOM and renderer creation belong in the
  scene instance.
- Add a baker only for genuinely coupled build-time computation.
- Add a reusable ingredient only after more than one lesson needs it.
- Test scientific or mathematical logic when an error would undermine the
  lesson.

The exact file format and scene exports are described in
[the reference](./reference.md#lesson-files-and-manifest).

## Write narration and scene hints

The human owns the spoken argument. Write `script.md` for speech first:

- Keep one conceptual move per paragraph.
- Use the voice to explain significance and direct attention, rather than
  describing every visible movement.
- Introduce terms only when the learner has something visible to attach them to.
- Put prediction or manipulation prompts before the explanation they test.
- Read the prose aloud before tuning animation.

Everything outside front matter, formal directives, and double-bracket hints is
spoken verbatim and used for captions.

Place natural-language scene hints near the sentences they support:

```markdown
I have not changed the step size. I have only made the bowl narrower.
[[Animate the conditioning from round to a narrow valley across these two
sentences. Keep SGD's learning rate fixed.]]
```

A useful hint states what conceptual change should become visible, which phrase
it should align with, what must remain fixed, and any important camera or
emphasis intent. Avoid guessing parameter names or exact numeric values unless
they are pedagogically meaningful. The agent should choose those values from the
implemented scene contract.

Hints do not enter speech synthesis or captions, and they may contain ordinary
`@` signs. Keep each hint until its formal choreography has been reviewed. You
may then remove it or retain it as a synchronized statement of intent.

## Convert hints into choreography

The agent should run `lesson ref` immediately before translating hints into
formal directives such as `@cue`, `@camera`, `@show`, and `@pause`:

```markdown
I have not changed the step size. I have only made the bowl
@cue(kappa -> 25, over: 3s) narrower.
```

Directives anchor to the word immediately following them and are removed before
speech synthesis. A scene change should support the nearby phrase, and unrelated
motion should not be added merely to keep the screen active.

The agent must not rewrite narration to simplify choreography. If the scene
cannot represent a hint faithfully, the agent should explain the mismatch and
ask whether to change the scene or the intent.

Use this integration loop:

```bash
pnpm lesson ref --lesson lessons/my-lesson
pnpm lesson check --lesson lessons/my-lesson
pnpm lesson build --offline --bundle --lesson lessons/my-lesson
pnpm lesson state --lesson lessons/my-lesson --at 10
pnpm lesson frame --lesson lessons/my-lesson --at 10 -o /tmp/frame.png
```

`state --drag <param>=<value>` simulates learner interaction and reconciliation
without a browser. Representative frames help verify visibility and composition.
The complete directive syntax is in
[the reference](./reference.md#narration-directives).

## Review and tune the lesson

Use an offline preview while the prose and cue order are changing:

```bash
pnpm lesson preview --offline --lesson lessons/my-lesson
```

Offline mode does not call a speech or answer provider. It creates silent
placeholder audio at a fixed rate of 60 milliseconds per written character. The
placeholder provides a predictable clock for testing cue order, captions,
seeking, pauses, and interaction. It cannot show whether a cue feels well timed
against the rhythm of a real voice.

Review the lesson in layers.

### Pedagogy

- Is the conceptual obstacle clear near the beginning?
- Does interaction reveal a relationship that a fixed animation would hide?
- Is there one obvious primary action?
- Does the narration direct attention and explain significance?
- Does a pause invite prediction, comparison, manipulation, or explanation?
- Does the ending formalize or transfer what the learner observed?

### Scene and interaction

- Try ordinary, boundary, and deliberately awkward parameter values.
- Confirm that linked representations remain consistent.
- Check drag targets, labels, captions, and controls at desktop and narrow sizes.
- Test touch when learners may use tablets or phones.
- Pause during an interaction, resume, and seek elsewhere.
- Confirm that cameras and other viewer-owned controls behave as intended.

### Choreography

- Verify that every scene hint was encoded or explicitly rejected.
- Check that visuals anticipate or coincide with the relevant spoken phrase.
- Avoid overlapping transitions unless the overlap is intentional.
- Inspect representative states and frames across every chapter.

Once the prose is stable, remove `--offline` to synthesize or reuse the configured
voice:

```bash
pnpm lesson preview --lesson lessons/my-lesson
```

Tune cue offsets against the real prosody without changing the teaching
argument. Provider results are cached, so changing cues without changing spoken
prose does not synthesize the narration again.

## Add a lesson assistant

The optional lesson assistant lets a learner pause playback and ask a written
question. It can answer only in writing, or it can combine a written explanation
with temporary changes to selected scene parameters.

A written-only assistant is the safer default. Add visual control only when a
scene change makes an explanation substantially clearer. The assistant cannot
run arbitrary scene code. It can assign only valid absolute values to parameters
that the lesson explicitly allows.

### Enable the assistant

Add an `assistant` section to `lesson.yaml`:

```yaml
assistant:
  provider: huggingface
  model: google/gemma-4-31B-it:cerebras
  context: assistant.md
  commandable: []
```

An empty `commandable` list enables written answers without giving the assistant
control of the scene. `model` selects the Hugging Face router model used by the
deployed lesson. Then create `assistant.md` with four short sections:

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

Write this file as instructions for a teaching assistant that receives a
semantic scene description and current state, but no screenshot. Include facts
needed to interpret the scene and state important limitations explicitly. Do not
put credentials, private information, or unrelated instructions in this file.
The built context is downloaded by the browser and is not private.

The build adds the lesson title, complete script, spoken narration, scene schema,
presets, constants, and groups. Authors do not need to repeat those generated
details in `assistant.md`.

### Understand the assistant request

The server assembles a readable system message containing:

1. The assistant's teaching role, limitations, and scene capabilities.
2. The complete `assistant.md` guide.
3. A readable list of every scene value, including its internal name, label,
   type, range, default, transition behavior, and whether it may be changed.
4. The lesson's presets, constants, and groups when present.
5. The complete authored script and an explanation of narration directives. The
   separately generated narration is omitted because it duplicates the prose.
6. Instructions for composing written answer beats and returning the required
   JSON.

The current learner message contains the lesson position and visible scene state:

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
started narration sentence, and the active pause prompt. It never includes
future narration. `temporaryAssistantState` identifies values still coming from
the preceding assistant answer rather than from the lesson or learner.

Up to eight successful turns from the current browser page precede a follow-up
question. The server does not persist this history. The provider receives no
tools and cannot call scene code. It returns one JSON object with one to six
validated beats:

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

`set` accepts only allowlisted scene parameters and valid absolute values.
`over` is a visual transition duration from zero to two seconds. The server
concatenates the `say` fields to form the displayed answer.

### Allow visual answers

Run `lesson ref`, then add only parameters with a clear explanatory purpose:

```yaml
assistant:
  provider: huggingface
  model: google/gemma-4-31B-it:cerebras
  context: assistant.md
  commandable:
    - theta
    - show.projection
```

Avoid internal layout values, incidental animation state, and controls that
could leave the scene misleading. `lesson check` rejects unknown parameters.
The server rejects values with the wrong type or outside a declared range.

Describe how to use allowed controls in `# Answer guidance`. For example, require
matched conditions for a fair comparison or discourage changing more than one
variable at a time. The
[unit-circle guide](../lessons/unit-circle/assistant.md) is a small example. The
[optimizers guide](../lessons/optimizers/assistant.md) constrains a larger set of
controls.

Assistant changes are temporary. They disappear when playback resumes or
another question begins. If the learner manipulates a parameter during an
answer, the learner's value takes precedence.

### Invite and evaluate questions

The question field becomes available after playback has begun and is paused. A
learner may pause manually. Use an authored pause when the lesson should
deliberately invite exploration or questions:

```markdown
@pause(prompt: "Try changing the angle. Ask why the projection equals the cosine.")
```

Validate and preview offline first:

```bash
pnpm lesson ref --lesson lessons/my-lesson
pnpm lesson check --lesson lessons/my-lesson
pnpm lesson preview --offline --lesson lessons/my-lesson
```

The offline answer is deterministic and generic. It checks the interface and
request path, but it does not measure the quality of `assistant.md`.
Whenever a learner asks a question in a local `preview` or `serve` session,
Narrable writes `build/assistant-prompt.txt`. This file shows only the system
prompt and the current user message, exactly as they are sent to the model. It
renders line breaks as normal line breaks instead of JSON escape sequences. It
does not include model settings, earlier conversation messages, the response
schema, or authorization data. Offline mode writes the same prompt without
sending it to the provider. The file is a local generated artifact and is not
included in a release bundle.

For repeatable prompt review, add `assistant.eval.yaml`:

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

Render the provider requests without making network calls:

```bash
pnpm lesson build --offline --lesson lessons/my-lesson
pnpm lesson assistant-eval --lesson lessons/my-lesson -o assistant-eval.json
```

Use `--variant both` only to compare the structured prompt with the former raw
context prompt. In dry mode, deterministic answers supply the history and
temporary scene values needed by later questions. The resulting
`simulatedAnswer` and `simulatedBeats` fields verify prompt structure, not answer
quality.

Add `--real` only when you deliberately want to contact the answer provider:

```bash
pnpm lesson assistant-eval --lesson lessons/my-lesson --real -o assistant-results.json
```

Real evaluation requires `HF_TOKEN` and may incur provider costs. To test real
answers without synthesizing real narration, build an offline bundle and serve
that existing bundle:

```bash
pnpm lesson build --offline --bundle --lesson lessons/my-lesson
pnpm lesson serve --lesson lessons/my-lesson
```

Put a dedicated inference token in a gitignored `.env` file as `HF_TOKEN`. Test
direct explanations, questions at different lesson positions, boundary values,
learner-modified states, follow-up questions, and every allowed visual change.

Assistant-enabled bundles include a same-origin Node server because provider
credentials must not be sent to the browser. Lessons without an assistant can
remain static. The server validates question length, conversation history,
answer length, and every scene value. It also applies global, per-browser, and
concurrency limits. These controls reduce operational risk, but they do not
replace a review of the assistant's pedagogy and scientific accuracy.

Before release, confirm that:

- representative questions work at several lesson positions;
- every commandable parameter behaves correctly at its boundaries;
- resuming or asking another question removes temporary changes;
- browser assets contain no credentials; and
- rate limits and structured server logs behave correctly.

## Deploy to Hugging Face Spaces

Deployment changes external state and should happen only after the author has
requested it. Build and review the real-voice lesson locally first:

```bash
pnpm lesson check --lesson lessons/my-lesson
pnpm lesson build --bundle --lesson lessons/my-lesson
```

Use `--offline` only for structural review. A release bundle must contain the
intended narration.

### Release artifact

Publish only `lessons/my-lesson/build/site/` plus a Space `README.md` and
`.gitattributes`. Do not publish the monorepo, caches, `.env` files, or source
credentials.

The repository convention uses an artifact-only orphan branch such as
`release/my-lesson` with one root commit. Record the source commit in its message.
For a later release, replace the artifact, amend that commit, and push it to the
Space's `main` with `--force-with-lease`.

Static lessons may use a static Space. Assistant-enabled lessons use the
generated Docker bundle and these Space card settings:

```yaml
sdk: docker
app_port: 7860
```

### Credentials and limits

Store a dedicated fine-grained inference token as the Space secret `HF_TOKEN`.
Keep build-only credentials such as `HF_TTS_TOKEN`, `TTS_ENDPOINT_URL`, and
`ELEVENLABS_API_KEY` local or in CI. They must not appear in the release branch
or Space variables.

The public assistant API has global hourly, per-browser ten-minute, and
concurrency limits. Override them only with positive integer Space variables:

- `ASSISTANT_HOURLY_LIMIT`;
- `ASSISTANT_CLIENT_10M_LIMIT`;
- `ASSISTANT_MAX_CONCURRENT`.

### Safe release sequence

1. Keep the Space private.
2. Deploy the artifact and review playback, interaction, and captions.
3. Test one real assistant question when enabled.
4. Inspect structured request logs for safe success or error categories.
5. Confirm that browser assets contain no credentials.
6. Make the Space public only after verification and explicit authorization.

For credential rotation, deploy first, replace the secret, revoke the old token,
and test after the container restarts. Test path-containment defenses with a
harmless target such as `/etc/os-release`, never with a sensitive file such as
`/proc/self/environ`.
