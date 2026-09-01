# Create your first lesson

This guide takes you from a fresh clone to a modified, working lesson without
an API key. The first visible scene should take a few minutes. The complete
scene and narration exercise should take about 30 minutes.

## Install the repository

Install Node.js 22 and Git first. Node 22 includes Corepack, which reads the
pnpm version pinned in this repository. Enable it once, then clone and build:

```bash
corepack enable
git clone https://github.com/scienceetonnante/tangible.git
cd tangible
pnpm install
pnpm build
```

If your Node installation does not include Corepack, follow the
[official pnpm installation guide](https://pnpm.io/installation). You do not
need ffmpeg, a speech model, or an API key for the first part of this guide.

Run `pnpm lesson --help` at any time to see the main commands.

## Open an existing lesson

Start the complete unit-circle lesson with deterministic silent narration:

```bash
pnpm lesson preview --silent --lesson lessons/unit-circle
```

Open the local address printed by the command. Press Start, move the red point,
pause, seek, and resume. The silent clock lets every visual and interaction work
without downloading a model. Stop the preview with `Ctrl+C` when you are ready.

## Generate a working lesson

Create a lesson named `my-lesson`:

```bash
pnpm lesson new my-lesson --lesson lessons/my-lesson
```

The generated lesson already contains a scene, a range control, narration, a
synchronized cue, and a pause. It does not contain an assistant, deployment
target, or production speech provider.

Open the scene by itself:

```bash
pnpm lesson scene --lesson lessons/my-lesson
```

Move the Amount slider. The number and bar should update together. This preview
does not read the narration or contact a provider.

## Change the scene

Open `lessons/my-lesson/scenes/scene.ts`. The parameter called `amount` is the
shared vocabulary between the control, the visible result, and the narration.

Make one obvious change. For example, change its default from `30` to `50` and
change the heading “One value, one visible result” to language related to your
subject. The running scene preview should reload automatically.

Print the exact scene contract:

```bash
pnpm lesson ref --lesson lessons/my-lesson
```

The output should list `amount`, its range from 0 to 100, and the new default.

## Change the narration and cue

Open `lessons/my-lesson/script.md`. Ordinary prose is spoken verbatim and also
becomes captions. Formal directives beginning with `@` are silent commands.
Double brackets contain silent natural-language intent.

The starter contains this synchronized change:

```markdown
Then it @cue(amount -> 80, over: 2s) grows, and the bar responds immediately.
[[Keep the bar change aligned with the word "grows".]]
```

Change one sentence in the spoken prose. Then change the cue target from `80`
to `60`. The directive remains next to the word that the visual change supports.

The pause invites the learner to take control:

```markdown
@pause(prompt: "Move the slider and notice how the number and bar stay connected.")
```

Replace the prompt with a useful observation or prediction for your subject.

## Check and build the lesson

Validate the runtime scene, narration, cues, and configuration:

```bash
pnpm lesson check --lesson lessons/my-lesson
```

Create a complete site with silent narration:

```bash
pnpm lesson build --silent --bundle --lesson lessons/my-lesson
```

Inspect the final state and render a representative frame:

```bash
pnpm lesson state --lesson lessons/my-lesson --at 30
pnpm lesson frame --lesson lessons/my-lesson --at 30 -o /tmp/my-lesson.png
```

At this point you have changed and built a complete lesson without a credential,
model download, or paid service.

## Add audible draft narration

Install ffmpeg through your operating system's package manager and confirm that
`ffmpeg -version` works. Then run:

```bash
pnpm lesson preview --offline --lesson lessons/my-lesson
```

The first offline preview downloads a pinned 123 MB local speech model. Later
previews reuse it. Offline mode never calls a paid speech or answer provider.

## Continue from here

The [authoring guide](./authoring.md) explains scene design, responsive review,
natural-language hints, formal choreography, real narration, the optional
lesson assistant, and safe Space deployment. The [reference](./reference.md)
contains the complete command and directive syntax.
