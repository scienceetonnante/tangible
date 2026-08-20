# Design note — animating a computed process

*Status: implemented. The durable contract is documented in the
[architecture](../framework/architecture.md) and
[directive reference](../reference/directives.md).*

## Problem

Value-at-time makes every runtime state seekable, but it means ordinary cues can
only assign absolute values. The backprop lesson therefore computes gradient
descent outside the toolchain and pastes three weight vectors into its script.
Those literals become stale if the model, inputs, or learning rate changes, and
`lesson check` cannot tell whether they are mathematically correct.

Computed processes are common in ML, physics, numerical methods, and simulations.
They need a first-class build-time representation without moving computation into
the player.

## Decision

Add scene-exported **bakers** and a compiler-only `@bake` directive. A baker receives
declared parameter values and returns one or more computed parameter states. The
compiler validates those states and expands them into ordinary keyframes.

```markdown
@bake(descent, steps: 1, over: 2s)
```

This preserves the existing invariants:

- The player still consumes static value-at-time tracks.
- Authored and generated artifacts remain text/JSON/audio.
- `check` can run without TTS or network access.
- The scene computation remains Node-loadable and DOM-free.

## Why not computed scalar cue values

A form such as `@cue(w11 -> step(w11))` is too weak. A gradient update is coupled:
one weight's target depends on all weights, activations, and the learning rate.
Making every scalar expression reach into global state would recreate a baker one
parameter at a time with a less explicit dependency contract.

## Tightened semantics

### Explicit dependencies

Each baker declares `reads` and `writes`. The compiler supplies only the declared
reads, and every returned step must contain exactly the declared writes. This makes
the cue reference useful and lets `check` validate the entire output shape.

### Authored state, not audio-time state

The original proposal said a baker would snapshot the interpolated state at its
resolved audio time. That cannot be checked without TTS and could make `check` and
`build` compute different values.

Instead, bakers consume timing-independent **authored state** evaluated in script
order: defaults followed by cue targets and prior baker outputs. Audio timing only
places the already-computed values on the timeline. One shared compiler pass must
provide this state to both validation and expansion.

### Narration alignment

Multi-step bakes use even spacing across `over`. That is useful for compact sweeps,
but it cannot reproduce three updates anchored to three separate spoken phrases.
Authors should repeat one-step bakes when individual steps need their own narration
anchors. Backprop will keep its three anchors and replace each literal cue with a
one-step bake.

### Honest parity target

The former plan required one six-second bake to produce byte-identical tracks to
three cues with different anchors, holds, and durations. That is impossible under
even spacing. The new acceptance test checks computed weight vectors and losses at
the step endpoints, while retaining the existing anchors and durations.

### Determinism

`check` runs each baker twice from cloned identical input and reports unstable
output. This catches obvious nondeterminism but cannot prove purity in JavaScript.
The baker contract forbids time, randomness, I/O, DOM access, and mutable module
state; repeatable-build and lesson-parity tests remain the durable guards.

## Rejected fallback

A validation-only assertion over pasted literals would catch some drift but would
leave the parallel simulation and manual transcription in place. It may still be
useful later, but it does not solve the authoring problem.
