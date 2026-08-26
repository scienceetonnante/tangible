---
title: Why adaptive optimizers exist
---

@scene(landscape)
@chapter(The easy bowl)
@camera(target: [0, 0.55, 0], distance: 6.2, azimuth: -35°, elevation: 42°)
@cue(step = 0)

@camera(azimuth: 135°, over: 10s, ease: linear)
This is an interactive lesson about optimizers.
You can move around the scene and adjust its controls while I am speaking. You can also pause the lesson to ask me a question in the chatbox below.

@camera(azimuth: -35°, over:10s, ease: linear)
Training a machine-learning model means adjusting its weights to reduce a loss function. Stochastic gradient descent, or SGD, is the basic approach. Modern adaptive optimizers such as Adam often train models more effectively. What do these methods change, and why can those changes help?

@camera(azimuth: 0°, over: 12s, ease: linear)
Let us examine a simple problem with only two weights.
The surface height represents the loss for every pair of weight values.
The white puck marks the pair of values where training starts.
We want the optimizer to reach the minimum at the center.

@camera(target: [0, 0.4, 0], distance: 7.4, azimuth: -8.59°, elevation: 69.9°, over: 2s) 
The orange trail will show ordinary gradient descent, the deterministic update at the core of SGD.
@cue(step -> 10, over: 5s) 
At each iteration, we compute the gradient and take a small step in the opposite direction. I have omitted minibatch noise so that the geometry remains easy to read.
@board(sgd: $\begin{aligned}\text{SGD: }\Delta w_t&=-\eta g_t\end{aligned}$)
The size of each step is controlled by the @cue(sgd.lr -> 0.02, over: 1s) learning rate, eta. @cue(sgd.lr -> 0.075, over: 1s) 
The curve below shows how the loss changes as we take more steps.
@cue(step -> 40, over: 4s) Step by step, gradient descent takes a clean route into the center.

@camera(target: [0, 0.65, 0], distance: 7, azimuth: -41.25°, elevation: 34°, over: 2.5s)
This first problem is easy because the surface has the same curvature in every direction.

@chapter(Conditioning)
@cue(step = 0, sgd.lr = 0.065) 
@camera(target: [0, 0.65, 0], distance: 6.8, azimuth: -77°, elevation: 24°, over: 5s) Now I will change the problem without touching the learning rate.
@cue(kappa -> 30, over: 8s) Suppose the loss changes much more sharply with one weight than with the other. The control kappa is the condition number: here, it is the ratio between the steep and shallow curvatures. As kappa rises, the round bowl becomes a narrow ravine and the problem becomes poorly conditioned.

@camera(target: [0, 0.4, 0], distance: 7.4, azimuth: 7°, elevation: 62°, over: 3s) Now watch the orange path.
@cue(step -> 30, over: 5s) Each step crosses the ravine, overshoots, crosses back, and only slowly makes progress along the floor.

@cue(sgd.lr -> 0.03, over: 3s) 
Lowering the learning rate restores stability, but @cue(step -> 50, over: 2s)  reaching the minimum now requires more steps.
If the learning rate is too high, @cue(sgd.lr -> 0.07, over: 3s) the oscillations grow until the path becomes unstable.

@pause(prompt: "Now try to find where SGD falls apart. Vary the condition number, kappa, and SGD's learning rate. Look for a relationship between kappa and the largest stable learning rate.
Press play when you are ready to continue.")

@chapter(Two different fixes)

@cue(problem -> [25, 0], start -> [-1.65, 1.15], step -> 25, active -> [true, false, false], sgd.lr -> 0.075, momentum.lr -> 0.10, momentum.beta = 0.3, adamw.lr -> 0.12, over: 2s) 
Let us return to the same ravine and compare every optimizer.
First, add momentum. @cue(active.momentum = true) The blue path smooths the wall-to-wall motion, and the parameter beta controls how much history the optimizer retains.
@board(momentum: $\begin{aligned}\text{Momentum: }u_t&=\beta u_{t-1}+(1-\beta)g_t\\\Delta w_t&=-\eta u_t\end{aligned}$)

@cue(momentum.beta -> 0.6, over: 4s) As beta rises, the optimizer averages gradients over a longer history. In this ravine, alternating gradients across the steep direction cancel, while gradients that point along the floor reinforce one another.

Now consider AdamW, a widely used variant of Adam. Adam stands for adaptive moment estimation, and AdamW adds decoupled weight decay.
@cue(active.adamw = true) The green path tracks running averages of the gradient and its square for each coordinate. It divides the first average by a scale derived from the second, so a direction does not dominate the update merely because its gradients are consistently larger.

@board(adamw: $\begin{aligned}m_t&\leftarrow\beta_1m_{t-1}+(1-\beta_1)g_t\\v_t&\leftarrow\beta_2v_{t-1}+(1-\beta_2)g_t^2\\\Delta w_t&=-\eta\frac{\hat m_t}{\sqrt{\hat v_t}+\epsilon}-\eta\lambda w_t\end{aligned}$)

Momentum mainly changes how gradients are combined across steps. AdamW also adapts the scale separately for each coordinate.

On this example, momentum and AdamW both help, but for different reasons. Momentum combines gradients across successive steps. AdamW also gives each coordinate its own   
scale, based on its recent gradients. One global learning rate may be too large for some coordinates and too small for others, so this coordinate-wise adaptation can make
optimization much easier.

This ravine is deliberately simple, and it is aligned with the coordinate axes. Real neural networks are much more complicated, and AdamW is not universally better. This
picture explains its mechanism, not a general ranking of optimizers.

@pause(prompt: "Keep exploring: drag the start puck, compare all three paths at one step, or combine conditioning and roughness to make a problem of your own.")
