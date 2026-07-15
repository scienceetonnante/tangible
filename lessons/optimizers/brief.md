# Design Document: "Why Adaptive Optimizers Exist" — a narrated explorable

## Part 1 — The Interactive Artefact

### Overall layout

A three-region layout, widescreen. The left two-thirds is the **stage**; the right third is the **control and readout column**. A slim **transport bar** runs along the bottom. Maybe a place to display equations?

**Stage (left, dominant).** A 3D loss surface rendered as a lit, semi-transparent mesh over a 2D weight space (axes w₁, w₂; height = loss). The camera is always under the learner's control — orbit by drag, zoom by scroll, pan by right-drag. This is the zero-stakes continuous outlet: looking never changes state, so the learner can fly around freely at any moment, including while the narrator talks. Up to three optimizer trajectories are drawn on the surface as colored ribbons that climb-drop with the terrain, each with a moving head-marker showing the optimizer's current position. A single shared **start point** sits on the surface as a draggable puck; all active optimizers launch from it.

**Readout column (right).** Top: a **loss-vs-step plot**, one colored line per active optimizer, sharing the trajectory colors. This is where "faster" becomes quantitative rather than vibes, and where matched-time comparison reads cleanly. Middle: the **control panel** (detailed below). Bottom: the **equation card** — the update rules for whichever optimizers are active, rendered live, plus the one conditioning-stability relation. Persistent, glance-level; it's there to signal honesty, not to be read line-by-line.

**Transport bar (bottom).** A **scrub timeline** over optimization steps with play/pause. Scrubbing moves all trajectory heads and the loss-plot cursor together, so you can freeze every optimizer at step 30 and compare where they *are*, not just where they end. A "re-run" button relaunches from the current start point.

### Controls, sorted by stakes

*Always-live, zero-stakes:* camera (orbit/zoom/pan), scrub/play.

*Shared, medium-stakes — these define the problem:*
- **Start puck** — drag anywhere on the surface; sets the common launch point.
- **κ slider (conditioning)** — the primary terrain handle. Stretches the bowl from round (κ=1) to a narrow ravine (κ large). Labeled as condition number, because for this audience that's the honest name.
- **Roughness slider** — superimposes a sinusoidal ripple on the bowl, amplitude from zero (smooth) upward. Orthogonal to κ: κ stretches, roughness bumps.

*Per-optimizer, grouped under each optimizer's toggle so they appear only when active:*
- **SGD** — learning rate.
- **SGD + momentum** — learning rate, β.
- **AdamW** — learning rate, β₁, β₂, weight decay.

Each optimizer has an on/off toggle and owns its trajectory color throughout (stage ribbon, loss line, equation-card block all share it).

### What updates together, and why it earns the medium

Moving κ or roughness redraws the surface *and* re-solves all active trajectories live *and* redraws their loss curves — the terrain, the paths, and the quantitative plot are one coupled system. Dragging the start puck re-solves all trajectories from the new point. Scrubbing freezes all representations at a common step. Hovering a trajectory head shows that optimizer's current loss and gradient-step size. The point the whole layout is built to make visible: **the same terrain produces qualitatively different path geometries under different update rules**, and you can only see that by having the paths, the terrain, and the step-matched clock all live at once.

### The one correctness-critical behavior

SGD's learning-rate slider is a fixed handle, not auto-scaled. Because the largest stable LR for SGD scales inversely with the largest curvature, sweeping κ up with SGD's LR held fixed will drive SGD from convergent → zigzagging → divergent *without touching its slider*. This is a feature and the demo's central reveal; the narration frames it explicitly rather than hiding it behind fairness machinery.

---

## Part 2 — The Narrative

Target ~3.5 min. Beats marked ⚡ are the 2-min core; beats marked ○ are the expansions that can be cut.

**Beat 1 — Orient (⚡ ~20s).** Open on a gentle round bowl (κ=1, roughness=0), one optimizer active: plain SGD. Narrator drops the start puck near the rim and hits play; the ribbon rolls straight to the bottom, loss curve slides smoothly to zero. *"This is gradient descent on the easiest possible problem — a round bowl. It just rolls downhill. Watch what happens when the bowl stops being round."* Camera is already free; the learner is likely orbiting.

**Beat 2 — Introduce κ, first break (⚡ ~30s).** Narrator grabs the κ slider and pushes it up, slowly. The bowl stretches into a valley; the SGD ribbon starts bouncing wall-to-wall, crawling along the floor. *"I haven't touched the step size. I've only made the bowl narrower in one direction — and the same algorithm is now zigzagging. This is conditioning, and it's the problem every optimizer since has been trying to fix."* Narrator parks κ mid-high and gestures at the mess — an unfinished gesture inviting the learner to push it further themselves.

**Beat 3 — Handoff + threshold checkpoint (⚡ ~30s).** Narrator releases. *"Find where it falls apart — sweep the conditioning until SGD can't cope."* Learner drives κ, watches the zigzag worsen into divergence, feels the threshold. This is the prediction-and-test beat: the thing being located is a point in a continuous space. Narrator reclaims by re-centering κ at the divergence edge.

**Beat 4 — The fixes, as contrast (⚡ ~40s).** Narrator toggles on SGD+momentum, then AdamW, on the same ravine, same start. Three ribbons now. Scrub to a matched early step: SGD still bouncing off walls, momentum's oscillation damped, AdamW already near the floor. *"Each of these is a specific fix. Momentum smooths the oscillation" —* sweeps β up, zigzag visibly damps *— "and AdamW scales each direction separately, so it stretches its step along the flat floor."* The loss plot shows the three curves separating. This is the money shot: same terrain, three qualitatively different geometries.

**Beat 5 — Roughness, the second axis (○ ~30s).** *"Conditioning isn't the only way to make this hard."* Narrator zeroes κ back toward round, then turns up roughness — the smooth floor grows bumps. Re-run. Now the story is escape and getting stuck, not zigzag: SGD stalls in a ripple trough; momentum and AdamW carry through. Narrator hands roughness to the learner briefly. *"This is a different kind of hard — and notice the two knobs are independent. One stretches, one roughens."* Left as an explored hook, not fully exhausted.

**Beat 6 — A second checkpoint via the LR slider (○ ~20s).** *"Earlier I said I never touched SGD's step size. Try it now — can you rescue SGD on the ravine?"* Learner turns SGD's LR down, watches the divergence come back under control but convergence turn glacial. Lands the stability relation from the opposite direction: it was never unfixable, just badly scaled.

**Beat 7 — Formalize (⚡ ~20s).** Narrator gestures at the persistent equation card — the three update rules, and the κ-to-max-stable-LR relation. *"Everything you just felt is in these three lines. The zigzag threshold you found by hand is this inequality; momentum adds this term; AdamW divides by this running scale."* Glance-level: connect, don't derive.

**Beat 8 — Transfer (⚡ ~15s).** *"You've been watching two dimensions. Real models have billions — and this surface is only ever a 2D slice of them. The question to take away: which of these behaviors do you think survives in a million dimensions, and which are artifacts of the picture?"* Close on the learner free to keep flying.
