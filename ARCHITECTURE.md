# Explorable Video — Implementation Architecture

*Companion to [interactive-explorable-video.md](./interactive-explorable-video.md), which motivates the medium and the design. This document is the implementation blueprint: it specifies the repository structure, modules, data formats, and interactions in enough detail that an agent can implement the system autonomously. Interface sketches are given in TypeScript notation as normative data shapes, not as final code.*

**Fixed decisions** (made by the project owner):
- **Runtime**: vanilla TypeScript with `@preact/signals-core` for reactivity. No React; no framework in the hot path.
- **TTS**: ElevenLabs (`with-timestamps` endpoint) as the primary provider, behind a provider-adapter interface. Forced alignment of human recordings is a planned second adapter.
- **Distribution**: each lesson builds to a fully static bundle (HTML + JS + audio + JSON), deployable to any static host (S3, GitHub Pages, HF Spaces static).

**Guiding principles** (normative — violations are bugs):
1. **Value-at-time.** Every parameter's value is computable directly from time `t`. Nothing accumulates frame by frame. This is what makes seeking, catch-up, state-dump, and headless frame rendering possible.
2. **Everything is text.** All authored artifacts are diffable text files; all generated artifacts are JSON/VTT/audio. No state lives only in a GUI.
3. **Deterministic builds.** Same inputs (script + cached audio) → byte-identical outputs.
4. **The compiler is the feedback loop.** Errors are precise, actionable, and produced without network access whenever possible (`--check`).
5. **The hot path is framework-free.** The per-frame loop touches plain objects and typed arrays; signals are used only at the boundary to DOM (board, readouts, captions, chrome).

---

## 1. Repository layout

Monorepo, pnpm workspaces, TypeScript strict mode, Node ≥ 22, Vite for bundling/dev-server, Vitest for unit tests, Playwright for browser tests. (CLI command: `lesson`; package scope: `@narrable/*`.)

```
packages/
  core/           # shared types, parameter schema, easing, interpolation, time math
  compiler/       # script.md → tracks.json + captions.vtt (+ TTS orchestration)
  tts/            # provider adapters: elevenlabs, (later) google, forced-align
  player/         # browser runtime: clock, store, timeline driver, reconciler,
                  # scene host, board, captions, chrome, record mode
  ingredients/    # reusable scene components (2D canvas + three.js helpers)
  cli/            # the `lesson` command; wires compiler+player+static bundling
lessons/
  unit-circle/    # first lesson (vertical slice)
    lesson.yaml       # lesson manifest (id, title, languages, voices, defaults)
    scene.ts          # scene module
    script.fr.md      # narration + cues, one per language
    script.en.md
    assets/           # recorded tracks (JSON), images
    build/            # generated output — gitignored except on publish
docs/
  DESIGN.md
  ARCHITECTURE.md   (this file)
```

Dependency rule: `core` depends on nothing; `compiler` and `player` depend on `core` only; `cli` depends on everything; `ingredients` depends on `core` (+ three). `player` must never import `compiler` or `tts` — the runtime consumes only built artifacts.

---

## 2. Core data structures (`@narrable/core`)

These shapes are the contracts between all modules. They live in `core` and are the most stable part of the system — change them deliberately.

### 2.1 Parameter schema

A scene module exports a schema describing every drivable parameter:

```ts
type ParamType =
  | { kind: "scalar";     range?: [number, number] }
  | { kind: "vec2" } | { kind: "vec3" }
  | { kind: "quaternion" }                       // [w, x, y, z], unit
  | { kind: "orbit" }                            // camera: {target: vec3, distance, azimuth, elevation}
  | { kind: "boolean" }
  | { kind: "enum";       values: string[] }
  | { kind: "boardItem" };                       // "hidden" | "shown" | "dimmed" (+highlight flags)

interface ParamSpec {
  type: ParamType;
  default: ParamValue;
  interpolate: "lerp" | "nlerp" | "orbit" | "snap";   // must be legal for the type
  ownership: "script" | "shared" | "viewer";
  label?: string;                                // for the cue-reference sheet
}

type ParamValue = number | boolean | string | number[] | OrbitState;
type Schema = Record<string, ParamSpec>;         // keys are dot-namespaced: "show.projection"
```

Ownership semantics (implemented by the Reconciler, §5.5):
- `script` — viewer may perturb; after a hold, the value glides back to the scripted track. *Default for demonstrated quantities; also the exemplar's behavior for the camera.*
- `shared` — the viewer's value holds until the script next writes that parameter (i.e. until the next keyframe segment boundary on its track), then the script takes over again with a glide.
- `viewer` — once touched, the scripted track for this parameter is ignored for the rest of the session (until seek-to-0 or explicit reset).

The **orbit** type exists so camera interpolation preserves orbital motion (interpolate direction and distance separately, never cut through the target — this matches the exemplar's direction-nlerp + magnitude-lerp).

### 2.2 Compiled lesson: `tracks.json`

The single build artifact the player consumes (per language). Normative shape:

```ts
interface LessonTracks {
  version: 1;
  lessonId: string;
  language: string;
  duration: number;                       // seconds, = audio duration
  audio: { src: string[]; hash: string }; // ["audio.webm","audio.mp3"]
  schemaHash: string;                     // guards player/scene/tracks compatibility
  tracks: Record<string, Keyframe[]>;     // param name → sorted keyframes
  chapters: { t: number; title: string }[];
  pauses:   { t: number; id: string; prompt: string }[];
  captions: { src: string };              // "captions.vtt"
  recorded: Record<string, string>;       // trackId → asset path (recorded tracks merged at build)
}

interface Keyframe {
  t: number;            // seconds
  v: ParamValue;        // ABSOLUTE value (never a delta)
  ease?: string;        // easing INTO this keyframe from the previous one; absent = hold/snap
}
```

Track semantics (implemented by the Interpolator, §3.2):
- Between keyframe `k[i]` and `k[i+1]`: if `k[i+1].ease` is set, interpolate with that easing using the param's `interpolate` mode; otherwise the value holds at `k[i].v` and snaps at `k[i+1].t`.
- Before the first keyframe: the schema default. After the last: hold.
- All easing/anticipation/conflict logic is resolved at **build time**; the runtime does nothing but look up and interpolate.

### 2.3 Script AST (compiler-internal, but specified for testability)

```ts
interface ScriptDoc {
  frontMatter: FrontMatter;       // parsed YAML
  segments: Segment[];
}
type Segment =
  | { kind: "prose"; text: string; loc: SourceLoc }
  | { kind: "directive"; name: string; args: DirectiveArgs; loc: SourceLoc;
      anchorOffset: number }      // char offset into the STRIPPED narration text
```

The parser produces (a) the stripped narration text (what goes to TTS, verbatim), and (b) a directive list where each directive knows its anchor offset in that stripped text. The offset→time resolution is the only thing TTS adds.

### 2.4 Cue table (compiler-internal)

```ts
interface ResolvedCue {
  t: number;                     // absolute seconds after anchoring + offsets
  directive: Directive;          // parsed form: assignments, options, source loc
}
```

### 2.5 Lesson manifest: `lesson.yaml`

Authored, per lesson:

```yaml
id: unit-circle
title: { fr: "Le cercle unité", en: "The unit circle" }
scene: ./scene.ts
languages: [fr, en]
voice:
  fr: elevenlabs:VOICE_ID_FR
  en: elevenlabs:VOICE_ID_EN
defaults:
  anticipation: -0.2      # seconds; applied to every cue unless overridden
  ease: inOutCubic
  transition: 1.0         # default `over:` duration
```

---

## 3. `@narrable/core` modules

Pure TypeScript, zero DOM, 100% unit-testable. Contains:

### 3.1 Types & schema utilities
The shapes above, plus: schema validation (legal interpolate-for-type combinations), `schemaHash()` (stable hash of the schema for compatibility checks), and value validation/clamping per `ParamType`.

### 3.2 Interpolator
The heart of value-at-time.

- `buildIndex(tracks): TrackIndex` — precomputes, per track, a sorted keyframe array plus a coarse time→segment lookup (the exemplar uses a 10 ms lookup table; a binary search with a per-track "last segment" cursor is equally fast and simpler — implementer's choice).
- `evaluate(index, t): ScriptedState` — returns the full scripted state at time `t`. Must be allocation-free in steady state (write into a reused state object).
- Interpolation kernels: `lerp` (scalars, vecs, per-component), `nlerp` (quaternion/axis: lerp then normalize, shortest-path sign fix), `orbit` (direction-nlerp + distance/target lerp), `snap`.
- Easing registry: `linear`, `inCubic`, `outCubic`, `inOutCubic`, `spring` (fixed preset). Compiler and player share this registry — easing names are part of the format.

### 3.3 Reconciliation math
The pure functions used by the player's Reconciler (§5.5), kept in core so they can be unit-tested and used by `lesson state` for "state including a hypothetical interaction": hold/blend envelope, frame-rate-independent exponential approach (see §5.5).

---

## 4. `@narrable/compiler` and `@narrable/tts`

### 4.1 Pipeline

Six pure stages; each stage's output is serializable (goldens are tested per stage):

```
parse ─► check ─► synthesize ─► resolve ─► expand ─► emit
```

1. **parse** — `script.md` → `ScriptDoc`. Front matter via YAML; directives tokenized as `@name( ... )` with balanced-paren scanning (KaTeX `$...$` inside `@board` may contain parens/braces — the scanner must respect `$` spans). Literal `@` in prose is escaped `\@`. Everything not a directive is narration, verbatim.
2. **check** — validates against the scene schema (loaded by importing `scene.ts` in a Node context — the scene module's schema export must be importable without DOM): unknown parameters (with did-you-mean suggestions), type/range errors, illegal easing names, `@highlight` targets not tagged in the referenced board item's KaTeX source, `@track` references to missing asset files, overlapping-transition warnings (pre-resolution, duration-based estimate). Exits non-zero with `file:line:col` diagnostics. **No network.**
3. **synthesize** — sends the stripped narration text to the TTS adapter (or the aligner) and receives timing (§4.2). Cached (§4.3).
4. **resolve** — maps each directive's `anchorOffset` to a time: the start time of the character at that offset (ElevenLabs gives char-level times; for word-level providers, the onset of the containing word), plus `at:` offsets, plus the front-matter `anticipation` default. Clamps to `[0, duration]`.
5. **expand** — turns resolved cues into dense per-parameter `Keyframe[]` tracks: instant sets become hold-boundaries; `-> value over: d ease: e` becomes a pair `{t}, {t+d, ease}`; the **conflict rule** (a new cue on a param whose transition is still running truncates the old one at the new cue's start; compiler warns); recorded tracks from `assets/` are merged in (a recorded track is already a `Keyframe[]` — it is inserted verbatim, and cue-generated keyframes may not target the same param over the same span: build error). Board directives compile to `boardItem` enum tracks plus highlight-flag boolean tracks. `@scene`, `@chapter`, `@pause` become the scene track, `chapters[]`, `pauses[]`.
6. **emit** — writes `build/<lang>/tracks.json`, `captions.vtt` (from word timings; cue text is the narration sentence-segmented; optional word-level karaoke via VTT timestamps deferred), `audio.mp3`/`audio.webm`, and a static bundle (§6.3) when `--bundle` is passed.

### 4.2 TTS adapter interface (`@narrable/tts`)

```ts
interface TtsAdapter {
  id: string;   // "elevenlabs", "google", "align"
  synthesize(req: {
    text: string;                 // stripped narration, verbatim
    voice: string;
    language: string;
  }): Promise<{
    audio: Buffer;                       // mp3 or wav; compiler transcodes
    charTimes?: { start: number; end: number }[];  // per character of `text`
    wordTimes:  { word: string; start: number; end: number; charOffset: number }[];
  }>;
}
```

- **elevenlabs**: `POST /v1/text-to-speech/{voice}/with-timestamps`; returns character-level times → both `charTimes` and derived `wordTimes`. Long scripts are chunked at paragraph boundaries (API limits) and times re-offset; chunk boundaries must never fall inside a directive's anchor word.
- **align** (later): takes a human recording + the same stripped text, runs forced alignment (stable-ts wrapper as a subprocess; exact tool is a deferred decision), returns `wordTimes`. Identical downstream path — this is the human-voice upgrade.
- API keys via environment (`ELEVENLABS_API_KEY`); never in files.

### 4.3 Caching & determinism

TTS results are cached in `lessons/<id>/.cache/tts/<sha256(adapterId|voice|modelId|text)>.json` (+audio file). The cache is content-addressed on the *stripped text*, so editing a directive's parameters (not the prose) rebuilds with zero API calls and zero timing changes. `emit` output is a pure function of (script, schema, cache entries) — verified by a repeatability test in CI.

---

## 5. `@narrable/player` — the runtime

### 5.1 Composition and DOM layering

A lesson page instantiates one `Player` with: the `tracks.json` URL, the scene module, and a mount element. Layers, bottom to top:

```
<div class="xv-player">
  <canvas>                (scene: WebGL or 2D context, owned by SceneHost)
  <div class="xv-overlay"> (scene DOM overlays: labels, KaTeX in-scene formulas, fake cursor)
  <aside class="xv-board"> (the board panel; DOM + KaTeX)
  <div class="xv-captions">
  <div class="xv-chrome">  (controls bar)
  <div class="xv-gate">    (pause-checkpoint prompt overlay)
  <audio>                  (master clock; never visually shown)
```

### 5.2 Modules and per-frame data flow

```
                 ┌────────────┐  currentTime   ┌─────────────────┐ scripted
   <audio> ───► │ AudioClock  │ ─────────────► │ TimelineDriver   │ ────────┐
                 └────────────┘   (rAF poll)   │ (core.evaluate)  │         ▼
                                               └─────────────────┘   ┌────────────┐ displayed  ┌───────────┐
   pointer/keys ─► InteractionManager ─────────── user values ─────► │ Reconciler │ ──────────► │ StateStore │
                        ▲   (hit-testing via scene handles)          └────────────┘  (signals)  └─────┬─────┘
                        │                                                                    reads     │ subscribes
                        └──────────────────────────────── SceneHost.render(state) ◄─────────┘          ▼
                                                                                         Board / Captions / Chrome (DOM)
```

Per `requestAnimationFrame` tick, in order:
1. `AudioClock` reads `audio.currentTime` (rounded to 10 ms), detects seeks (|Δt| > 0.25 s outside normal playback), fires `PauseGate` checks.
2. `TimelineDriver` calls `core.evaluate(index, t)` → scripted state (reused buffer).
3. `Reconciler` merges scripted state with user state per parameter (algorithm below) → displayed state.
4. Changed displayed values are written into the `StateStore` (a map of signals, one per parameter; write only on actual change to avoid signal churn).
5. `SceneHost.render(displayedState)` runs imperatively (the scene reads the plain state object, not signals).
6. DOM layers (board, captions, readouts, chrome) update via signal subscriptions — outside the hot path.

### 5.3 AudioClock
Wraps the `<audio>` element (webm source + mp3 fallback; no Howler needed on modern browsers — deferred decision if Safari quirks demand it). Exposes `t`, `playing`, `seek(t)`, `play/pause`, and events. The audio element is the *only* time source; there is no internal clock to drift.

### 5.4 StateStore
`Map<string, Signal<ParamValue>>` built from the schema, plus a parallel plain-object mirror for the render path. Also holds per-parameter interaction metadata: `{ userValue, lastTouched, touchedEver }`.

### 5.5 Reconciler (normative algorithm)

Constants (per-player config, defaults from the exemplar): `HOLD = 3 s`, `TAU = 0.2 s` (exponential time constant — equivalent to the exemplar's 0.92-per-frame at 60 fps, made frame-rate-independent).

For each parameter, given `scripted(t)`, `userValue`, `lastTouched`, `now`, `dt`:

- **While being dragged**: displayed = user value. Scripted is ignored.
- **`ownership: viewer`** and `touchedEver`: displayed = user value, forever (until seek-to-0 or `reset()`).
- **`ownership: script`**:
  - `now − lastTouched < HOLD` → displayed = user value (hold window).
  - after the hold → exponential approach: `displayed ← scripted + (displayedPrev − scripted) · exp(−dt / TAU)`; when `|displayed − scripted|` is under a per-type epsilon, the parameter snaps to scripted and its modified flag clears. Continuous types blend; **discrete types** (`boolean`, `enum`, `boardItem`, snap tracks) revert instantly at the end of the hold.
  - Blending uses the parameter's interpolation kernel (nlerp for quaternions, orbit for cameras) — never straight-line lerp on a unit sphere.
- **`ownership: shared`**: displayed = user value until the scripted track's *next keyframe at or after `lastTouched`'s time* is reached; from there, script ownership resumes with the same exponential glide.
- **Scene-change rule** (from the exemplar): if a user interaction changes the active `scene` parameter while audio is playing, the player pauses the audio. Everything else keeps narrating.
- **On seek**: all modified flags and user values clear; displayed jumps to scripted (a seek is a statement of intent to rejoin the narration).

### 5.6 SceneHost and the scene-module contract

```ts
interface SceneModule {
  schema: Schema;
  presets?: Record<string, Partial<Record<string, ParamValue>>>;  // e.g. camera "sideView"
  constants?: Record<string, number | number[]>;                  // usable in cues
  create(ctx: SceneContext): SceneInstance;
}
interface SceneInstance {
  render(state: Readonly<PlainState>, dt: number): void;   // pure function of state
  handles(): Handle[];      // draggable things: hit-test region + param(s) written + drag mapping
  dispose(): void;
}
```

`SceneContext` gives the scene its canvas (2D or WebGL — the scene declares which), the overlay element for DOM labels/KaTeX, and read access to viewport size. **Rule: `render` may not keep mutable state that affects output across frames** (that would break value-at-time); caches for expensive geometry are fine.

`Handle` is how interaction stays generic: the InteractionManager does pointer capture and routes drags to handles; the handle maps pointer deltas to parameter writes (e.g. "drag point on circle → theta = atan2"). Camera orbit is a built-in handle provided by `ingredients`.

### 5.7 Board
DOM strip (side or bottom per player option), rendering KaTeX items. Subscribes to `board.*` signals. Item definitions (KaTeX/text source per item id, per language) are carried in `tracks.json` under a `boardItems` map emitted by the compiler. Highlight targets are `\htmlClass{tag}{...}` spans; the board toggles CSS classes. Transitions: CSS only (opacity/translate), ~200 ms.

### 5.8 Captions, Chrome, PauseGate
- **Captions**: a `<track kind="subtitles">` on the audio element would not render (audio, not video), so captions are drawn by the player: parse the VTT once, binary-search the active cue by `t`. Toggle in chrome.
- **Chrome**: play/pause, elapsed/remaining, scrubber with chapter ticks and pause-checkpoint markers, captions toggle, fullscreen, keyboard (`space/k` play-pause, `f` fullscreen, `←/→` ±5 s).
- **PauseGate**: when playback crosses `pauses[i].t`, pause audio, show the prompt overlay (non-modal — the scene stays fully interactive; that is the point), mark satisfied on resume. Seeking past a gate marks it satisfied. Gates are per-playthrough (reset on seek-to-0).

### 5.9 Record mode (dev only, phase M4)
A build flag adds a record toolbar: play draft audio, manipulate viewer-ownable parameters, sample the touched parameters at 30 Hz into a `Keyframe[]`, download as `assets/<name>.track.json` (with a simplification pass — drop collinear samples). Also records a pointer track for the fake-cursor feature. Never ships in production bundles.

### 5.10 Dev/agent URL parameters
The built lesson page honors query params (dev builds only): `?t=14.2` (seek and pause on load), `&nochrome` (hide UI), `&state` (dump displayed state as JSON to `window.__XV_STATE__` and console). These are what `lesson frame` uses.

---

## 6. `@narrable/cli` — the `lesson` command

| Command | What it does |
|---|---|
| `lesson new <id>` | Scaffold a lesson directory (manifest, empty scene from a template, script skeleton). |
| `lesson check [--lang fr]` | Pipeline stages parse+check only. No network. The agent's inner loop. |
| `lesson build [--lang fr] [--bundle]` | Full pipeline. `--bundle` emits the static site (below). |
| `lesson preview` | Vite dev server: player + current build, HMR on scene code, auto-rebuild (check+resolve+expand from cache) on script save. |
| `lesson state --at 14.2 [--lang fr]` | Evaluate tracks at `t` in Node (core only, no browser); print full scripted state as JSON. |
| `lesson frame --at 14.2 -o f.png [--size 1280x720]` | Launch headless Chromium (Playwright) on the built lesson with `?t&nochrome`; screenshot. Deterministic because state = f(t). |
| `lesson ref` | Emit the scene's **cue-reference sheet**: every parameter with type, range, default, ownership, presets, constants, board item ids — Markdown, made to be pasted into an agent's context. |
| `lesson record` | `preview` with record mode enabled. |

Static bundle (`--bundle`): `build/site/` containing `index.html`, hashed player JS/CSS, per-language `tracks.json` + audio + VTT, thumbnail, and a `<noscript>`/unsupported-browser block linking to a fallback video URL from the manifest (if provided). No server-side anything.

---

## 7. Testing strategy

- **core**: property-based tests on the interpolator (monotone time → continuous output except at snap boundaries; `evaluate(t)` independent of call order — the seekability property), quaternion shortest-path cases, orbit interpolation never crossing the target.
- **compiler**: golden-file tests per stage on fixture scripts (including French text with apostrophes/accents around anchors); a **fake TTS adapter** (deterministic timing: e.g. 60 ms per character) so the whole pipeline runs hermetically in CI; error-message snapshot tests (the diagnostics are a public interface — the agent consumes them).
- **player**: Vitest for Reconciler math against the normative algorithm in §5.5 (hold boundary, exponential approach, discrete revert, ownership matrix); Playwright for seek-correctness (seek to N random times, compare `window.__XV_STATE__` with `lesson state --at`), catch-up behavior, and pause gates.
- **end-to-end agent-loop smoke test**: script edit → `check` catches an injected error → fix → `build` (fake TTS) → `state` and `frame` assertions. This test *is* the §5.7 (design doc) guarantee.

---

## 8. Implementation phases

| Phase | Deliverable | Exit criterion |
|---|---|---|
| **M0** | `core` (types, schema, interpolator, easing) + `compiler` with fake TTS + `lesson check/build/state/ref` | Golden tests green; `state --at` correct on a fixture lesson |
| **M1** | `player` core: clock, timeline driver, state store, scene host, chrome; unit-circle scene (2D canvas) | Lesson plays/seeks correctly with fake-TTS audio (silence + beeps ok) |
| **M2** | Reconciler + interaction (handles, camera-orbit ingredient); board; captions; pause gates | Catch-up feels right; Playwright suite green |
| **M3** | ElevenLabs adapter + caching; French + English builds of unit-circle; `frame` command; static bundle | Published static demo, both languages, from one script pair |
| **M4** | Record mode + recorded-track merging; fake cursor playback | Camera choreography recorded, trimmed, and replayed in a lesson |
| **M5** | `ingredients` library growth (axes, arrows, draggable points, scrub-able KaTeX numbers), second lesson (3D, three.js) to force the abstractions | Second lesson built with < 30% platform changes |

The agent-authoring validation (an AI agent drafts the script/choreography from `lesson ref` output) runs at the end of M3.

---

## 9. Deferred decisions

Non-critical choices intentionally left to the implementation phase; the stated default is what to do absent a reason otherwise.

| Decision | Default / note |
|---|---|
| Time→segment lookup: 10 ms table (exemplar) vs binary search + cursor | Binary search + last-segment cursor; measure before optimizing |
| Audio element direct vs Howler wrapper | Direct `<audio>`; add a shim only if Safari time-resolution problems appear |
| Forced-alignment tool for the `align` adapter | stable-ts subprocess; MFA if phoneme-grade accuracy proves necessary |
| Karaoke (word-level) caption highlighting | Sentence-level VTT first; word-level is an emit-stage extension |
| VTT `<track>` parsing library vs hand-rolled | Hand-rolled minimal parser (the compiler controls the VTT it emits) |
| `spring` easing exact parameters | Pick one preset; it is part of the format once published |
| Fake-cursor rendering (recorded pointer track) | Overlay `<div>`, % coordinates in a 16:9 reference frame |
| Mobile/touch support level | Handles must work with touch from M2; layout polish deferred |
| Monorepo tooling (pnpm alone vs turborepo) | pnpm workspaces alone until build times hurt |
| Package/CLI naming (`@narrable/*`, `lesson`) | Resolved: scope `@narrable/*`, CLI `lesson` |
| Multi-lesson catalogue site | Out of scope; each lesson is a static bundle. Revisit after ≥3 lessons |
| Simulation-type scenes (history-dependent) | Out of scope until a topic demands it; design sketch: pre-baked trajectory track for the scripted path + live sim during free exploration |
