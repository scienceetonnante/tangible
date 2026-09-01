// Short command help for creators. Detailed syntax remains in docs/reference.md.

const GENERAL = `Tangible lesson authoring

Usage:
  pnpm lesson <command> [options]

First lesson:
  pnpm lesson new my-lesson --lesson lessons/my-lesson
  pnpm lesson scene --lesson lessons/my-lesson
  pnpm lesson check --lesson lessons/my-lesson
  pnpm lesson preview --offline --lesson lessons/my-lesson

Commands:
  new <id>              Create a complete working lesson.
  scene                 Preview the interactive scene without narration.
  ref                   Print the scene parameters available to cues.
  check                 Validate the scene, script, cues, and assistant.
  preview               Build, serve, and watch a complete lesson.
  build                 Compile the lesson; add --bundle for a site.
  state                 Inspect the computed state at a lesson time.
  frame                 Render a PNG at a lesson time.
  serve                 Serve an existing lesson bundle.
  deploy                Prepare or publish a Hugging Face Space release.
  assistant-eval        Inspect or run lesson-assistant questions.
  assistant-eval-grade  Grade saved assistant evaluation results.

Run "pnpm lesson help <command>" for the most common command options.
Read docs/quickstart.md for the complete first-lesson walkthrough.`;

const TOPICS: Record<string, string> = {
  new: `Create a complete working lesson

Usage:
  pnpm lesson new <id> --lesson lessons/<id>

The command creates lesson.yaml, script.md, scenes/scene.ts, and assets/.
It refuses to overwrite an existing path and prints the next commands.`,
  scene: `Preview the interactive scene without narration

Usage:
  pnpm lesson scene --lesson lessons/<id> [--port 5179] [--host 127.0.0.1]

This command needs no speech provider, narration build, or credential.`,
  ref: `Print the scene vocabulary available to narration

Usage:
  pnpm lesson ref --lesson lessons/<id>

Run this immediately before writing or translating formal cues.`,
  check: `Validate a lesson without network or provider calls

Usage:
  pnpm lesson check --lesson lessons/<id>

This checks the runtime scene, script, formal cues, and assistant configuration.`,
  preview: `Build, serve, and watch a complete lesson

Usage:
  pnpm lesson preview --silent --lesson lessons/<id>
  pnpm lesson preview --offline --lesson lessons/<id>
  pnpm lesson preview --lesson lessons/<id>

--silent uses deterministic silent audio and needs no ffmpeg or model download.
--offline uses the local draft voice and needs ffmpeg; its first run downloads the model.
No mode flag selects the configured production voice.`,
  build: `Compile lesson artifacts

Usage:
  pnpm lesson build --silent --bundle --lesson lessons/<id>
  pnpm lesson build --offline --bundle --lesson lessons/<id>
  pnpm lesson build --bundle --lesson lessons/<id>

--bundle also creates build/site/.`,
  state: `Inspect computed lesson state

Usage:
  pnpm lesson state --at <seconds> --lesson lessons/<id>
  pnpm lesson state --at <seconds> --drag <param>=<value> --lesson lessons/<id>`,
  frame: `Render a lesson frame as PNG

Usage:
  pnpm lesson frame --at <seconds> -o <file.png> --lesson lessons/<id>

Build the lesson with --bundle before rendering a frame.`,
  deploy: `Prepare or publish a Hugging Face Space release

Usage:
  pnpm lesson deploy --prepare --space <namespace/name> --lesson lessons/<id>
  pnpm lesson deploy --dry-run --create --lesson lessons/<id>
  pnpm lesson deploy --create --lesson lessons/<id>
  pnpm lesson deploy --lesson lessons/<id>

--prepare changes only local authored files and makes no Hugging Face API calls.
Deployment requires production narration and a clean Git worktree. The first
remote deployment uses --create and creates the Space privately.`,
};

export function helpText(topic?: string): string {
  if (!topic) return GENERAL;
  const help = TOPICS[topic];
  if (!help) throw new Error(`unknown help topic "${topic}"`);
  return help;
}
