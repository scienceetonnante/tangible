# Design note — animating a computed process

*Status: proposal, no code. Prompted by C3.7b finding #2 (see [agent-authoring-validation.md](./agent-authoring-validation.md)). This note frames the problem, states the invariant any solution must preserve, weighs three approaches, and recommends one.*

## The problem

The medium's core rule is **value-at-time**: every parameter is a pure function of `t`, baked at compile time into dense keyframe tracks; the runtime only looks up and interpolates. This is what makes seeking, catch-up, and headless frame rendering possible. A direct consequence is that a cue can only say *"this param equals this value at this time"* — there are **no deltas**, no "advance the simulation one step."

That rule collides head-on with any lesson whose subject *is* a computed process. The backprop lesson is the canonical case: to show three gradient-descent steps, the author had to run the descent in a **throwaway offline script** and paste the resulting weights back as literal cues:

```markdown
@cue(w11 -> 0.878, w12 -> -0.211, w21 -> -0.635, w22 -> 0.633, wo1 -> 0.87, wo2 -> -0.501, over: 1.2s)
```

Two costs:
1. **A parallel simulation the toolchain doesn't know about.** Change the learning rate, the inputs, or the initial weights, and every pasted literal is silently wrong.
2. **`check` cannot validate any of it.** It verifies types and ranges, not "is this the actual gradient step." The hardest, most error-prone modeling work lives *outside* the tool, unchecked.

For a platform whose whole point is ML/physics explorables, this is the dominant authoring cost, and it will recur in every simulation-shaped lesson.

## The invariant a solution must preserve

Whatever we add, it must not weaken these ([DESIGN §10](../DESIGN.md)):

- **Value-at-time.** The emitted artifact stays dense static keyframes; the runtime stays a dumb interpolator. So **all computation happens at build time, in the compiler** — never at runtime. Runtime computation would break seeking, catch-up, and headless render.
- **Determinism / repeatability.** Emit is a pure function of (script, scene, cache); re-runs are byte-identical (guarded by the C0.7 test). Any computation we invoke must be pure — no `Date`/random, same rule scripts already follow.
- **Text-only artifacts.** The build output remains `tracks.json` etc.; nothing new ships to the runtime.
- **The Node-load restriction.** The compiler loads scene code in Node with no DOM (like `schema`/`constants`/`presets`). Any author-supplied computation must obey the same rule.

The key realization: because the values of a gradient-descent step are **timing-independent** (they depend on weights/inputs, not on TTS onsets), the compiler can compute *and validate* them without any audio — unlike a pasted literal, a computed step is fully checkable.

## Option A — computed cue value

`@cue(w11 -> step(w11), over: 2s)` — a cue value may be a call to a scene-exported pure function.

- **Fatal weakness:** a cue value is scalar and per-param, but a real step is *coupled* — `w11`'s gradient depends on all weights and the activations. `step(w11)` can't see the rest of the state. The agent flagged exactly this ("it needs the live activations"). To fix it you'd pass the whole state (`step(state)` per param), at which point you've reinvented a clumsier Option B, one param at a time.
- **Verdict:** too weak for any coupled system, which is most of them. Reject.

## Option B — a `@bake` directive (recommended)

The scene exports **bakers** — pure, Node-loadable functions that, given the current state, return a sequence of computed states:

```ts
// scene.ts
export const bakers: Record<string, Baker> = {
  descent: (state, { steps }) => {
    let w = pickWeights(state);
    const out = [];
    for (let i = 0; i < steps; i++) { w = stepGradientDescent(w, state.lr); out.push({ ...w }); }
    return out; // steps × (param → value)
  },
};
```

```markdown
@bake(descent, steps: 3, over: 6s, ease: inOutCubic)
```

Compiler behavior (all at build time, in `expand`):
1. At the directive's resolved time `t`, snapshot the **current expanded state** — the values prior cues have set, overlaid on schema defaults. This is precisely the "live" state the author couldn't reach.
2. Call `bakers[name](state, { steps })`; get `steps` successive states.
3. Lay them out as animated segments evenly across `over:` with the given `ease`, emitting keyframes per affected param — reusing the existing `setAnimate` path, so the **conflict/truncation rule applies unchanged**.

Why it fits:
- **Preserves value-at-time and determinism** — it just produces more static keyframes at build time; the baker is pure and Node-loadable, same contract as `schema`.
- **Solves the real need** — the baker sees whole state, so coupled updates work.
- **Checkable** — `check` can run the baker (no timing needed) and validate every produced value against type/range, and flag a non-pure or throwing baker. The thing that was un-checkable becomes checked.
- **Composes** — baked params remain ordinary keyframe tracks, so `shared` ownership, the reconciler, and `state --drag` all keep working over them.
- **`ref` extension** — list available bakers (name, params written, options) on the cue sheet.

Open questions to settle before implementing:
- **Whole-state input shape.** Bakers should receive the full evaluated state (defaults + prior cues), not just touched params. Cheap: evaluate the in-progress builders at `t`.
- **Time layout.** Even spacing across `over:` is the simple default; a baker could alternatively return its own relative timings if a step should be non-uniform. Start with even spacing.
- **Purity guard.** Reuse the scripts' `Date`/random ban; consider running the baker twice at check time and diffing to catch impurity early.
- **Scope creep.** Keep bakers to *value sequences*, not arbitrary `Keyframe[]` with eases, at least initially — simpler contract, and the cue's `ease`/`over` already cover the common case.

## Option C — a validation-only lint (cheap, ship regardless)

Keep authoring the literals by hand, but let the scene declare an update rule and have `check` recompute and **warn on mismatch**:

```markdown
@cue(w11 -> 0.878, ..., over: 1.2s)  @assert(descent from: previous)
```

- **Pro:** tiny; catches the silent-drift failure (edit lr → literals now wrong) without any new emit path.
- **Con:** authoring is still manual and verbose; doesn't remove the parallel simulation, only checks it.
- **Verdict:** a good **interim** and a fine permanent safety net, but not a substitute for B.

## Recommendation

1. **Build Option B (`@bake`).** It is the only option that removes the offline simulation, expresses author intent directly, keeps every invariant, and — crucially — makes the computed values *checkable*. It reuses the existing `setAnimate`/conflict machinery and the established Node-load scene contract, so the surface area is contained.
2. **Consider Option C's spirit as a smaller first step** if `@bake` is deferred — even just re-running a declared rule and warning on drift would have caught the exact class of error the backprop author was exposed to.
3. **Reject Option A** — per-param scalar functions can't express coupled updates.

Effort estimate for B: a `bakers` export + loader plumbing (mirrors `presets`), a `@bake` parse case, an `expand` case that snapshots state and fans out `setAnimate`, a `check` case that runs+validates the baker, and a `ref` section. No runtime/player changes — the output is just more keyframes.
