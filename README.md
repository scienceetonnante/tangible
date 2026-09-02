# Tangible

Tangible is an open-source toolkit for creating narrated, interactive lessons. Each lesson combines a scene that learners can manipulate 
with spoken explanation and synchronized visual changes. Lessons can also include an AI assistant that answers questions and demonstrates   
ideas directly in the scene, and they can be published as 🤗Hugging Face Spaces.

[Open “Why adaptive optimizers exist” on Hugging Face
Spaces](https://huggingface.co/spaces/dlouapre/tangible-optimizers). The lesson lets you play or seek through the explanation, orbit the loss
landscape, move the starting point, change optimizer settings, pause for
exploration, and ask written questions to an LLM assistant.

<img src="./docs/assets/optimizer-lesson.png" alt="The Tangible optimizer lesson comparing SGD, momentum, and AdamW on an interactive loss landscape." width="900">

[Browse the public Tangible lessons
collection](https://huggingface.co/collections/dlouapre/tangible-lessons-6a96e2c4be1533d68e65d7a2)
to find lessons published from this repository and by other creators.


## How does it work?

A lesson is generated from a TypeScript scene, a Markdown script file containing narration and scene synchronization, and a YAML configuration file.
The compiler creates an audio track using a TTS model, and synchronizes it to a scene manipulation track.
During playback, the scene combines scripted changes with learner interaction.

When the LLM assistant is asked a question, it receives the lesson, the state of the scene and instructions to control it.

Every scene renders from the complete state at the current lesson time. Seeking directly to a time therefore recreates the same view without replaying the lesson from the beginning.


## Installation

Tangible currently requires Node.js 22 or newer, Git, and pnpm. Node 22 includes
Corepack, which can activate the pnpm version pinned by the repository:

```bash
git clone https://github.com/scienceetonnante/tangible.git
cd tangible
corepack enable
pnpm install
pnpm build
```


## Create your own lesson

Authoring a lesson typically involves:

- building an interactive scene `scenes/scene.ts`,
- writing a script `script.md` containing both the narration and the instructions for the synchronized manipulation of the scene,
- writing `assistant.md` file for custom instructions to the LLM assistant.
- adjusting `lesson.yaml` configuration file

You can work with a coding agent throughout the process (see the `create-tangible-lesson` skill) in particular for scene creation.

### (1) Create a new lesson

First create a new lesson with

```bash
pnpm lesson new my-lesson --lesson lessons/my-lesson
```

### (2) Build the interactive scene

Work on the interactive scene in `scenes/scene.ts`, possibly with a coding agent.

Preview the interactive scene with
```bash
pnpm lesson scene --lesson lessons/my-lesson
```

### (3) Write the script and the choreography

The `script.md` file contains both your narration and instructions for manipulating the scene, for instance:

```
@camera(target: [0, 0.4, 0], distance: 7.4, azimuth: 7°, elevation: 62°, over: 3s) 
Now watch the orange path.

@cue(step -> 30, over: 5s) 
Each step crosses the ravine, overshoots, crosses back, and only slowly makes progress along the floor.
```

Start with your text. Instructions for the choreography are documented in the [reference guide](./docs/reference.md).

Before writing formal cues, run `lesson ref` to see exactly what the scene exposes.
```bash
pnpm lesson ref --lesson lessons/my-lesson
```
It prints the scene’s parameters, valid ranges, default values, ownership rules, camera presets, constants, groups, and other available
controls. 

You can first write the visual intentions in double brackets and ask your coding agent to translate them into formal directives.
```
[[Move to an overhead view before the next sentence.]]
Now watch the orange path.

[[Advance the optimizer to step 30 during the next sentence.]]
Each step crosses the ravine, overshoots, crosses back, and only slowly makes progress along the floor.
```
and ask your coding agent to translate your intentions into formal instructions.


### (4) Check and iterate

Check your lesson with
```bash
pnpm lesson check --lesson lessons/my-lesson
```

To review your lesson while you are building it, you have three options:
- a silent preview
- an audible offline preview that uses a local TTS model
- a production voice version that uses the TTS model you defined in the `lesson.yaml` configuration file


You can first generate a silent preview version: activate closed captions and follow the choreography to see if it matches your intent.
```bash
pnpm lesson preview --silent --lesson lessons/my-lesson
```

Remove the `silent` flag to get an audible offline preview. It requires FFmpeg and downloads a pinned 123 MB local speech model on its first run.
It needs no API key.
```bash
pnpm lesson preview --offline --lesson lessons/my-lesson
```

To use production voice (TTS model defined in `lesson.yaml`)
```bash
pnpm lesson preview --lesson lessons/my-lesson
```

The [creator quick start](./docs/quickstart.md) walks through one visible scene change, one narration edit, and one cue edit.


### (5) Build and review the finished lesson
```bash
pnpm lesson build --bundle --lesson lessons/my-lesson```
```

### (6) Publish on Hugging Face Spaces

After reviewing the complete lesson with its production voice, prepare the local
Space metadata without contacting Hugging Face:

```bash
pnpm lesson deploy --prepare --space namespace/space-name --lesson lessons/my-lesson
```

Review and commit those files. Then authenticate, run the local release checks, and create the Space privately.

```bash
hf auth login
pnpm lesson deploy --dry-run --create --lesson lessons/my-lesson
pnpm lesson deploy --create --lesson lessons/my-lesson
```

Deployment uploads only the release artifact, waits for the Space to start, and
prints logs when startup fails. It never makes an existing Space public, changes
hardware, or replaces secrets. Review the private Space before changing its
visibility. The [deployment guide](./docs/authoring.md#deploy-to-hugging-face-spaces)
explains production narration, assistant secrets, logs, and release checks.

Once your Space is public, you can ask the maintainers to add it to the
[Tangible lessons collection](https://huggingface.co/collections/dlouapre/tangible-lessons-6a96e2c4be1533d68e65d7a2)
by [opening a GitHub issue](https://github.com/scienceetonnante/tangible/issues/new)
with the Space URL. The collection accepts public lessons from any Hugging Face
account.


## Current scope and limitations

The first release supports desktop and tablet layouts. Portrait phones ask visitors to rotate the device or use a larger screen. 
Phone landscape uses a compact layout that is still being refined.


## Documentation

- [Creator quick start](./docs/quickstart.md) leads from a fresh clone to a
  modified lesson without paid credentials.

- [Authoring a lesson](./docs/authoring.md) covers scene design, narration,
  choreography, review, assistants, and deployment.

- [Reference](./docs/reference.md) documents every command, lesson file,
  manifest field, scene export, and narration directive.

- [Contributing](./CONTRIBUTING.md) explains how to work on lessons or the
  framework.


## License

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting changes.

Tangible is licensed under the [Apache License 2.0](./LICENSE).
