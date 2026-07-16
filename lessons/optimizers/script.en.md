---
title: Why adaptive optimizers exist
language: en
---

@scene(landscape)
@chapter(The easy bowl)
@camera(pathView)

This square is a top-down map of a loss surface. Darker means higher
loss; the pale center is the minimum. The white puck is one shared
starting point, and the orange trail is plain gradient descent: the
geometry underneath SGD, shown without minibatch noise so it stays easy
to read. Below it, the loss plot uses the same color.

@camera(roundBowlView, over: 2.5s) On this round bowl, every direction has the same curvature.
@camera(pathView, over: 2.5s) @cue(step -> 60, over: 4s) Step by step, SGD takes a clean route into
the center. Nothing about this problem asks the optimizer to treat one
direction differently from another.

@chapter(Conditioning)

@camera(ravineView, over: 3s) Now I will change the problem without touching SGD's learning rate.
@cue(step = 0, kappa -> 24, over: 4s) As kappa rises, the bowl becomes
a narrow ravine. @camera(pathView, over: 1.5s) In this top-down view, the bands squeeze together
vertically: the vertical direction is now much steeper than the
horizontal one.

@cue(step -> 50, over: 5s) Watch the orange path. Each step crosses the
ravine, overshoots, crosses back, and only slowly makes progress along
the floor. The learning rate that looked sensible on the round bowl is
now close to its stability limit.

@pause(prompt: "Find where SGD falls apart. Drag the condition slider upward while leaving its learning rate fixed, and use the matched-step slider to inspect the path.")

@chapter(Two different fixes)

@cue(kappa -> 24, step -> 18, over: 2s) Bring the problem back to the
edge and freeze all paths at the same eighteenth step. That shared
clock matters: it stops a long run from masquerading as a better
optimizer.

@cue(active.momentum = true) The blue path adds momentum. At first its
smoothing is weak, so it still inherits plenty of the wall-to-wall
motion. @cue(momentum.beta -> 0.6, over: 2s) Raise beta and recent
gradients are averaged together. Opposite vertical gradients cancel,
while gradients that keep pointing along the ravine accumulate.

@cue(active.adamw = true) The green path is AdamW. It tracks a running
scale for each coordinate, then divides by that scale. A consistently
large vertical gradient no longer gets to dominate the update just
because its units are larger.

@board(rules: $\begin{aligned}\text{SGD: }&\Delta w=-\eta g\\\text{Momentum: }&v=\beta v+(1-\beta)g\\&\Delta w=-\eta v\\\text{AdamW: }&a=m_t/(\sqrt{v_t}+\epsilon)\\&\Delta w=-\eta a-\eta\lambda w\end{aligned}$)
These are not three arbitrary recipes. Momentum is a temporal fix: it
smooths gradients across steps. AdamW is a coordinate-wise fix: it
rescales directions. The path shapes and the loss curves are their
update rules made visible.

@chapter(A different kind of hard)

Conditioning is not the only difficulty. @camera(roughnessView, over: 3s) @cue(kappa -> 1, roughness -> 0.28, step = 0, over: 3s)
I have rounded the bowl again, then added ripples along the route to the
minimum. This knob is independent of kappa: it adds local troughs
without squeezing the two coordinate scales apart.

@camera(pathView, over: 2.5s) @cue(step -> 60, over: 5s) Plain SGD settles into a ripple. The other
paths carry enough history or adaptive scaling to cross this particular
bump. That does not make either optimizer universally better. It shows
that a change designed for one failure mode can also change how the
optimizer behaves on another.

@chapter(The price of stability)

@camera(ravineView, over: 3s) Return to a smooth but harsher ravine. @cue(roughness -> 0, kappa -> 32, step = 0, over: 3s)
SGD still has exactly the learning rate it started with.
@camera(pathView, over: 2.5s) @cue(step -> 40, over: 4s) This time the orange path does not merely
zigzag. It grows until it leaves the map: divergence.

@pause(prompt: "Rescue SGD by lowering its learning rate, then move the matched-step slider forward. Notice what stability costs in speed along the flat direction.")

@chapter(What the controls were saying)

@board(stability: $\eta_{\mathrm{SGD}} < 2/\kappa$)
The threshold you found is this inequality. As the largest curvature
grows, SGD's maximum stable step shrinks. You can always make the step
smaller, but then every direction, including the flat one, must accept
that smaller step. Adaptive optimizers exist because real training
problems contain many directions with very different scales, and one
global learning rate has to satisfy all of them.

You have been watching only two coordinates. A large model has millions
or billions. The picture does not prove what will happen there, but it
gives us a useful question: which directions are setting the global
step size, and what is the optimizer doing to the rest?

@pause(prompt: "Keep exploring: drag the start puck, compare all three paths at one step, or combine conditioning and roughness to make a problem of your own.")
