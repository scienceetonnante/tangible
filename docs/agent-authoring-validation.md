# Agent-authoring validation (C3.7b)

*The core validation target of the M3 vertical slice (DESIGN §9): can an agent, given only the platform's docs and CLI, author a competent explorable lesson? This is the writeup of that experiment. Date: 2026-07-03.*

## Method

We deliberately went **harder than the original plan**. Rather than have an agent draft a *script* against the existing unit-circle scene, one strong agent (Claude Opus) authored a **brand-new lesson end to end** — both the `scene.ts` visualization *and* the `script.en.md` narration + choreography — on a topic the slice was never shaped for: **backpropagation in a small MLP**.

The agent was given: the authoring docs (scene contract + directive grammar), the `unit-circle` lesson as a worked example, the project design documents available at the time, and the CLI loop (`ref` → `check` → `build --fake` → `state --at`). It was **not** given a scene to start from, human choreography, or real TTS. It kept an honest friction log as it worked.

Deliverable lesson: [`lessons/backprop/`](../lessons/backprop/) — `lesson.yaml`, `scene.ts` (~290 lines), `script.en.md`, and the raw agent log [`FINDINGS.md`](../lessons/backprop/FINDINGS.md).

## Verdict

**Pass, and then some.** The agent produced a genuinely good lesson — a 2-2-1 network with a forward-pass activation sweep, a right-to-left gradient flow, the chain rule spotlit factor-by-factor on the board, three animated gradient-descent steps (loss 0.383 → 0.008), and a learner "your turn" pause with draggable weights. It passed `check` on the first try and built with no warnings after one overlap fix. The topic is harder than the slice's design target, and the medium carried it.

Critically, the lesson exercises the **`shared` ownership / reconciliation** path — weights the script animates *and* the learner can drag — which the unit-circle slice never touched. It composed correctly on the first real attempt.

## What worked (validates the architecture)

- **Pure-function-of-state render paid off exactly as designed.** Activations, per-weight gradients, and the loss are all computed inside `render` from the weight state (`forward()`/`gradients()` as plain exported functions). Consequence: a dragged weight recomputes the *entire* picture — activations, gradient arrows, loss — for free, with zero extra wiring. The agent called this out unprompted as the moment the design "just worked."
- **Diagnostics are the standout.** Every injected error produced a precise `file:line:col` message with a did-you-mean; the `\htmlClass` tag-check for `@highlight` caught a mistagged chain-rule factor. No misleading messages. The agent iterated against `check` as its primary loop, as intended.
- **The inline-directives-in-prose model** was "lovely for one or two cues per sentence." `@board(id: $katex$)` as declare-and-show, `@show` sugar, and `\htmlClass`-tagged sub-expression highlighting lit in sequence were all authored smoothly — the last was singled out as "the most satisfying thing to author."
- **Scene-contract constraints caused zero friction:** the Node-load restriction on `schema` (keeping canvas work inside `create()`), the device-pixel/`viewport()` model, and the DOM-free `Handle` shape were all followed correctly from the docs alone.

## Structural findings (the real payoff)

These are architectural, not cosmetic — they are the reason the experiment was worth running.

1. **Interaction cannot be verified headlessly.** `state --at` reports *scripted* state only; the reconciler — the hold-and-blend that *defines* the medium — is browser-only and invisible to the CLI. The agent could verify the recompute *math* (against a stub canvas) but was structurally blind to the interactive feel. **Confirmed from the reviewer side:** the two visual bugs found in frame review (below) were precisely the kind the agent could not have seen. This is the single biggest gap in the headless agent loop for an *interactive* lesson.

2. **There is no way to animate a computed process.** Value-at-time (no deltas) is correct for seekability, but it forced the agent to run gradient descent in a **throwaway offline script** and paste literal weight snapshots into cues — literals that `check` cannot validate (change the learning rate or inputs and every number is silently wrong). For any ML/physics topic, this pushes the hardest modeling work *outside* the toolchain. This is the most important thing to fix for the medium to generalize.

3. **The anticipation default is unverifiable under fake TTS.** Fake TTS is uniform 60 ms/char with no prosody, so whether `-0.2s` lands cues "on the beat" of real speech is exactly what the hermetic loop cannot judge. The agent never reached for an `at:` override, but honestly flagged that it couldn't feel the mismatch. **Open question for real-voice tuning.**

## Papercuts (small, cheap to fix)

- **The overlap warning** repeats once per assignment (6× for a six-weight cue), prints `<script>` instead of the source filename, and names only the compiled timestamp of the *new* cue — not the source line of the transition it truncated.
- **`lesson new`** ignores `--lesson <dir>` and the target language, writing a French-only skeleton to `cwd/<id>`. The agent bypassed it and hand-wrote the three files from the example.
- **Multi-assignment cue readability:** a six-weight cue (~120 chars) visually swamps the one sentence of narration it belongs to.
- **`.env` load crash** (found during setup, already fixed): the CLI's `.env` auto-loader threw on an unreadable file (`process.loadEnvFile` on a sandbox-denied read) instead of tolerating it. Guarded with a try/catch.

## Reviewer addendum — visual fixes

Frame review across the timeline (`lesson frame` at 6 timestamps) caught two legibility bugs the headless agent had no way to see — a direct confirmation of finding #1:

1. The two crossing edges (`w12`, `w21`) share an identical midpoint, so their weight *and* gradient labels stacked into an illegible blob. Fixed by placing weight labels 1/3 and gradient labels 2/3 along each edge, separating the crossing pair.
2. The learning-rate slider was drawn at `y=0.9h`, colliding with the caption layer. Lifted to `y=0.8h`.

## Recommendations (ranked)

1. **Let the agent verify interaction, not just scripted state** — e.g. `state --at <t> --drag w11=0.9` that runs the reconciler, so the interactive payoff is checkable headlessly. (Biggest gap.)
2. **A first-class way to animate a computed process** — a build-time computed cue value evaluated from scene-exported functions, or a `@bake` directive that asks the scene for a `Keyframe[]` given a start state and a step count. At minimum, a lint that recomputes and warns when pasted literals don't match a declared update rule. **Designed:** see [computed-cues-design-note.md](./computed-cues-design-note.md) — recommends a `@bake` directive (build-time, checkable, preserves value-at-time).
3. **Fix the overlap warning** — dedupe per cue, use the real filename, name the truncated cue's source line.
4. **Make a visual check work in-sandbox** — `frame` binds a local server socket the sandbox blocks, so the agent's only *visual* check is unavailable; document a supported stub-canvas smoke-test pattern otherwise.
5. **`lesson new`** should honor `--lesson` and language; **multi-assignment cue** sugar (array/group form) would keep a step from burying its sentence.

## Follow-up — current status

The immediately actionable findings and the later computed-process milestone have
shipped:

- **#1 headless interaction** → `lesson state --at <t> --drag <param>=<value>` now runs the real reconciler in Node and prints the hold-then-glide trajectory (scripted vs displayed). The `shared` behaviors above are now checkable without a browser.
- **#2 computed process** → the build-time, checkable `@bake` directive is implemented. Backprop now calls its real descent function at all three narration anchors and contains no pasted weight targets; see [computed-cues-design-note.md](./computed-cues-design-note.md).
- **overlap warning** → now one warning per cue, with the real filename and the truncated cue's source line.
- **`lesson new`** → honors `--lesson <dir>` and `--lang`; the scaffold passes `check` cleanly.
- **#6 multi-assignment cue** → named parameter **groups**: a scene exports `groups`, and `@cue(weights -> [ … ])` sets the whole group in one readable cue (validated by `check`, shown by `ref`). Backprop retains its `weights` group for authored snapshots, while descent now uses `@bake`.

The anticipation default (#3) remains open — it needs a real-voice build to judge.

## Bottom line

The medium and its authoring loop are sound enough that a strong agent can build a competent, genuinely interactive lesson on a new topic from the docs alone. Its two largest structural findings—headless interaction verification and build-time computed processes—have since shipped; the remaining gaps are the narrower production and visual-review items recorded above.
