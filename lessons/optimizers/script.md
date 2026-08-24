---
title: Why adaptive optimizers exist
---

@scene(landscape)
@chapter(The easy bowl)
@camera(spinBaseView)
@cue(step = 0)

This is an interactive lesson about optimizers. You can move around the scene and adjust its controls while I am speaking. You can also pause the lesson to ask me a question.

Training a machine-learning model means adjusting its weights to reduce a loss function. Stochastic gradient descent, or SGD, is the basic approach. Modern adaptive optimizers such as Adam often train models more effectively. What do these methods change, and why can those changes help?

@camera(spinQuarterView, over: 1.8s) Let us examine a simple problem with only two weights.
@camera(spinHalfView, over: 1.8s) The surface height represents the loss for every pair of weight values.
@camera(spinThreeQuarterView, over: 1.8s) The white puck marks the pair of values where training starts.
@camera(spinFullView, over: 1.8s) We want the optimizer to reach the minimum at the center.

@camera(pathView, over: 2s) The orange trail will show ordinary gradient descent, the deterministic update at the core of SGD.
@cue(step -> 36, over: 5s) At each iteration, we compute the gradient and take a small step in the opposite direction. I have omitted minibatch noise so that the geometry remains easy to read.
@board(sgd: $\begin{aligned}\text{SGD: }\Delta w_t&=-\eta g_t\end{aligned}$)
The size of each step is controlled by the @cue(sgd.lr -> 0.105, over: 1s) learning rate, eta. @cue(sgd.lr -> 0.075, over: 1s) The curve below shows how the loss changes as we take more steps.
@cue(step -> 60, over: 4s) Step by step, gradient descent takes a clean route into the center.

@camera(roundBowlView, over: 2.5s)
This first problem is easy because the surface has the same curvature in every direction.

@chapter(Conditioning)
@cue(step = 0, sgd.lr = 0.075)
@camera(ravineView, over: 3s) Now I will change the problem without touching the learning rate.
@cue(kappa -> 24, over: 4s) Suppose the loss changes much more sharply with one weight than with the other. The control kappa is the condition number: here, it is the ratio between the steep and shallow curvatures. As kappa rises, the round bowl becomes a narrow ravine and the problem becomes poorly conditioned.

@camera(pathView, over: 1.5s) Now watch the orange path.
@cue(step -> 50, over: 5s) Each step crosses the ravine, overshoots, crosses back, and only slowly makes progress along the floor.

@cue(step = 0, sgd.lr -> 0.04, over: 1.5s) Lowering the learning rate restores stability, @cue(step -> 60, over: 2s) but reaching the minimum now requires more steps.
@cue(step = 0, sgd.lr -> 0.11, over: 1.5s) If the learning rate is too high, @cue(step -> 30, over: 3s) the oscillations grow until the path becomes unstable.

@pause(prompt: "Now try to find where SGD falls apart. Vary the condition number, kappa, and SGD's learning rate. Look for a relationship between kappa and the largest stable learning rate.")

@chapter(Two different fixes)

@clear(sgd)
@cue(problem -> [24, 0], start -> [-1.65, 1.15], step -> 18, active -> [true, false, false], sgd.lr -> 0.075, momentum.lr -> 0.15, momentum.beta = 0.3, adamw.lr -> 0.1, over: 2s) Let us return to the same ravine and compare every optimizer at step eighteen.
@cue(active.momentum = true) First, add momentum. The blue path smooths the wall-to-wall motion, and the parameter beta controls how much history the optimizer retains.
@board(momentum: $\begin{aligned}\text{Momentum: }u_t&=\beta u_{t-1}+(1-\beta)g_t\\\Delta w_t&=-\eta u_t\end{aligned}$)

@cue(momentum.beta -> 0.6, over: 2s) As beta rises, the optimizer averages gradients over a longer history. In this ravine, alternating gradients across the steep direction cancel, while gradients that point along the floor reinforce one another.

Now consider AdamW, a widely used variant of Adam. Adam stands for adaptive moment estimation, and AdamW adds decoupled weight decay.
@cue(active.adamw = true) The green path tracks running averages of the gradient and its square for each coordinate. It divides the first average by a scale derived from the second, so a direction does not dominate the update merely because its gradients are consistently larger.

@clear(momentum)
@board(adamw: $\begin{aligned}m_t&\leftarrow\beta_1m_{t-1}+(1-\beta_1)g_t\\v_t&\leftarrow\beta_2v_{t-1}+(1-\beta_2)g_t^2\\\Delta w_t&=-\eta\frac{\hat m_t}{\sqrt{\hat v_t}+\epsilon}-\eta\lambda w_t\end{aligned}$)

Momentum mainly changes how gradients are combined across steps. AdamW also adapts the scale separately for each coordinate.

@chapter(A different kind of hard)
@clear(adamw)

Conditioning is not the only difficulty for optimizers. @cue(kappa -> 1, roughness = 0, step = 0, over: 2s) First, I make the bowl round again.
@camera(roughnessView, over: 2.5s) Now look from a lower angle.
@cue(roughness -> 0.28, over: 3s) I add regular ripples along the route to the minimum. The roughness control changes their amplitude independently of kappa.

@camera(pathView, over: 2s) Now return to the path view.
@cue(step -> 60, over: 5s) Plain gradient descent settles into a local trough. The other paths carry enough history or adaptive scaling to cross this particular bump. These settings do not make either optimizer universally better. They show that a change designed for one failure mode can also affect behavior on another.

Adaptive optimizers exist because real training problems contain many directions with very different curvature and gradient scales, while one global learning rate has to satisfy all of them.

You have been watching only two coordinates. A large model has millions or billions of them. This picture cannot prove what will happen there, but it suggests a useful question: which directions are setting the global step size, and what is the optimizer doing to the rest?

@pause(prompt: "Keep exploring: drag the start puck, compare all three paths at one step, or combine conditioning and roughness to make a problem of your own.")
