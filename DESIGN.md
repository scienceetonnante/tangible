# Interactive ("Explorable") Video

*A primer on the medium pioneered by the 3blue1brown + Ben Eater quaternion series ([eater.net/quaternions](https://eater.net/quaternions), 2018), together with a technical dissection of that platform (from an inspection of the deployed site, February 2026 build) and a proposed architecture for producing lessons in this medium on arbitrary topics, from a single authored script. The platform described here has since been built; see [PLAN.md](./PLAN.md) for build status and [README.md](./README.md) for how to run it. §10 below records the normative invariants the implementation upholds.*

---

## 1. What it is

The defining move is easiest to state by saying what it is **not**: it is not a video with interactive controls bolted on. There are no pre-rendered frames. What looks like a video is a **3D (or 2D) scene that the browser draws from scratch many times a second**, paired with a **recorded voiceover that acts as a clock** telling the scene what to look like at each moment. "Playing" means letting that clock drive the scene. "Interacting" means taking the controls away from the clock for a moment, after which the scene smoothly returns to whatever the narration is currently describing.

The format sits at the intersection of two older things. From **narrated video** it keeps a guided throughline: a voice walks you through an argument in a fixed order. From **explorable explanations** — the lineage of Bret Victor's reactive documents and his *Tangle* library, later carried by Nicky Case, Bartosz Ciechanowski, Distill, and others — it inherits the idea that a reader builds intuition by *manipulating variables and watching the result*, not by passively receiving it. Andy Matuschak, writing about the quaternion series, called these "narrated explorables" and offered three mental models for them: a video you can reach into, a screencast of an applet, or an applet with a narrator. The quaternion series is the best-known instance: Grant Sanderson authored the content, Ben Eater built the platform, and the source was never published (a GitHub issue asking for it went unanswered).

To the viewer it behaves like a short narrated lesson with a play button and a scrubber. At any point they can grab the canvas — rotate it, zoom, drag a point, scrub a number inside an equation — and the scene responds **live**, because it is being computed in real time rather than played back. When they let go, the scene does not jump: it glides back to the configuration the narration has reached by that moment. The author controls the story; the viewer controls the *exploration around it*.

## 2. Why it is useful

The pedagogical case is the explorable-explanations case. Many ideas — especially in mathematics, physics, and engineering — have their insight stored in a **continuous parameter** or a **spatial configuration**: what happens to *this* as I vary *that*, or what a structure looks like from another angle. A static image shows one value; a video shows a path the author chose; an explorable video lets the learner sweep the parameter themselves and *feel* the relationship. Seeing the in-between states, and being able to break the example on purpose, is where intuition tends to form.

The format's particular strength over a plain explorable is that it does not abandon authorial guidance. A bare sandbox can leave a learner not knowing what to try; a narrated spine tells them where to look while still letting them wander. That combination — direction plus agency — is the reason it is worth the extra effort.

The trade-offs, updated in light of the architecture proposed below:

- **Cost.** As Eater and Sanderson noted, it is "both platform and content." The platform cost is paid once (and, as §4 shows, the player itself is modest); the per-lesson cost concentrates in building the scene and directing the choreography — see §8.
- **Reach.** A bespoke web page does not benefit from a recommendation engine; Eater and Sanderson observed that YouTube drives the large majority of their views. Their mitigation — publish a plain screen-recording of each lesson on YouTube as both fallback and funnel — remains the right one and comes almost for free.
- **Accessibility and languages.** In the exemplar these are weaknesses: eater.net ships no captions and no transcript. In a script-first pipeline (§5) they flip into strengths: the narration script *is* the transcript, word-level timestamps make synchronized captions automatic, and a translated script re-synthesizes into a new language with all animation cues re-aligning automatically.

## 3. How the exemplar actually works

*Based on inspection of the deployed site in July 2026. The site was quietly rebuilt on a modern stack (Vite, React 19, three.js, Howler.js, KaTeX) with a February 2026 build date, but the data format and behavior match the 2018 original. Nothing here is speculation; it comes from the served bundle and data files.*

### There is no video

Each of the seven lessons (`eater.net/quaternions/video/{id}`) is served as exactly three media assets: the narration audio (webm + mp3 fallback), a thumbnail, and **one JSON file that is the entire "video."** For the 5½-minute intro lesson the JSON is 164 KB and contains two tracks:

- **`keyframes`** — ~100 entries of `{timestamp, state}`, where each `state` is a **complete snapshot of the whole scene state**: which sub-scene is displayed, every quaternion component, angle/axis values, the list of visible elements, and the camera position of each 3D view. Median gap between keyframes ≈ 2.7 s.
- **`cursor`** — the presenter's mouse position sampled at exactly 30 fps for the whole lesson, in a 2560×1440 reference frame, replayed as the fake cursor the viewer sees moving over the scene.

The telling detail is the precision: timestamps like `7.357861`, camera positions with fifteen decimals. **These keyframes were not written by hand — they were recorded while Grant Sanderson performed the lesson live in the app**, in a record mode that logged state snapshots and mouse positions while the audio was captured. Eater solved the authoring problem by *performance capture*, not by scripting. That explains both the format's fluidity and why the platform never generalized: every lesson requires the author to physically perform it, against tooling that was never released.

### Clock and playback

The audio element is the single source of truth for time. A `requestAnimationFrame` loop polls the audio's current time each frame (via Howler, rounded to 0.01 s) and sets it on a shared state object. A precomputed lookup table at 10 ms resolution maps any time to its bracketing keyframe pair, so seeking anywhere is O(1) — the scrubber works instantly, with no decoding, because state is a pure function of time.

Between keyframes, values are interpolated by type: plain lerp for scalars, **normalized lerp (nlerp)** for quaternions and axis vectors, direction-nlerp with separately-lerped magnitude for camera positions (so the camera stays on its orbit), and snap-to-left-keyframe for discrete values (active scene, visibility lists, booleans).

### The catch-up recipe (concrete numbers)

Interaction and playback write to the same state; the renderer does not care who wrote last. The reconciliation works like this:

- User interaction sets one of four **independent "modified" flags**, each with a timestamp: `cameraModified`, `numbersModified`, `visibleElementsModified`, `angleFormModified`. Ownership is per-channel, not global.
- For a modified channel, the user's value **overrides the scripted state for 3 seconds of playback** after the last touch (a hold time). While playback is paused, the displayed value is frozen: the hold does not expire and no return blend runs. Resuming starts a fresh 3-second playback-time hold; seeking discards the interaction and immediately rejoins the scripted timeline.
- Then, over roughly the next 5 seconds, the displayed value is blended each frame as `displayed = lerp(scripted, userValue, 0.92)` — an exponential glide back onto the scripted timeline. Discrete channels (visibility, angle form) simply revert after the hold, with no blend.
- Narration never stops for ordinary interaction. Audio pauses **only** when the user's interaction switches to a different sub-scene than the one being narrated.
- The fake cursor hides while the user is scrubbing numbers (the two would fight for attention).

This recipe — per-channel ownership, short hold, exponential return — is most of what makes the medium feel right, and it is worth copying essentially verbatim.

### What the exemplar lacks

No captions, no transcript, no synchronized text of any kind (accessibility is delegated to the YouTube fallback recordings). No chapter markers within a lesson — "chapters" are seven separate short lessons, each its own page, audio, and JSON. No state in URLs. And no authoring tools ever shipped: the record mode exists only in whatever private tooling produced the JSON.

### The one real architectural rule

For the scrubber to work — and for catch-up to land on the right value — every parameter's value must be computable directly from time *t* (**value-at-time**), never accumulated frame by frame. "At time *t*, `q` = (this interpolation)" lets you jump anywhere and reconstruct the state instantly; "add 0.1 each frame" would not. Eater's complete-snapshot keyframes satisfy this trivially. The consequence: genuinely history-dependent content (a live physics simulation) is not directly seekable and needs a different strategy (re-simulate from periodic checkpoints, or pre-bake the trajectory into a track).

## 4. Two ways to author, and why script-first wins now

Eater's performance capture and the approach proposed here — a narration script with embedded cue markup, synthesized to voice — are two answers to the same question: **where do cue timings come from?**

Performance capture requires a live performer, custom recording tooling, and a full re-performance for every edit and every language. It was the right call in 2018, because the alternative — hand-aligning written cues against an audio waveform — was the single most expensive part of the job.

That cost has since disappeared. Modern TTS APIs return precise timing information aligned to the input text:

- **ElevenLabs** has a `with-timestamps` endpoint returning **character-level** start/end times aligned to the input text. A cue's time is computed from the character offset of its tag in the script. Best-in-class voice quality, strong in French.
- **Private cloned-voice endpoints** may return only PCM audio. For these, the compiler synthesizes at the union of cue anchors and sentence boundaries, derives exact boundary times from sample counts, and estimates character timing only within each short segment.
- **Google Cloud TTS** resolves SSML `<mark name="..."/>` tags to `{name, seconds}` timepoints in the batch synthesis response (v1beta1 only; a reported regression on some voices should be verified before committing).
- **Azure Speech** fires `<bookmark>` events with audio offsets, via its SDK (not plain REST).
- **Open models** (e.g. Kokoro) have community timestamp support, usable for fully local builds.

And crucially, the pipeline is **voice-agnostic**: to replace the synthetic voice with a human recording, record a reading of the same script and run **forced alignment** of the audio against the known text (stable-ts, or Montreal Forced Aligner for gold-standard accuracy — since the transcript is known, this is alignment, not speech recognition, and it is reliable). Same cue table, same everything downstream. TTS is the draft voice; the author's real voice is a drop-in upgrade at the end.

Script-first therefore buys, structurally:

1. **Cheap iteration** — change a sentence, re-synthesize a paragraph, rebuild. No re-performance.
2. **Captions for free, and better than free** — the script is the transcript and word timestamps enable synchronized (even karaoke-style) captions, fixing the exemplar's accessibility gap.
3. **Multilingual lessons cheaply** — translate the script keeping cue tags in place, re-synthesize; the marks re-resolve to the new audio's timings automatically. One authored lesson, N languages.
4. **The lesson as data** — the script is diffable, reviewable, versionable text.
5. **Agent-writable production** — because every artifact is plain text validated by a compiler, an AI agent can draft, edit, and localize lessons end-to-end. This is developed as a design requirement in §5.7.

What script-first authors badly is **camera choreography**: writing camera paths as text is miserable. The fix is to keep a small performance-capture escape hatch (§5), used only for the tracks that want it.

## 5. Proposed architecture

Three layers with a hard separation: an **authoring format**, a **build step**, and a **runtime player**. The player is generic and shared by all lessons; a topic contributes only a scene module and a script.

```
script.md ──┐
            ├── build ──► lesson.audio.mp3 + lesson.tracks.json + lesson.captions.vtt
scene.ts ───┘                                        │
                                                     ▼
                              player (shared): audio clock ► interpolator ► state ◄ interaction
                                                                              │
                                                                              ▼
                                                                    scene render = f(state)
```

### 5.1 The lesson bundle

```
lessons/unit-circle/
  script.fr.md        # narration + cues (one file per language)
  script.en.md
  scene.ts            # scene module: parameter schema + render function
  assets/             # recorded tracks (camera paths), textures…
  build/              # generated — never edited by hand
    fr/audio.mp3  fr/tracks.json  fr/captions.vtt
    en/…
```

### 5.2 The scene module

A scene declares its **parameters** as a schema the platform consumes, and renders as a pure function of the state:

```ts
export const parameters = {
  theta:       { type: "scalar",     default: 0,        range: [0, 6.2832],
                 interpolate: "lerp", ownership: "script" },
  q:           { type: "quaternion", default: [1,0,0,0],
                 interpolate: "nlerp", ownership: "script" },
  camera:      { type: "orbit",      default: { /*…*/ }, ownership: "viewer" },
  "show.projection": { type: "boolean", default: false,  ownership: "script" },
  form:        { type: "enum",       values: ["components", "angleAxis"],
                 default: "components", ownership: "shared" },
  code:        { type: "text",       default: "", interpolate: "typewriter",
                 ownership: "shared" },
};

export function render(state, ctx) { /* three.js / canvas drawing from state */ }
```

`ownership` encodes the reconciliation policy per parameter: `script` (viewer may perturb; catch-up pulls it back), `viewer` (the script never overwrites it once touched — typically the camera), `shared` (viewer's choice holds until the script next sets it). Getting these right per-parameter is, as the exemplar shows, most of what makes the medium feel correct.

DOM-based scene controls write and reset declared parameters through the scene
context, entering the same reconciliation path as canvas handles. The `text` type's
`typewriter` interpolation deletes to the common prefix and types the replacement,
with a short deterministic pause at line breaks.

A scene may also export named build-time **bakers**. Each baker declares the schema
parameters it reads and writes, then returns one absolute state per requested step.
The compiler supplies only the declared reads, validates every returned write, and
turns the results into ordinary keyframes; baker code never runs in the player.

### 5.3 The build step

A compiler that:

1. **Extracts** the plain narration text from the script (per language), noting the character offset of every cue tag.
2. **Checks and evaluates authored state** in script order, including any `@bake` directives. This pass validates names, options, schema values, and baker output using schema defaults and authored cue targets—not audio-time interpolation—so `check` and `build` compute the same values without TTS.
3. **Synthesizes** the audio (or force-aligns a provided human recording against the same text) and resolves every cue tag to an absolute time — the timestamp of the word the tag precedes, plus any explicit offset.
4. **Expands** the sparse cue list into **dense per-parameter keyframe tracks** — essentially generating Eater's JSON format. All easing and transition logic is baked into the tracks at build time, which is what keeps the runtime dumb and perfectly seekable: state at time *t* is a lookup and an interpolation, never "play forward from zero."
5. **Checks resolved choreography** for timing-dependent conflicts such as overlapping transitions or recorded and generated tracks targeting the same parameter.
6. **Emits** audio, tracks, chapters, and a WebVTT caption file from the word timestamps.

### 5.4 The runtime player (shared, built once)

- **Clock**: an `<audio>` element as master clock, polled in a `requestAnimationFrame` loop — exactly the exemplar's scheme. No synthetic clock; native buffering and seeking for free. (WebVTT metadata cues via the TextTrack API are a native alternative for triggering, but `cuechange` granularity is browser-dependent, up to ~250 ms; polling `currentTime` per frame and treating tracks as authoritative state is tighter and simpler.)
- **State store**: a flat store of named parameters. A signals library (Preact Signals core is framework-agnostic and healthy) works well for the DOM parts (readouts, formula numbers); the hot render path reads the store directly each frame rather than going through any framework's re-render cycle.
- **Interpolator**: evaluates the keyframe tracks at the current time — lerp, easing curves, nlerp/slerp for rotations, orbit interpolation for cameras, snap for discrete values. This is a few hundred lines and should be written, not adopted: it is the heart of seekability and needs to match the parameter type system exactly. (GSAP — fully free since April 2025, including all formerly-paid plugins, though under a custom license rather than MIT — is a fine substitute if its easing/plugin ecosystem is wanted; its timelines are fully seekable.)
- **Reconciliation**: the exemplar's recipe, generalized to the schema — per-parameter modified flags, ~3 s playback-time hold, exponential blend back (`displayed = lerp(scripted, user, 0.92)` per frame), discrete revert after hold, and audio pause only on scene-changing interaction. Pausing freezes modified values; resuming restarts the hold; seeking clears interaction state.
- **Renderers**: three.js for 3D (r3f optional if the team prefers React for scenes), Canvas 2D or SVG/D3 for 2D, KaTeX for math — including drag-to-scrub numbers inside rendered formulas, an exemplar component worth rebuilding early because it makes equations themselves interactive surfaces.
- **The board** (optional panel): a region of the layout — typically a side or bottom strip — that displays KaTeX equations and short text fragments following the narration: a derivation appearing line by line, a term lighting up as the voice mentions it, a definition held on screen while the scene moves. Deliberately far less than Manim — no animated typography beyond appear / highlight / dim / clear — because its job is to be the lesson's written trace, not a second stage. Board items are driven by the same track system as everything else (each item's display state is just a discrete parameter), so they are scripted, seekable, and translated exactly like the rest of the lesson. Subtitles stay separate, in the standard caption display: the board is for content that should *persist*, not for the transcript scrolling by.
- **Chrome**: play/pause, scrubber with chapter markers, caption display, fullscreen, keyboard shortcuts — shared across all lessons.

### 5.5 The performance-capture escape hatch

Keep a **record mode** in the player: play the draft audio, manipulate viewer-ownable parameters (above all the camera) by hand, and save the result as a recorded track in `assets/`. The script then references it (`@track(camera, "orbit-01")`). Recorded tracks and cue-generated tracks are the same thing at runtime — dense value-at-time keyframes — so they compose freely. A recorded pointer track (the exemplar's fake cursor, for "look here" gestures) works identically. This hybrid keeps markup for what markup is good at (parameters, visibility, values) and capture for what capture is good at (continuous spatial gestures).

### 5.6 What gets reused across topics

Honestly: the player, the compiler, the chrome, the board panel, the reconciliation logic, the caption/language pipeline, and a growing library of scene *ingredients* (axes, grids, vector arrows, draggable points on curves/spheres, scrub-able formula numbers, plot panels with linked highlighting). The scene itself — a quaternion scene, a Fourier scene, an epidemiology scene — is irreducibly bespoke. The platform amortizes everything around the scene; it does not make the scene cheap.

### 5.7 Designed for agent authoring

Everything above doubles as an affordance for AI-assisted production, and this should be treated as a requirement rather than a nicety: the realistic workflow has an AI agent (Claude Code or similar) drafting the script, the choreography, the translations, and much of the scene code, with the human acting as director and editor. For that loop to work, the platform must guarantee:

- **Everything is text.** Script, schema, scene code, recorded tracks (JSON) — all diffable, reviewable, and writable by an agent. No binary project files, no state that lives only in a GUI.
- **The compiler is the agent's feedback loop.** Validation errors must be precise and actionable ("cue at line 23 targets `show.projectionn`, unknown parameter — did you mean `show.projection`?"), because errors are what the agent iterates against. A `--check` mode that validates without calling the TTS API keeps that loop fast and free.
- **The schema is introspectable.** A scene module's parameters, types, ranges, presets, and named constants are exported as data, and the build tool can emit a *cue-reference sheet* for any scene — exactly the context an agent needs in order to write cues for it.
- **State is inspectable at any time.** Because state is a pure function of *t*, a CLI can dump the full scene state at any timestamp as JSON (`lesson state --at 14.2`), letting an agent verify its choreography numerically without rendering anything.
- **Frames are renderable headlessly.** The same property makes visual verification cheap: `lesson frame --at 14.2 -o frame.png` renders exactly what the viewer would see at that moment, so a vision-capable agent can check its own work ("is the projection actually visible when the voice says *cosinus*?").
- **Builds are deterministic** (given cached audio): same script in, same tracks out. The agent can tweak one cue and diff the result.
- **Translation is mechanical.** The agent translates the prose keeping directives intact; the build re-aligns every cue to the new audio automatically. Nothing about timing is redone by hand.

The intended division of labor: the agent drafts — script, cues, scene scaffolding from the ingredient library, translations — and the human directs: the pedagogical arc, what the scene should be, taste calls on pacing. The performance-capture escape hatch (§5.5) is the one deliberately human channel — recorded camera gestures — and even it produces JSON an agent can subsequently trim or retime.

### 5.8 Pause-time lesson assistant

An optional lesson assistant extends a pause without extending or mutating the
authored timeline. After playback has begun, both a manual pause and an authored
`@pause` enable a question field below the transport. The model receives the full
script and narration, a per-language semantic description of the layout and
controls, the scene schema and presets, the current visible state, and the bounded
conversation history.

The model returns a declarative sequence of written beats. Each beat contains text,
absolute values for explicitly allowlisted parameters, and a short transition
duration. The server validates names, types, ranges, length, and count, then returns
the answer immediately without speech synthesis. Model output is data, never
executable code.

The full answer appears below the question field while the lesson clock remains
paused. A separate elapsed-time clock spaces scene commands at a comfortable
reading pace and drives a temporary track composed over the normal
evaluated-and-reconciled state. Learner interaction stays active: a parameter
touched during an answer immediately masks the assistant for that parameter, while
other answer tracks continue. Asking another question or resuming playback discards
the temporary layer; `script`, `shared`, and `viewer` ownership in the underlying
state were never modified.

Provider credentials require a trusted same-origin server. Assistant-enabled
bundles therefore include a small Node server and Dockerfile suitable for a
Hugging Face Docker Space; lessons without assistant configuration remain fully
static. The browser player knows only the typed request/response contract and does
not import provider or TTS code. The lesson server orchestrates the two independent
provider calls: it asks the Hugging Face router for a declarative answer plan,
validates that plan, then sends its beats to the private voice endpoint. The voice
endpoint has no LLM responsibility. Request lifecycle logs are structured JSON and
deliberately exclude question text, scene values, credentials, and generated audio.

## 6. Markup format — draft specification

The script is Markdown: prose is the narration, verbatim. Two kinds of directives are embedded in it. **Block directives** stand on their own line and structure the lesson; **inline directives** sit inside the prose and anchor to the word that follows them. Directives are stripped before synthesis; their position in the text is what gives them a time.

### 6.1 Front matter

```yaml
---
title: Le cercle unité
scene: ./scene.ts
language: fr
voice: elevenlabs:antoine        # or  human: ./assets/voix-david.wav (forced-aligned)
---
```

### 6.2 Block directives

| Directive | Meaning |
|---|---|
| `@scene(name)` | Switch the active scene/sub-scene (a discrete parameter; snaps). |
| `@chapter(Titre)` | Chapter marker on the scrubber. |
| `@pause(prompt: "Essayez de déplacer le point.")` | Hard checkpoint: the prompt is spoken, then the clock halts at its boundary before any following narration or anticipated visual. The normal play control resumes it, and the scene remains fully interactive while paused. |

### 6.3 Inline directives

The core form assigns **absolute target values** to parameters (never deltas — the value-at-time rule):

```
@cue(theta -> 1.5708, over: 2s, ease: inOutCubic)   animated transition
@cue(theta = 0)                                     instant set
@cue(theta -> 3.14, show.projection = true, over: 2s)   several assignments; options apply to all
```

Sugar for the common cases:

```
@show(projection, cosLabel)      ≡  @cue(show.projection = true, show.cosLabel = true)
@hide(projection)
@camera(sideView, over: 3s)      camera preset defined in the scene module
@track(camera, "orbit-01")       play a recorded track from assets/
```

**Timing.** A cue's time is the onset of the word immediately following it. An optional `at:` shifts it: `at: +0.8s` (delay), `at: -0.5s` (anticipate), `at: sentence-end`. Experience with the exemplar suggests most cues want to *slightly anticipate* the word they illustrate; a global default anticipation (e.g. −200 ms) can be set in front matter and overridden per cue.

**Values** are typed by the schema: numbers, booleans, enum strings, vectors `[0, 1, 0]`, quaternions `[w, x, y, z]`. Named constants may be defined in the scene module and used in cues (`@cue(theta -> HALF_PI)`).

**Computed processes** use a scene-exported baker:

```
@bake(descent, steps: 3, over: 6s, ease: inOutCubic)
```

`steps` is a positive integer (default `1`). `over` is the total duration (default:
the manifest transition duration times `steps`); endpoints are evenly spaced and
each segment uses the selected easing. Bakers consume timing-independent authored
state: schema defaults followed by cue targets and prior baker output in script
order. Repeat one-step bakes when separate updates need separate narration anchors.
Every baker must return exactly `steps` records containing exactly its declared
writes, with schema-valid values. It is run twice from cloned identical input during
checking to catch obvious nondeterminism; time, randomness, I/O, DOM access, and
mutable module state are forbidden by contract.

**Easing** names: `linear`, `inOutCubic` (default for `->`), `inCubic`, `outCubic`, `spring`. Defaults settable in front matter.

**Conflict rule.** If a new cue targets a parameter whose previous transition is still running, the previous transition is truncated at the new cue's start time and its interpolated value at that instant becomes the new transition's from-value. Computed at build time, so the result is still a pure value-at-time track. The compiler warns, since overlaps are usually authoring mistakes.

### 6.4 Board directives

The board (§5.4) has its own small directive family. An item is declared with an id at the moment it first appears, then driven by later directives:

```
@board(euler: $e^{i\theta} = \cos\theta + i\sin\theta$)     define & show an equation (KaTeX)
@board(note: "La projection du point, c'est le cosinus.")   define & show a text item
@highlight(euler.cos)      emphasize a tagged sub-expression
@dim(euler)                keep on screen, de-emphasized
@clear(euler)              remove one item
@clear(board)              remove everything
```

Sub-expressions are targeted by tagging them in the KaTeX source with `\htmlClass{cos}{\cos\theta}`, then addressing `item.tag`. Items stack in order of appearance; each item's display state is a discrete parameter (`hidden | shown | dimmed`, plus highlight flags), so board content participates in the same compiled tracks, seeks correctly, and — being ordinary script text — is translated with the narration. Anything fancier than this (morphing equations, choreographed algebra à la Manim) is out of scope by design: if a derivation needs animating, it belongs in the scene.

### 6.5 A worked example

```markdown
---
title: Le cercle unité
scene: ./scene.ts
language: fr
voice: elevenlabs:antoine
---

@scene(circle)
@chapter(Le cercle et l'angle)

Voici un cercle de rayon un. Le point rouge est repéré par un angle,
qu'on appelle @cue(show.thetaLabel = true) thêta. Regardez ce qui se
passe quand on le fait @cue(theta -> 6.2832, over: 4s, ease: inOutCubic)
varier : le point fait le tour complet du cercle.

@show(projection) Projetons maintenant ce point sur l'axe horizontal.
La longueur obtenue, c'est @cue(show.cosLabel = true) le cosinus de
thêta. @board(cosdef: $x = \cos\theta$)

@pause(prompt: "Déplacez le point rouge vous-même et observez le cosinus.")

@cue(theta -> 1.5708, over: 2s) Reprenons. À quatre-vingt-dix degrés…
```

The compiler strips the directives, synthesizes the remaining prose, gets back timestamps, and might resolve the first `@cue` to t = 8.42 s (onset of « thêta »), producing in `tracks.json`:

```json
{
  "tracks": {
    "theta": [
      { "t": 0,      "v": 0.6 },
      { "t": 10.11,  "v": 0.6 },
      { "t": 14.11,  "v": 6.2832, "ease": "inOutCubic" },
      { "t": 31.90,  "v": 6.2832 },
      { "t": 33.90,  "v": 1.5708, "ease": "inOutCubic" }
    ],
    "show.thetaLabel": [ { "t": 0, "v": false }, { "t": 8.42, "v": true } ],
    "board.cosdef":    [ { "t": 0, "v": "hidden" }, { "t": 27.30, "v": "shown" } ]
  },
  "chapters": [ { "t": 0, "title": "Le cercle et l'angle" } ],
  "pauses":   [ { "t": 29.75, "prompt": "Déplacez le point rouge…", "tail": 0 } ]
}
```

The runtime never sees the markup — only audio, tracks, captions.

## 7. Tooling (state of the field, mid-2026)

**Adopt nothing wholesale; study two things; use parts.** No maintained off-the-shelf platform implements this medium's authoring model.

- **Liqvid** (ex-RactivePlayer) — the only maintained framework in exactly this niche: React components subscribing to a `Playback` master clock, with KaTeX and react-three-fiber integrations, MIT. Architecturally the closest existing match and worth reading closely; but a single-maintainer project with a thin community, and it has no script→cues authoring story. *Study, don't build on.*
- **Motion Canvas** — the best existing authoring UX for narration sync (audio waveform in an editor, `waitUntil('cue')` time events dragged into place), but it inverts the model proposed here (cues in code, timings in an editor), explicitly resists embedding, has no in-scene interactivity concept, and has been stalled since late 2024. *Design reference for the eventual timeline-inspector tooling.*
- **Remotion** — maintained, and its Player embeds live compositions; but frame-clocked (audio follows the frame clock, resynced on drift) rather than audio-clocked, and paid at company scale. *Not a fit.*
- **Theatre.js** — conceptually ideal sequencer; development has effectively vanished into a private repo. *Avoid depending on it.*
- **Idyll** — the markup-language pioneer for explorables; ecosystem stagnant; scroll/interaction-driven, no audio clock. *Useful precedent for the markup design only.*
- **GSAP** — fully free since April 2025 (Webflow acquisition), timelines fully seekable. Optional; a small custom interpolator matched to the parameter type system is likely the better core.
- **Rendering/state**: three.js (healthy, monthly releases), react-three-fiber v9 (healthy), Preact Signals (healthy, framework-agnostic core).
- **TTS timestamps**: ElevenLabs character-level timestamps; Google SSML `<mark>` timepoints (v1beta1); Azure `<bookmark>` events (SDK only). **Forced alignment** for human audio: stable-ts (maintained, aligns audio to a known transcript — the exact shape of this problem) or Montreal Forced Aligner (accuracy gold standard).
- **Native browser text-sync machinery**: WebVTT metadata cues + TextTrack API (for captions certainly; for animation triggering, per-frame polling of `currentTime` is tighter). The W3C **SyncMediaLite** draft is relevant prior art for the text-audio sync data model.

## 8. What makes a topic a good fit

The format is expensive, so the test for using it has to discriminate. What it needs is a **relationship whose insight is its *shape* rather than any single point on it** — where understanding comes from seeing how a whole family of cases hangs together, not from one input paired with one output. When that holds, the learner can drive something and watch the coupled parts recompute, and the recomputation is the lesson.

What the learner drives need not be a coordinate, and need not be swept. It can be a quantity, a vector, a toggle, a branch, a structure they rearrange, an expression they edit, a viewpoint, or a premise they change. The "re-view the object from another angle" case generalizes to **linked representations**: act on one view and the others update — a 3D rotation, a signal moving between its time and frequency pictures, a probability distribution shown both as a formula and as samples drawn from it.

That principle alone is too permissive — almost anything can be made manipulable — so the discriminating fit comes from two guardrails:

- **The off-path states have to carry meaning.** The states the author did not choose, including the edge cases a reader pushes the system toward, must themselves be informative. If only the author's chosen trajectory matters and the in-between is noise, a plain video is strictly better.
- **A guide still has to be wanted.** The topic needs a right order in which to build the idea up, so the narrated spine adds something a bare sandbox would not. Without that, an open explorable beats a narrated one.

The blunt negative test: if a single figure, one chosen animation, or a paragraph conveys the idea, the interactivity is decoration. Topics that are largely sequential argument, definition, or one-shot illustration are better served by ordinary video or a written explorable — the live-rendering machinery would not pay for itself.

One structural note from the exemplar: history-dependent simulations (flocking, epidemics, fluid) violate the value-at-time rule and are not directly seekable. They are not excluded — pre-bake the scripted trajectory into a track, and let free exploration run the live simulation — but they cost an extra mechanism and should not be the first lesson built.

## 9. Where the cost lives, and the first milestone

With synchronization automated and the player built once, the per-lesson cost concentrates in exactly two places:

1. **The scene module** — the visualization and its parameter design. Irreducibly bespoke per topic; partially amortized by the ingredient library (§5.6).
2. **Direction** — deciding what the scene should do at each sentence. The markup makes choreography cheap to *express and iterate*, not cheap to *conceive*. This is the editorial craft that remains, and should remain, expensive.

**First milestone: one vertical slice, then extract the platform from it.** Pick a forgiving 2D topic (the unit circle, a Fourier construction, a random walk) rather than starting at quaternion difficulty. Build: a script with ~10 cues → TTS synthesis with timestamps → compiled tracks → a player with the audio clock, the interpolator, one interactive parameter with the catch-up recipe, captions, a scrubber, and a board with two or three synchronized equations. Include the agent-facing tools (§5.7) from day one — `--check`, the state dump, the headless frame render — and have an AI agent write the first draft of the script and choreography from the scene's cue-reference sheet: whether an agent can produce a competent lesson draft is a core validation target of the slice, not an afterthought. The slice validates every architectural decision at small scale — the markup ergonomics, the anticipation default, the feel of the hold-and-blend, the agent loop — before any generalization is designed. The platform is then extracted from a working lesson, not designed in the abstract.

## 10. Implementation invariants (normative)

*The rules the built platform upholds — violations are bugs. Detailed data-format contracts, the interpolator, and the reconciler algorithm now live in the code (`packages/core` and its tests); this section is the durable statement of intent behind them.*

**Fixed decisions.** Runtime is vanilla TypeScript with `@preact/signals-core` for reactivity — no React, no framework in the hot path. TTS is provider-based: ElevenLabs uses returned character timestamps, while the private Qwen3-TTS cloned voice uses cue-safe segmented synthesis; forced alignment of human recordings remains planned. Each lesson builds to a static asset bundle (HTML + JS + audio + JSON); assistant-enabled lessons add a small same-origin server for provider credentials, while all others remain deployable to any static host. Computed processes are compiler-only: `@bake` emits ordinary keyframes and requires no player support.

**Guiding principles.**

1. **Value-at-time.** Every authored parameter's value is computable directly from lesson time `t`; nothing accumulates frame by frame. A dynamic assistant answer is a separate value-at-time overlay driven by elapsed answer time and is discarded whole. This is what makes seeking, catch-up, state-dump, headless frame rendering, and exact removal of the answer layer possible.
2. **Everything is text.** All authored artifacts are diffable text files; all generated artifacts are JSON/VTT/audio. No state lives only in a GUI.
3. **Deterministic builds.** Same inputs (script + cached audio) → byte-identical outputs.
4. **The compiler is the feedback loop.** Errors are precise, actionable, and produced without network access whenever possible (`check`).
5. **The hot path is framework-free.** The per-frame loop touches plain objects and typed arrays; signals are used only at the boundary to the DOM (board, readouts, captions, chrome).

**Parameter ownership** (the reconciliation policy, per §5.2): `script` — the viewer may perturb, and after a short playback-time hold the value glides back to the scripted track; `shared` — the viewer's value holds until the script next writes that parameter; `viewer` — once touched, the scripted track is ignored for the rest of the session. Narration-bound handles use `script` unless the lesson explicitly calls for persistence; camera navigation is normally `viewer`. Pausing freezes every modified value, resuming gives `script` values a fresh ≈3 s hold, and seeking clears interaction state. The catch-up envelope (exponential return, with discrete channels reverting instantly after the hold) is described concretely in §3 and §5.4. Assistant writes are not a fourth ownership mode: they are temporary display-layer values, and an in-answer learner write wins for that parameter.

---

## References and further reading

**The exemplar and commentary**
- [Visualizing quaternions — eater.net/quaternions](https://eater.net/quaternions) (3blue1brown + Ben Eater, 2018; rebuilt 2026). Per-lesson data at `…/media/{id}.json`.
- Andy Matuschak, [*Narrated explorables: three mental models*](https://medium.com/khan-academy-early-product-development/narrated-explorables-three-mental-models-e16e0d80e4c1).
- Launch threads: [Ben Eater](https://x.com/ben_eater/status/1055860884415799296), [Grant Sanderson](https://x.com/3blue1brown/status/1055859641689636864); [YouTube preface](https://www.youtube.com/watch?v=zjMuIxRvygQ).

**The intellectual lineage**
- Bret Victor, *Explorable Explanations* (2011) and the *Tangle* library; Andy Matuschak & Michael Nielsen, *How to make explorable explanations* (2019); [awesome-explorables](https://github.com/blob42/awesome-explorables).

**Frameworks and libraries**
- [Liqvid](https://liqvidjs.org/) (ex-RactivePlayer); [Motion Canvas](https://motioncanvas.io/) and its [time events](https://motioncanvas.io/docs/time-events/); [Remotion Player](https://www.remotion.dev/docs/player/player); [Theatre.js](https://www.theatrejs.com/); [Idyll](https://idyll-lang.org/); [GSAP](https://gsap.com/) ([free since 2025](https://webflow.com/blog/gsap-becomes-free)); [three.js](https://threejs.org/); [react-three-fiber](https://github.com/pmndrs/react-three-fiber); [Preact Signals](https://preactjs.com/guide/v10/signals/).

**Narration timing**
- [ElevenLabs TTS with timestamps](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps); [Google Cloud TTS SSML `<mark>` timepoints](https://github.com/googleapis/googleapis/blob/master/google/cloud/texttospeech/v1beta1/cloud_tts.proto) (v1beta1); [Azure Speech SSML structure & bookmarks](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-structure).
- Forced alignment: [stable-ts](https://github.com/jianfch/stable-ts); [Montreal Forced Aligner](https://montreal-forced-aligner.readthedocs.io/).
- [WebVTT API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API); [W3C SyncMediaLite draft](https://w3c.github.io/sync-media-pub/sync-media-lite).
