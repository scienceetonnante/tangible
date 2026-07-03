# Authoring log — Backpropagation lesson

An honest friction log from authoring a complete lesson (scene + narration +
choreography) using only the platform docs, the `unit-circle` example, and the
`lesson` CLI. Negative findings are kept sharp on purpose.

Overall: the lesson came together fast and the inner loop (`check` -> `build --fake`
-> `state --at`) is genuinely good. The one structural mismatch is that this topic
wants to *animate a computed process*, and the format only lets you write *absolute
values at times* — so I had to simulate the whole training run offline and paste the
numbers in. And I could not self-verify the interactive payoff at all.

---

## 1. Markup ergonomics

**Natural / worked first try:**
- `@cue(param -> value, over: Ns)` for animated transitions, and multi-assignment
  cues sharing options. A gradient step is one cue with six assignments —
  `@cue(w11 -> 0.74, w12 -> -0.28, ..., over: 2s)` — which reads well.
- `@show(loss)` sugar -> `show.loss = true`. Obvious.
- `@board(id: $katex$)` doubling as declare-and-show is the right default; I never
  wanted a "declare but hide" form.
- Sub-expression highlighting: tag with `\htmlClass{a}{...}` in the KaTeX, then
  `@highlight(chain.a)`. Tagging the four chain-rule factors and lighting them in
  sequence was the single most satisfying thing to author, and it Just Worked
  (verified: highlights fire at 86.0 / 88.4 / 91.9 / 95.1 s, staggered as written).
- Scalar sweep params (`forward`, `backward` in `[0,1]`) driven by one cue each
  (`@cue(forward -> 1, over: 3.5s)`) to get the left->right / right->left reveal. The
  grammar has no "sweep" concept, but a plain animated scalar the render interprets
  covers it cleanly. This felt like the intended idiom.

**Awkward / surprising:**
- **The big one — you cannot express "take a gradient step"; only "set these exact
  numbers".** The value-at-time rule (no deltas) is correct for seekability, but it
  means an animated *process* (gradient descent) has to be precomputed outside the
  tool. I wrote a throwaway Node script to run three descent steps, then pasted the
  resulting weights into three cues as literals:
  `@cue(w11 -> 0.878, w12 -> -0.211, ...)`. If I change the learning rate, the inputs,
  or the initial weights, every one of those literals is silently wrong and nothing
  will tell me — `check` validates ranges and types, not "is this the actual
  gradient step." For a physics/ML topic this is the dominant authoring cost. See §7.
- **Multi-line cues read badly.** A six-assignment cue is ~120 characters; wrapped
  across lines it visually swamps the one sentence of narration it belongs to. The
  prose-with-inline-directives model is lovely for one or two cues per sentence and
  fights you when a single beat sets six params.
- **Anchoring an inline directive to "the next word" is imprecise for mid-sentence
  highlights.** I wanted factor `a` lit *while* saying "how the loss depends on the
  output". I had to place `@highlight(chain.a)` immediately before "how" and trust
  the -0.2 anticipation. There is no "anchor to *this* word" or "anchor to the word
  N ahead" — only "the next word", plus a numeric `at:` nudge. Fine here; would be
  fiddly for dense term-by-term call-outs.

**Wanted but couldn't express:**
- A way to say "this weight's target is `previous - eta*dL/dw`" — i.e. a computed cue
  value. Even allowing arithmetic on constants in a cue value would not be enough (it
  needs the live activations). See §7.
- Nothing for "hold this highlight until the next one" vs. "pulse" — highlights are
  sticky booleans; I cleared them all at once with `@dim(chain)`. That matched my
  intent, but a one-at-a-time "move the spotlight" would have been nice sugar.

**Worst papercut:** having to maintain a parallel offline simulation just to know
what numbers to type, with no check that the typed numbers match it.

---

## 2. The anticipation default (-0.2 s)

- I left `anticipation: -0.2` untouched and **never reached for an `at:` override.**
  For every cue in this lesson, "fire 0.2 s before the anchor word" was fine or
  indistinguishable from fine.
- Honest caveat: **I built only with `--fake` TTS, which is uniform 60 ms/character.**
  That has no prosody — no pauses, no stress, no variable word length in *time*. So I
  cannot actually judge whether -0.2 s lands cues on the beat of real speech; I can
  only confirm the ordering is right. Whether -0.2 is the right default is precisely
  the thing fake TTS *cannot* validate, and the task (rightly) forbids real TTS. This
  is a structural limit of the validation experiment, not of the default.
- The one place I *would* expect to want `at:` with real audio is the forward-pass
  sweep: I want `forward -> 1` to *start* exactly as the voice says "push the inputs
  through," and a 3.5 s sweep to roughly track the sentence. With fake TTS I can't
  feel the mismatch, so I left it on the default.

---

## 3. Hold-and-blend / `shared` ownership

- I made the six weights `ownership: "shared"` (script animates them during the
  descent steps; learner can also grab them) and the learning rate `viewer` (once
  touched, it sticks).
- **I understood the model from ARCHITECTURE §5.5 — but I could not observe it.** The
  rule ("the viewer's value holds until the scripted track's next keyframe at/after
  the touch, then script resumes with an exponential glide") is clear on paper. The
  subtlety I only realized while authoring: for most of the timeline the weight
  tracks have **no keyframes at all** (weights only get keyframes during the descent,
  ~113–127 s). So:
  - If the learner drags `w11` during the final `@pause` (t~143, after every
    keyframe), there is no future keyframe -> `shared` behaves like `viewer` forever.
    That is exactly what I want at the "your turn" moment — but I got it by accident
    of keyframe placement, not by saying so. The *same* declaration would hold-then-
    snap-back if the learner dragged during the descent. "Shared" is really "viewer
    until the script next touches it," and whether that ever happens is an emergent
    property of the compiled tracks, not something visible in the script.
  - **The `state --at` tool dumps *scripted* state only — it ignores interaction and
    the reconciler entirely.** So I have *no* way, in this CLI loop, to verify the
    thing that most defines the medium: that dragging a weight holds, recomputes the
    forward pass + loss live, and glides back correctly. I verified the *math* of the
    live recompute by running `render`/`forward`/`gradients` against a stub canvas in
    Node (loss and dL/dw11 came out identical to my offline model), but the
    *reconciliation feel* is untestable without a browser. This is the single biggest
    blind spot in the agent loop for an interactive lesson.

---

## 4. Diagnostics

`check` is the strongest part of the toolchain. I deliberately injected five errors
into a copy of the script; every message was precise, positioned, and actionable:

```
script.en.md:7:8:  error: w11: 5 is out of range [-2, 2]
script.en.md:7:37: error: unknown parameter "w13" — did you mean "w11"?
script.en.md:8:1:  error: unknown parameter "show.loos" — did you mean "show.loss"?
script.en.md:9:38: error: @highlight target "eq.z" is not tagged \htmlClass{z}{...} in board item "eq"
script.en.md:10:1: error: unknown easing "bouncy"
```

The did-you-mean on `w13 -> w11` and `show.loos -> show.loss`, and the htmlClass-tag
check, each got me straight to the fix. No misleading messages.

The **one real warning I hit during normal authoring** was the overlap rule. My first
draft fired the 2nd and 3rd descent steps too close together and got:

```
<script>:59:13: warning: overlapping transition truncated at 122.200s
<script>:59:13: warning: overlapping transition truncated at 122.200s     (x6)
```

Papercuts with this message:
1. **It repeats once per assignment** — six identical lines for one six-weight cue.
   Should dedupe per cue.
2. **`<script>` instead of `script.en.md`** — the build path loses the filename that
   `check` gets right (compiler is called with a placeholder here).
3. **It points at the *new* cue and says *when*, but not *which prior cue* it
   truncated.** "truncated at 122.200s" is a compiled timestamp; to act on it I had to
   map 122.2 s back to a line, which meant reasoning about fake-TTS char timing. A
   "truncated the transition started at script.en.md:55" would have been immediately
   actionable.

I fixed it by spacing the anchors out in the narration and shortening the `over:`
durations so each step completes before the next begins (verified: step 2 ends 123.8 s,
step 3 starts 125.5 s, no overlap).

---

## 5. Scene contract

- **Pure-function-of-state render was easy and natural** for this topic, and paid off
  exactly as advertised: activations, gradients, and the loss are all computed inside
  `render` from the weight state, so a dragged weight recomputes the whole picture for
  free with zero extra wiring. `forward()` and `gradients()` are plain exported
  functions; the render reads them. No cross-frame mutable state was ever tempting.
- **The Node-load restriction on `schema` caused zero friction.** I kept `X1/X2/TARGET`
  as module constants and all canvas work inside `create()`. Type-only imports from
  both `@narrable/core` and `@narrable/player` are erased. `lesson ref` loaded the
  scene in Node on the first try.
- **devicePixel/viewport model is clean** — I scaled every stroke/font off
  `R = min(w,h)*0.4`, copying the example. One small awkwardness authoring a *wide*
  graph: node *positions* want fractions of `width`/`height` independently (the layout
  is landscape), while *sizes* want a single scale `R`. Mixing "fractions of w/h for
  position" with "R for size" is a two-system layout; it works but isn't as tidy as
  the example's radially-symmetric circle where one `R` does everything.
- **Handles were straightforward.** Seven handles (six weights + an eta slider),
  specific hit-tests, no catch-all needed. One design question the contract doesn't
  answer: `hitTest`/`onDrag` receive pointer coords and `state`, but I need the
  *layout* to hit-test, and layout depends on `viewport()`, not `state`. I closed over
  `viewport` (as the example does). Fine, but every handle recomputes layout on every
  hit-test; for a heavier scene that would want caching the contract doesn't hint at.
- I could not use `lesson frame` (sandbox blocks its socket, as noted), so all
  render/handle verification was via a hand-rolled esbuild + stub-canvas smoke test.
  That caught nothing broken, but it's verification I had to build myself; the built-in
  `frame` path being unavailable in-sandbox means the agent's only *visual* check is
  unavailable, leaving a gap between "the numbers are right" and "it looks right."

---

## 6. What I actually verified

- `check --lang en`: **no errors.**
- `build --fake --lang en`: **built, no warnings** (after fixing the overlap).
- `state --at` spot-checks (scripted state):
  - t=10 (intro): `forward=0, backward=0, show.loss=false, w11=0.5, wo1=0.6, chain=hidden` OK
  - t=42 (post forward sweep): `forward=1, show.loss=true, backward=0`, weights still initial OK
  - t=75 (backward pass): `forward=1, backward=1` OK
  - t=90 (mid chain-rule): `chain=shown, a=true, b=true, c=false, d=false` OK (spotlight moving)
  - t=118 (after step 1): `w11=0.74, wo1=0.727, backward=0, chain=dimmed` OK
  - t=130 (after step 3): `w11=0.949, wo1=0.962` OK (loss ~ 0.008, converging)
- Stub-canvas render: issues `clearRect` + 6 `arc`s + 25 `stroke`s, no throw; `w11`
  hit-test true at its edge midpoint, false far away; drag maps up->+2 / down->-2
  (clamped to range); `forward(state).loss = 0.383` and `gradients(state).w11 = -0.480`,
  identical to the offline model -> the live recompute math is correct.

---

## 7. What I'd change, ranked

1. **Let the agent verify interaction, not just scripted state.** `lesson state --at`
   should optionally take a hypothetical interaction (`--drag w11=0.9 --at 143`) and run
   the reconciler, so the interactive payoff — the whole reason for the medium — is
   checkable in the headless loop. Today the reconciler is browser-only and invisible to
   the CLI. (Biggest gap.)

2. **A first-class way to animate a computed process.** For any ML/physics topic, the
   author is currently forced to run a parallel offline simulation and paste literal
   value-at-time snapshots that `check` cannot validate. Options, roughly in order of
   ambition: (a) allow a cue value to be a scene-exported pure function evaluated at
   build time from current state (`@cue(w11 -> step(w11))`); (b) a `@bake` directive that
   asks the scene for a `Keyframe[]` given a start state and a count ("10 descent steps
   over 8 s"); (c) at minimum, a lint that recomputes and warns when pasted literals
   don't match a declared update rule. Without one of these, "value-at-time" quietly
   pushes the hardest modeling work outside the toolchain.

3. **Fix the overlap warning:** dedupe per cue (not per assignment), use the real
   filename instead of `<script>`, and name the *source location of the truncated cue*,
   not just the compiled timestamp.

4. **Make `frame` (or an equivalent visual check) work in-sandbox**, or document a
   supported stub-canvas smoke-test pattern — right now the agent can confirm numbers
   but not appearance, and has to hand-roll the render harness.

5. **`lesson new` should honor `--lesson <dir>` and the target language.** It writes to
   `cwd/<id>` and emits a French-only skeleton regardless; I bypassed it and wrote the
   three files by hand from the example (which was easy, so this is minor).

6. **Multi-assignment cue readability.** Some sugar for "set a group of params to a
   vector of values" would keep a six-weight step from visually burying its sentence —
   e.g. an array form, or a named group in the schema.
