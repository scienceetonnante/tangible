---
title: Why adaptive optimizers exist
---

@scene(landscape)
@chapter(The easy bowl)
@camera(pathView)
@cue(step = 0)

The square on the left is a map of a loss surface. Darker means higher
loss; the pale center is the minimum. The white puck marks the shared
starting point. The orange path will trace ordinary gradient descent,
the deterministic core of SGD. I have removed minibatch noise so that
the geometry stays easy to read. The plot below will show its loss in
the same color.

@camera(roundBowlView, over: 2.5s) On this round bowl, every direction has the same curvature.
@camera(pathView, over: 1.8s) Back in the map view, @cue(step -> 60, over: 4s) watch SGD take a
clean route into the center. Nothing about this problem asks the
optimizer to treat one direction differently from another.

@chapter(Conditioning)

@camera(ravineView, over: 3s) Now I will change the problem without touching SGD's learning rate.
@cue(step = 0, kappa -> 24, over: 4s) As the condition number, kappa, rises, the bowl becomes
a narrow ravine. @camera(pathView, over: 1.5s) In the map view, the bands squeeze together
vertically. The vertical direction is now much steeper than the
horizontal direction.

@cue(step -> 50, over: 5s) Watch the orange path. Each step crosses the
ravine, overshoots, crosses back, and only slowly makes progress along
the floor. The learning rate that looked sensible on the round bowl is
now close to its stability limit.

@pause(prompt: "Find where SGD falls apart. Drag the condition slider upward while leaving its learning rate fixed, and use the matched-step slider to inspect the path.")

@chapter(Two different fixes)

@cue(problem -> [24, 0], start -> [-1.65, 1.15], step -> 18, active -> [true, false, false], sgd.lr -> 0.075, momentum.lr -> 0.15, momentum.beta = 0.3, adamw.lr -> 0.1, over: 2s)
Bring the problem back near SGD's stability limit and freeze the
comparison at step eighteen. That shared clock matters: it prevents a
longer run from masquerading as a better optimizer.

@cue(active.momentum = true) The blue path adds momentum. At first its
smoothing is weak, so the path retains much of the wall-to-wall motion.
@cue(momentum.beta -> 0.6, over: 2s) Raise the smoothing parameter, beta, and the optimizer averages gradients
over more steps. Opposite vertical gradients cancel, while gradients
that keep pointing along the ravine reinforce one another.

@cue(active.adamw = true) The green path is AdamW. It tracks a running
average and scale for each coordinate, then divides the average by the
scale. A consistently large vertical gradient no longer dominates the
update merely because that direction is steeper.

@board(rules: $\begin{aligned}\text{SGD: }&\Delta w_t=-\eta g_t\\\text{Momentum: }&u_t=\beta u_{t-1}+(1-\beta)g_t\\&\Delta w_t=-\eta u_t\\\text{AdamW: }&a_t=\hat m_t/(\sqrt{\hat v_t}+\epsilon)\\&\Delta w_t=-\eta a_t-\eta\lambda w_t\end{aligned}$)
These are not three arbitrary recipes. Momentum is a temporal fix: it
smooths gradients across steps. AdamW is a coordinate-wise fix: it
rescales directions. The path shapes and the loss curves are their
update rules made visible.

@chapter(A different kind of hard)
@clear(rules)

Conditioning is not the only difficulty. @cue(kappa -> 1, roughness = 0, step = 0, over: 2s)
First, I make the bowl round again. @camera(roughnessView, over: 2.5s) From this lower angle,
@cue(roughness -> 0.28, over: 3s) I add ripples along the route to the minimum. The roughness control is
independent of kappa. It creates local troughs without turning the bowl
into the same narrow ravine.

@camera(pathView, over: 1.8s) Back in the map view, @cue(step -> 60, over: 5s) plain SGD settles
into a local trough. The other paths carry enough momentum or adaptive
scaling to cross this particular bump. These settings do not make
either optimizer universally better. They show that a change designed
for one failure mode can also affect behavior on another.

@chapter(The price of stability)

@cue(roughness -> 0, step = 0, over: 2s) First, remove the ripples.
@camera(ravineView, over: 2.5s) Then @cue(kappa -> 32, over: 3s) make the smooth ravine even sharper.
SGD still has exactly the learning rate it started with.
@camera(pathView, over: 1.8s) Back in the map view, @cue(step -> 10, over: 4s) the orange path no
longer merely zigzags. It grows until it leaves the map. It diverges.

@pause(prompt: "Rescue SGD by lowering its learning rate, then advance the matched-step slider. Notice what stability costs in speed along the flat direction.")

@chapter(What the controls were saying)

@board(stability: $\eta_{\mathrm{SGD}} < 2/\kappa$)
For this smooth quadratic, the threshold you found is this inequality.
As the largest curvature grows, SGD's maximum stable learning rate
shrinks. A smaller learning rate restores stability, but it also slows
progress along the flat direction. Real training problems can contain
many directions with very different scales, while one global learning
rate has to satisfy all of them. Coordinate-wise adaptive optimizers
address this problem by giving different directions different effective
step sizes.

You have been watching only two coordinates. A large model has millions
or billions. The picture does not prove what will happen there, but it
gives us a useful question: which directions are setting the global
step size, and what is the optimizer doing to the rest?

@pause(prompt: "Keep exploring: drag the start puck, compare all three paths at one step, or combine conditioning and roughness to make a problem of your own.")
