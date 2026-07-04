# Implementation Plan — Explorable Video Platform

*The build blueprint derived from [ARCHITECTURE.md](./ARCHITECTURE.md) and [DESIGN.md](./DESIGN.md). This document sequences the work into phases, with explicit commit points, test rounds, and exit criteria. It is written so an agent can execute it autonomously, checking off commits in order.*

---

## Status — 2026-07-04

**Done:** M-bootstrap, M0, M1, M2 (tagged `m0`/`m1`/`m2`) and **all of M3** — the vertical slice works end to end (build → play → seek → catch-up → pause gate → board → captions) and is **deployed live to a static HF Space** ([dlouapre/unit-circle](https://huggingface.co/spaces/dlouapre/unit-circle)), both languages, real ElevenLabs voice, verified on Chrome, Safari (macOS), and iPad. Gate: `CI=true pnpm check` = **130 unit tests / 24 files**; **12 Playwright e2e on Chromium + WebKit**.

**Agent-authoring validation (`C3.7b`) — ✅ done.** Ran harder than planned: instead of drafting a script against the existing scene, one Opus agent authored a **whole new lesson end to end** (scene + script + choreography) on **backpropagation** ([`lessons/backprop/`](./lessons/backprop/)), from the docs alone. It passed `check` first try, exercised the previously-untested `shared` ownership / reconciliation path, and converges (loss 0.383 → 0.008). Verdict: **pass**. Full writeup in [docs/agent-authoring-validation.md](./docs/agent-authoring-validation.md); raw agent log in [lessons/backprop/FINDINGS.md](./lessons/backprop/FINDINGS.md). **M3 is complete; tagged `v0.1.0`.** The **rename gate** is cleared — scope is `@narrable/*`, CLI stays `lesson`.

**Validation findings acted on** (see [Post-validation follow-ups](#post-validation-follow-ups)): headless interaction check (`state --drag`), sharpened overlap warning, `lesson new` flags, and named parameter groups all shipped; the anticipation default is accepted as-is. The one open item is **`@bake`** — animating a *computed* process at build time (design note written, implementation pending).

**Not started:** M4 (record mode + fake cursor), M5 (ingredients library + 3D lesson).

**Beyond the original plan** (done while iterating on the slice — see [Post-slice additions](#post-slice-additions)): Safari/HTTP-Range playback fix + dual-browser e2e, device-pixel-ratio crispness + fullscreen toggle, `.env` auto-loading, audio-format (mp3/wav) handling, a narration-speed knob, and spoken `@pause` prompts.

**Legend:** ✅ done · 🔶 done, with a noted deviation · ⬜ not started

---

## 0. Decisions locked for this plan

These were chosen as defaults (the interview timed out); flag any you want changed and the affected phases will be re-cut.

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Plan depth | **Deep on M0–M3, lighter M4–M5** | DESIGN §9: build the vertical slice, *then* extract/generalize. M4–M5 shape depends on slice learnings. |
| D2 | Package scope / CLI name | **`@narrable/*` and `lesson` (placeholders)** | ARCHITECTURE Deferred Decisions default; rename before first publish. |
| D3 | Test rigor | **Full rigor as specified (ARCHITECTURE §7)** | The seekability property tests and compiler goldens are load-bearing, not optional. Sequenced pragmatically *within* phases (math tests first, browser suites once the surface stabilizes). |
| D4 | Repo root / first lesson | **This repo (`mva_eater`) as monorepo root; `unit-circle` first lesson** | Repo is a clean slate; docs name unit-circle. |
| D5 | Monorepo tooling | **pnpm workspaces alone** | ARCHITECTURE Deferred default; add turborepo only if build times hurt. |
| D6 | Interpolator lookup | **Binary search + last-segment cursor** | ARCHITECTURE Deferred default; simpler than the 10 ms table, measure before optimizing. |
| D7 | Audio | **Direct `<audio>`, no Howler** | ARCHITECTURE Deferred default; add a shim only if Safari misbehaves. |
| D8 | Slice voiceover | **ElevenLabs draft only through M3** *(confirmed)* | Validate the medium with synthetic voice; the `align` adapter (forced alignment of a human recording) stays a later drop-in upgrade — the pipeline downstream is identical, so nothing is re-done when the real voice arrives. |
| D9 | M3 deploy target | **Hugging Face Space (static)** *(confirmed)* | The static bundle already targets "any static host"; a static HF Space is the deploy of record for C3.7. |

**Working conventions**
- TypeScript strict mode, Node ≥ 22, ESM throughout. Vite for bundling/dev-server, Vitest for unit, Playwright for browser.
- Dependency rule (enforced, violations are review-blockers): `core` → nothing; `compiler`/`player` → `core` only; `ingredients` → `core` (+three); `cli` → everything. **`player` must never import `compiler` or `tts`.**
- Every commit builds and passes its gating tests. Commit messages reference the commit ID below (e.g. `C1.3`).
- The five guiding principles (ARCHITECTURE §intro) are treated as invariants; any commit that violates value-at-time, text-only artifacts, or hot-path-framework-free is a bug.

---

## 1. Milestone map

| Phase | Deliverable | Exit criterion (ARCHITECTURE §8) | Depth | Status |
|---|---|---|---|---|
| **M0** | `core` + `compiler` (fake TTS) + `lesson check/build/state/ref` | Golden tests green; `state --at` correct on fixture | Full | ✅ (tag `m0`) |
| **M1** | `player` core: clock, timeline driver, store, scene host, chrome; unit-circle 2D scene | Plays/seeks correctly with fake-TTS audio | Full | ✅ (tag `m1`) |
| **M2** | Reconciler + interaction (handles, camera-orbit); board; captions; pause gates | Catch-up feels right; Playwright green | Full | ✅ (tag `m2`) |
| **M3** | ElevenLabs adapter + caching; FR+EN unit-circle; `frame`; static bundle; **agent-authoring validation** | Published static demo, both languages, one script pair; agent drafts a competent lesson | Full | ✅ deployed & verified (both langs, real voice); agent-authoring validation done (backprop lesson) |
| **M4** | Record mode + recorded-track merging; fake cursor | Camera choreography recorded, trimmed, replayed | Sketch | ⬜ |
| **M5** | `ingredients` growth + second lesson (3D, three.js) | Second lesson built with < 30% platform changes | Sketch | ⬜ |

Agent-authoring validation runs at the end of M3 (DESIGN §9: "a core validation target of the slice, not an afterthought").

---

## M-bootstrap — Monorepo skeleton

*Precedes M0. One short phase to make everything after it mechanical.*

**Tasks**
- `pnpm-workspace.yaml` (`packages/*`, `lessons/*`), root `package.json`, root `tsconfig.base.json` (strict, ESNext modules, `composite: true` for project refs).
- Empty package stubs: `core`, `compiler`, `tts`, `player`, `ingredients`, `cli` — each with `package.json`, `tsconfig.json` (extends base, references its allowed deps only), `src/index.ts`.
- Root tooling: Vitest config, Playwright config (installed but no specs yet), ESLint/Prettier (or Biome — pick one, keep it), `.gitignore` (`node_modules`, `lessons/*/build`, `lessons/*/.cache`).
- A `pnpm -r build` + `pnpm -r test` that succeed trivially.
- **Dependency-boundary guard**: a tiny script (or `eslint-plugin-import` rule) asserting the §1 dependency rule; wire into CI.
- CI workflow (GitHub Actions): install → typecheck → lint → `pnpm -r test`. Fake-TTS only; **no network, no API keys**.

**Commit points**
- `CB.1` — workspace + root config + empty package stubs build.
- `CB.2` — Vitest/Playwright/lint configured; boundary guard; CI green on an empty suite.

**Exit criterion** — `pnpm i && pnpm -r build && pnpm -r test` green locally and in CI; dependency guard rejects an intentionally-added illegal import (verify once, then revert).

---

## M0 — `core` + `compiler` (fake TTS) + read-only CLI

The compiler-as-feedback-loop and value-at-time land here, provable without a browser.

### M0.A — `@narrable/core` types, schema, easing

**Tasks**
- Data shapes (ARCHITECTURE §2): `ParamType`, `ParamSpec`, `ParamValue`, `Schema`, `Keyframe`, `LessonTracks`, `ScriptDoc`/`Segment`, `ResolvedCue`.
- Schema utilities: legal `interpolate`-for-type validation, per-type value validation/clamping, `schemaHash()` (stable, order-independent).
- Easing registry: `linear`, `inCubic`, `outCubic`, `inOutCubic`, `spring` (one fixed preset — pick and document it; it's part of the format once shipped).

**Tests** — unit: schema validation accepts/rejects the legal/illegal interpolate-type matrix; `schemaHash` stable under key reordering; easing curves hit `f(0)=0, f(1)=1` and known midpoints.

- `C0.1` — core types + schema utils + easing registry, unit-tested.

### M0.B — Interpolator (heart of value-at-time)

**Tasks**
- `buildIndex(tracks)` — per-track sorted keyframes + last-segment cursor (D6).
- `evaluate(index, t)` — full scripted state at `t`, **allocation-free in steady state** (writes into a reused state object).
- Kernels: `lerp` (scalar/vec per-component), `nlerp` (quaternion/axis, shortest-path sign fix), `orbit` (direction-nlerp + distance/target lerp), `snap`.
- Track semantics: ease-into-keyframe vs hold-then-snap; schema default before first keyframe; hold after last.

**Tests** — the seekability guarantees (ARCHITECTURE §7):
- Property-based: for random tracks, `evaluate(t)` is **independent of call order** (seek property) and continuous in `t` except at snap boundaries.
- Quaternion shortest-path cases (antipodal, near-identical).
- Orbit interpolation **never crosses the target**.
- Steady-state allocation check (no new allocations across N evaluates).

- `C0.2` — interpolator + kernels, property tests green.

### M0.C — Compiler pipeline stages 1–2 (parse, check) + fake TTS + reconciliation math

**Tasks**
- **parse**: `script.md` → `ScriptDoc`. YAML front matter; `@name(...)` tokenizer with balanced-paren scanning that respects `$…$` KaTeX spans; `\@` escape; produces stripped narration text + directive list with `anchorOffset` into stripped text.
- **check**: validate against scene schema (imported from `scene.ts` in Node — schema export must load without DOM). Diagnostics with `file:line:col`: unknown params + did-you-mean, type/range errors, illegal easing, `@highlight` targets not tagged in the item's KaTeX, `@track` to missing assets, overlapping-transition warnings. **No network.** Non-zero exit on error.
- **Fake TTS adapter** in `@narrable/tts`: deterministic timing (e.g. 60 ms/char) implementing the `TtsAdapter` interface — the hermetic CI backbone.
- Port reconciliation math into `core` §3.3 now (hold/blend envelope, frame-rate-independent exponential approach) so it's unit-tested before the player needs it.

**Tests** — golden-file per stage on fixture scripts *including French text with apostrophes/accents around anchors*; **error-message snapshot tests** (diagnostics are a public interface the agent consumes); reconciliation-math unit tests against the §5.5 normative algorithm.

- `C0.3` — parse + check stages, fake TTS, diagnostics snapshots green.
- `C0.4` — reconciliation math in core, unit-tested.

### M0.D — Compiler stages 3–6 (synthesize, resolve, expand, emit)

**Tasks**
- **synthesize**: call the (fake) adapter, get char/word times. Caching (§4.3): content-addressed on **stripped text** at `lessons/<id>/.cache/tts/<sha>.json`.
- **resolve**: `anchorOffset` → time (char/word onset) + `at:` offsets + front-matter `anticipation`; clamp to `[0, duration]`.
- **expand**: cues → dense `Keyframe[]`; instant sets → hold boundaries; `-> v over: d ease: e` → `{t},{t+d,ease}`; **conflict rule** (truncate running transition, warn); merge recorded `assets/*.track.json` verbatim (error if a cue targets the same param/span); board directives → `boardItem` enum + highlight boolean tracks; `@scene/@chapter/@pause` → scene track / `chapters[]` / `pauses[]`.
- **emit**: `build/<lang>/tracks.json`, `captions.vtt` (sentence-level; hand-rolled minimal VTT writer), `audio.mp3`/`.webm` (transcode), `boardItems` map. `--bundle` deferred to M3.
- **Determinism/repeatability test**: emit is a pure function of (script, schema, cache) — byte-identical on re-run.

**Tests** — golden per stage; the worked example from DESIGN §6.5 as a fixture (assert the `theta`/`show.thetaLabel`/`board.cosdef` tracks resemble the documented output); repeatability test in CI.

- `C0.5` — synthesize + caching, golden green.
- `C0.6` — resolve + expand (incl. conflict rule + recorded-track merge), golden green.
- `C0.7` — emit (tracks.json, VTT, audio transcode), determinism test green.

### M0.E — CLI read-only surface

**Tasks** (`@narrable/cli`)
- `lesson new <id>` — scaffold manifest + template scene + script skeleton.
- `lesson check [--lang]` — parse+check only, no network. The agent's inner loop.
- `lesson build [--lang]` — full pipeline (fake TTS).
- `lesson state --at <t> [--lang]` — evaluate tracks in Node, print full scripted state JSON.
- `lesson ref` — emit the scene's **cue-reference sheet** (Markdown: every param with type/range/default/ownership, presets, constants, board item ids).
- Create the `lessons/unit-circle/` fixture: `lesson.yaml`, a minimal non-rendering `scene.ts` (schema + constants + presets only — no `render` yet), `script.fr.md` skeleton.

**Tests** — end-to-end (fake TTS): `check` catches an injected bad-param error with a did-you-mean; `state --at` matches a hand-computed value on the fixture; `ref` snapshot.

- `C0.8` — `new`/`check`/`build`/`state`/`ref` wired; unit-circle fixture builds headlessly.

**M0 exit criterion** — all golden tests green; `lesson state --at <t>` correct on the unit-circle fixture; `lesson check` produces the documented did-you-mean diagnostic. **No browser, no network involved anywhere in M0.**

**Test round R0** — full `pnpm -r test` + CLI e2e smoke on the fixture. Tag `m0`.

---

## M1 — `player` core + unit-circle scene renders and seeks

Now the runtime, with the fake-TTS audio (silence/beeps acceptable).

### M1.A — AudioClock + StateStore + TimelineDriver

**Tasks**
- `AudioClock`: wraps `<audio>` (webm + mp3 fallback, D7), rounds `t` to 10 ms, exposes `t/playing/seek/play/pause` + events, detects seeks (|Δt| > 0.25 s outside normal playback).
- `StateStore`: `Map<string, Signal<ParamValue>>` from schema + parallel plain-object mirror for the render path + per-param interaction metadata (`userValue/lastTouched/touchedEver`). Write signals **only on actual change**.
- `TimelineDriver`: rAF loop → `core.evaluate` into the reused buffer → (M1: straight passthrough to store; Reconciler arrives M2).

**Tests** — Vitest with a fake audio element: clock rounding, seek detection thresholds; store writes only on change (signal-churn guard).

- `C1.1` — AudioClock + StateStore.
- `C1.2` — TimelineDriver rAF loop, scripted-state passthrough.

### M1.B — SceneHost + scene-module contract + unit-circle render

**Tasks**
- `SceneHost` + `SceneContext` (canvas 2D or WebGL declared by scene; overlay element; viewport size). Enforce the **no-mutable-cross-frame-state** rule (geometry caches OK).
- `SceneModule`/`SceneInstance` contract (`render`, `handles`, `dispose`). M1 implements `render` only; `handles()` returns `[]`.
- Flesh out unit-circle `scene.ts`: 2D canvas render of circle + point + `theta` + projection + labels, pure function of state. Wire its real schema.

**Tests** — Vitest jsdom/canvas smoke that `render` runs without touching disallowed state; visual sanity deferred to `frame` (M3).

- `C1.3` — SceneHost + contract.
- `C1.4` — unit-circle 2D render from state.

### M1.C — Chrome + player composition + dev URL params

**Tasks**
- DOM layering (§5.1): canvas / overlay / board(stub) / captions(stub) / chrome / gate(stub) / audio.
- `Player` entry: takes tracks URL + scene module + mount; runs the per-frame pipeline (§5.2 steps 1–2, 4–6; step 3 Reconciler stubbed).
- Chrome: play/pause, elapsed/remaining, scrubber with chapter ticks + pause markers, fullscreen, keyboard (`space/k`, `f`, `←/→ ±5s`). Captions toggle present (wired M2).
- Dev URL params (§5.10): `?t=`, `&nochrome`, `&state` → `window.__XV_STATE__` + console.

**Tests** — Vitest for chrome state math (elapsed/remaining, scrubber↔time mapping, keyboard handlers).

- `C1.5` — Player composition + DOM layering.
- `C1.6` — Chrome controls + keyboard + dev URL params.

**M1 exit criterion** — the unit-circle lesson **plays and seeks correctly** with fake-TTS audio; scrubbing anywhere shows the correct scripted state (visually + via `&state`).

**Test round R1** — manual play/seek pass in `lesson preview` (add a minimal `preview` command here if not already), plus the automated Vitest suites. Tag `m1`.

---

## M2 — Reconciler, interaction, board, captions, pause gates

The parts that make it *feel* right.

### M2.A — Reconciler

**Tasks**
- Implement §5.5 exactly, consuming the core reconciliation math (C0.4): drag override; `viewer` sticky; `script` hold (HOLD=3s) → exponential approach (TAU=0.2s) with per-type epsilon snap + modified-flag clear; **discrete types revert instantly** at hold end; `shared` holds until next keyframe ≥ lastTouched; scene-change-pauses-audio rule; seek clears all modified flags/user values.
- Blend uses the param's kernel (nlerp/orbit), never straight lerp on a sphere.
- Insert Reconciler as step 3 of the per-frame pipeline.

**Tests** — Vitest against the normative algorithm: hold boundary, exponential approach shape, discrete revert, full ownership matrix (`script`/`shared`/`viewer` × touched/untouched × before/after hold), seek-clears-state.

- `C2.1` — Reconciler + wired into pipeline, unit matrix green.

### M2.B — InteractionManager + handles + camera-orbit ingredient

**Tasks**
- `InteractionManager`: pointer capture + hit-testing via scene `handles()`; routes drag deltas to param writes; sets modified flags/timestamps. **Touch support from day one** (Deferred default).
- `Handle` shape (hit region + params written + drag mapping). unit-circle handle: drag point on circle → `theta = atan2`.
- Camera-orbit built-in handle in `ingredients` (unused by 2D unit-circle but built now to prove the abstraction and feed M5).

**Tests** — Vitest: handle drag-mapping math (pointer → theta); modified-flag/timestamp set on touch.

- `C2.2` — InteractionManager + unit-circle drag handle.
- `C2.3` — camera-orbit ingredient handle.

### M2.C — Board + Captions + PauseGate

**Tasks**
- **Board** (§5.7): DOM strip, KaTeX items from the `boardItems` map, subscribes `board.*` signals; highlight via `\htmlClass{tag}{}` CSS toggles; CSS-only transitions (~200 ms).
- **Captions** (§5.8): parse VTT once, binary-search active cue by `t`, render in the caption layer; chrome toggle.
- **PauseGate** (§5.8): on crossing `pauses[i].t`, pause audio, show **non-modal** prompt (scene stays interactive), mark satisfied on resume; seeking past marks satisfied; reset on seek-to-0.

**Tests** — Vitest: caption active-cue binary search; pause-gate crossing/seek-past/reset logic.

- `C2.4` — Board + KaTeX + highlight.
- `C2.5` — Captions rendering + toggle.
- `C2.6` — PauseGate.

### M2.D — Playwright suite (the seek-correctness gate)

**Tasks**
- Playwright specs: seek to N random times, compare `window.__XV_STATE__` against `lesson state --at` (the seekability guarantee, cross-checked runtime vs Node); catch-up behavior after a drag; pause-gate stop/resume; scene-change pauses audio.

**Tests** — the specs above are the tests.

- `C2.7` — Playwright seek/catch-up/pause-gate suite green.

**M2 exit criterion** — catch-up feels right (hold-then-glide, discrete revert); Playwright suite green; runtime state matches Node evaluation at random seek points.

**Test round R2** — full Vitest + Playwright + manual feel pass on catch-up and pause gates. Tag `m2`.

---

## M3 — ElevenLabs, FR+EN builds, `frame`, static bundle, agent validation

Everything real: true voice, two languages, headless frames, a shippable bundle, and the agent-authoring proof.

### M3.A — ElevenLabs adapter + real caching

**Tasks**
- `elevenlabs` adapter: `POST /v1/text-to-speech/{voice}/with-timestamps`; char-level times → `charTimes` + derived `wordTimes`. Paragraph-boundary chunking with time re-offset; **chunk boundaries never inside a directive's anchor word**. API key via `ELEVENLABS_API_KEY` env, never in files.
- Confirm cache keying (`adapterId|voice|modelId|text`) so editing directive params (not prose) → zero API calls, zero timing change.

**Tests** — adapter unit tests with a **recorded/mocked HTTP fixture** (no live key in CI); chunk-boundary-vs-anchor-word invariant test; cache-hit-on-directive-edit test.

- `C3.1` — ElevenLabs adapter + chunking + caching.

### M3.B — FR + EN unit-circle content

**Tasks**
- Author `script.fr.md` (full ~10-cue lesson per DESIGN §9) and translate to `script.en.md` keeping directives intact.
- `lesson.yaml`: voices per language.
- Build both languages from cached audio; verify cues re-align to each language's timings automatically.

**Tests** — build both langs; assert non-empty tracks/captions/audio per lang; determinism re-run.

- `C3.2` — FR + EN scripts + both-language build.

### M3.C — `lesson frame` (headless render)

**Tasks**
- `lesson frame --at <t> -o f.png [--size WxH]`: launch headless Chromium (Playwright) on the built lesson with `?t&nochrome`, screenshot. Deterministic because state = f(t).

**Tests** — Playwright: `frame` at a fixed `t` produces a stable image (perceptual/hash tolerance); the projection is visible at the timestamp where the narration says *cosinus* (DESIGN §5.7 self-check).

- `C3.3` — `frame` command + determinism test.

### M3.D — Static bundle + `preview` finalization

**Tasks**
- `lesson build --bundle` → `build/site/`: `index.html`, hashed player JS/CSS, per-lang `tracks.json`+audio+VTT, thumbnail, `<noscript>`/unsupported-browser fallback linking a manifest video URL if provided. No server-side anything. **Host of record: static Hugging Face Space (D9)** — bundle stays host-agnostic, but C3.7 deploys here.
- Finalize `lesson preview`: Vite dev server, HMR on scene code, auto-rebuild (check+resolve+expand from cache) on script save.

**Tests** — bundle build produces a self-contained `site/` that loads offline (Playwright loads `index.html` from disk and plays).

- `C3.4` — static bundle emit. ✅
- `C3.5` — `preview` HMR + auto-rebuild. 🔶 *Done as a range-capable static server + file watch + SSE live-reload (full-page reload on save), not Vite module-level HMR. Sufficient for the authoring loop; revisit if HMR granularity is wanted.*

### M3.E — End-to-end agent-loop smoke test + agent-authoring validation

**Tasks**
- **Agent-loop smoke test** (ARCHITECTURE §7, this *is* the DESIGN §5.7 guarantee): script edit → `check` catches an injected error → fix → `build` (fake TTS) → `state` + `frame` assertions. Runs in CI.
- **Agent-authoring validation** (the core slice validation target): give an agent only `lesson ref` output for the unit-circle scene and have it draft the script + choreography; human directs. Capture findings on markup ergonomics, anticipation default, hold-and-blend feel.

- `C3.6` — agent-loop smoke test in CI.
- `C3.7a` ✅ — deploy the static demo to a static HF Space (both languages). Live at [dlouapre/unit-circle](https://huggingface.co/spaces/dlouapre/unit-circle), verified on Chrome, Safari (macOS), and iPad.
- `C3.7b` ✅ — agent-authoring validation. An Opus agent authored a whole new lesson end to end (scene + script) on **backpropagation** ([`lessons/backprop/`](./lessons/backprop/)) from the docs alone; passed `check` first try; exercised `shared` ownership. Writeup: [docs/agent-authoring-validation.md](./docs/agent-authoring-validation.md).

**M3 exit criterion** — ✅ published static demo, both languages, from one script pair; agent produces a competent lesson (in fact a whole new one) from the docs. This validates every architectural decision at small scale before generalization.

**Test round R3** — full suite (Vitest + Playwright + agent-loop smoke) + live ElevenLabs build once with a real key (manual, outside CI) + manual review of the deployed demo. Tag `m3` / `v0.1.0`.

---

## M4 — Record mode + recorded-track merging *(sketch)*

*Detailed after M3 learnings. Dev-only; never ships in production bundles.*

- Record toolbar (build-flag gated): play draft audio, manipulate viewer-ownable params, sample touched params at 30 Hz → `Keyframe[]`, download `assets/<name>.track.json` with a simplification pass (drop collinear samples).
- Recorded pointer track for the fake-cursor feature (overlay `<div>`, % coords in a 16:9 reference frame — Deferred default).
- Recorded-track merge path already stubbed in M0.D expand; validate end-to-end here.
- **Exit**: camera choreography recorded, trimmed, and replayed in the unit-circle (or a camera-bearing) lesson.
- Commit sketch: `C4.1` record toolbar + sampling; `C4.2` simplification + download; `C4.3` fake-cursor playback; `C4.4` recorded-track merge verified in a lesson.

---

## M5 — `ingredients` growth + second lesson (3D) *(sketch)*

*The generalization test. Second lesson forces the abstractions; target < 30% platform change.*

- Grow `ingredients`: axes, grids, vector arrows, draggable points on curves/spheres, **scrub-able KaTeX numbers** (interactive equations — build early, it's high-value per DESIGN §5.4), plot panels with linked highlighting.
- Second lesson: a 3D topic on three.js (quaternion-adjacent or Fourier-in-3D) exercising `orbit` camera, `quaternion` params, nlerp — the paths thin in the 2D slice.
- **Exit**: second lesson built with < 30% platform changes; track what *did* change (feeds a v0.2 refactor).
- Commit sketch: `C5.1` ingredient library core; `C5.2` scrub-able KaTeX numbers; `C5.3` three.js scene host path; `C5.4` second lesson content; `C5.5` measure & document platform delta.

---

## Cross-cutting concerns

**CI (green on every PR, from CB.2 onward)** — typecheck → lint → dependency-boundary guard → `pnpm -r test` (Vitest) → Playwright (from M2) → agent-loop smoke (from M3). All hermetic: **fake TTS, no network, no API keys**. The one live ElevenLabs build is a manual, local step per release.

**Determinism as a test, not a hope** — the repeatability test (C0.7) and the frame-stability test (C3.3) guard the "same inputs → byte-identical outputs" principle in CI.

**Diagnostics are a public API** — error-message snapshot tests (C0.3) are updated deliberately, reviewed like interface changes, because the agent iterates against them.

**Deferred decisions** (ARCHITECTURE §9) — defaults taken as noted (D5–D7 above, plus: sentence-level VTT first, hand-rolled VTT parser, one `spring` preset, overlay-div fake cursor, touch from M2). Revisit triggers: turborepo if build times hurt; Howler if Safari time-resolution breaks; word-level karaoke as an emit-stage extension; MFA if stable-ts alignment (the later `align` adapter) proves too coarse.

**Rename gate** — ✅ cleared. The `@xv/*` placeholder scope was renamed to `@narrable/*`; the CLI stays `lesson` (kept intentionally, not renamed). Done before the C3.7 public deploy as required.

---

## Commit ledger (quick reference)

```
✅ CB.1 workspace + package stubs build
✅ CB.2 test/lint/CI + dependency guard
✅ C0.1 core types + schema + easing
✅ C0.2 interpolator + kernels (seek property tests)
✅ C0.3 parse + check + fake TTS + diagnostics snapshots
✅ C0.4 reconciliation math in core
✅ C0.5 synthesize + caching
✅ C0.6 resolve + expand (conflict rule, recorded merge)
✅ C0.7 emit (tracks/VTT/audio) + determinism test
✅ C0.8 CLI new/check/build/state/ref + unit-circle fixture      [R0, tag m0]
✅ C1.1 AudioClock + StateStore
✅ C1.2 TimelineDriver rAF loop
✅ C1.3 SceneHost + scene contract
✅ C1.4 unit-circle 2D render
✅ C1.5 Player composition + DOM layering
✅ C1.6 Chrome + keyboard + dev URL params                        [R1, tag m1]
✅ C2.1 Reconciler (ownership matrix)
✅ C2.2 InteractionManager + unit-circle handle
✅ C2.3 camera-orbit ingredient
✅ C2.4 Board + KaTeX + highlight
✅ C2.5 Captions + toggle
✅ C2.6 PauseGate
✅ C2.7 Playwright seek/catch-up/pause-gate suite                 [R2, tag m2]
✅ C3.1 ElevenLabs adapter + chunking + caching
✅ C3.2 FR + EN scripts + both-language build
✅ C3.3 frame command + determinism
✅ C3.4 static bundle
🔶 C3.5 preview: static serve + watch + live-reload (not Vite HMR)
✅ C3.6 agent-loop smoke test in CI
✅ C3.7 deploy (live HF Space, both langs, real voice, verified) + agent-authoring validation (backprop lesson)  [R3, tag v0.1.0]
⬜ C4.* record mode + recorded-track merge (sketch)
⬜ C5.* ingredients + second 3D lesson (sketch)
```

---

## Post-slice additions

Work done while iterating on the running slice, not in the original plan. All committed on `master`; unit + dual-browser e2e green.

- ✅ **Safari playback** — dev servers (`preview`, `frame`, e2e) now support HTTP Range (`206`); WebKit refuses to play `<audio>` from a plain `200`. e2e runs on **Chromium + WebKit** to guard it. (Static hosts already do Range, so deploys were never affected.)
- ✅ **Canvas crispness** — canvas backed at `devicePixelRatio` + `ResizeObserver`; unit-circle draws with radius-relative sizes. Fixes blur, including fullscreen.
- ✅ **Fullscreen toggle** — the chrome icon (and `f`) now exit fullscreen too; control buttons given a proper sized/centered hit area.
- ✅ **Scrubber robustness** — drag detection driven by the `input` event (not flaky pointer events), so it keeps working after play/pause across browsers.
- ✅ **`.env` auto-loading** — the CLI loads `.env` (cwd + lesson dir) via Node's built-in `process.loadEnvFile`, so `ELEVENLABS_API_KEY` needn't be exported each run.
- ✅ **Audio format** — `TtsResult.format` (mp3 for ElevenLabs, wav for fake) drives the emitted filename and `<source>` type; the bundle copies the audio named in `tracks.json`.
- ✅ **Seek-accurate audio (m4a)** — ElevenLabs MP3 has malformed frame headers, so browsers byte-offset-seek it imprecisely and the voice drifts from the animation after scrubbing (all browsers; WebKit even misreads its duration). The CLI now transcodes real-voice MP3 → sample-indexed AAC/MP4 (`audio.m4a`) via ffmpeg; both engines then read the correct duration and seek exactly. Fake/CI stays WAV (hermetic, no ffmpeg).
- ✅ **Narration speed** — `lesson.yaml` `tts.speed` (ElevenLabs speaking rate) threaded through the request + cache key; fake TTS scales duration too.
- ✅ **Spoken pause prompts** — `@pause` narrates its prompt (injected into the spoken text, checkpoint anchored just after); `speak: false` opts out.
- ✅ **HF Space deploy tooling** — `lessons/<id>/space/` (Space card `README.md` with `sdk: static`, `.gitattributes` LFS-tracking audio) + `scripts/deploy-space.sh` (clone → replace with `build/site/` → push). Audio must be LFS/Xet on HF.
- ✅ **Safari on HF Spaces (blob audio)** — HF serves Xet/LFS media via a 302 to a signed CDN URL bound to a byte range; Safari's range-based media loader 403s on it (works in Chrome). The static bundle now fetches audio up front and plays from an in-memory `blob:` URL — no redirect, no range negotiation. Bundle-entry only; the Player keeps its streaming `<source>` path.
- ✅ **Touch drag (iPad)** — `touch-action: none` on the canvas so touch gestures drag the handle instead of scrolling the page.
- ✅ **Pause gate hardening** — re-arms whenever playback goes back before a checkpoint (was one-shot until seek-to-start); snaps the clock to the exact checkpoint on trigger so Safari's audio-output latency doesn't leak the next word and resume is clean; board panel made `pointer-events: none` (non-modal) so it no longer blocks dragging a handle beneath it.

---

## Post-validation follow-ups

Acting on the C3.7b findings (see [docs/agent-authoring-validation.md](./docs/agent-authoring-validation.md)). All committed on `master`; `CI=true pnpm check` = 130 unit tests / 24 files.

- ✅ **Overlap warning sharpened** — one warning per truncating cue (not per assignment), the real filename (was `<script>` on the build path), and the source line where the truncated transition began.
- ✅ **`lesson state --drag`** — headless interaction check: simulates a viewer grabbing a param at `t` and prints the reconciled hold-then-glide trajectory (scripted vs displayed), reusing the real `StateStore`+`Reconciler` in Node. Closes the biggest agent-loop blind spot (finding #1).
- ✅ **`lesson new` flags** — honors `--lesson <dir>` and `--lang`; a fresh scaffold passes `check` cleanly.
- ✅ **Named parameter groups** — a scene exports `groups`; `@cue(weights -> […])` sets a whole group in one cue (checked, shown by `ref`, expands identically). Addresses the multi-assignment-cue readability finding; the backprop descent cues use it.
- ✅ **`.env` load guard** — an unreadable `.env` no longer crashes the CLI.
- ⬜ **`@bake`** — design note only; the one open follow-up (see [What remains](#what-remains)).

---

## What remains

1. **`@bake` (animate a computed process)** — the one open validation follow-up. Design note: [docs/computed-cues-design-note.md](./docs/computed-cues-design-note.md) (recommends a build-time, checkable `@bake` directive; scene exports pure "baker" functions the compiler runs to fan out static keyframes). Not yet built.
2. **Optional: real-voice backprop build + HF Space deploy** — put the new lesson live alongside unit-circle. (Adapter + caching ready; anticipation default accepted as-is.)
3. **M4** — record mode + recorded-track merging + fake cursor.
4. **M5** — grow `ingredients` (axes, arrows, draggable points, scrub-able KaTeX numbers) + a second, 3D (three.js) lesson to force the abstractions.
5. **Deferred niceties** — Vite module-level HMR for `preview`; word-level (karaoke) captions; the `align` adapter (forced alignment of a human recording).
