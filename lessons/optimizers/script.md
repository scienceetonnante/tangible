---
title: Why adaptive optimizers exist
---

@scene(landscape)
@chapter(The easy bowl)
@camera(target: [0, 0.55, 0], distance: 6.2, azimuth: -35°, elevation: 42°)
@cue(step = 20, active = [true, false, false])

@camera(azimuth: 125°, over:10s, ease: linear)
Training a machine-learning model requires minimizing a loss function.  
@cue(step = 20, active -> [true, false, true])
While stochastic gradient descent, or SGD, is the basic method for this, an algorithm like Adam  usually works more effectively. 
How are they different?

@camera(azimuth: -35°, over: 1s)
@cue(step = 0, active = [false , false, false])
This surface represents a simple loss function for only two weights. 
The white puck is the starting point. Try changing the point of view while I'm speaking.     

@camera(target: [0, 0.4, 0], distance: 7.4, azimuth: -8.59°, elevation: 69.9°, over: 2s) 
@cue(active = [true , false, false])
@cue(step -> 10, over: 5s)
This orange trail shows the trajectory of ordinary gradient descent.
With SGD, at each iteration, we compute the gradient and take a small step in the opposite direction.
@board(sgd: $\begin{aligned}\text{SGD: }\\ \Delta w_t&=-\eta g_t\end{aligned}$)
@cue(step -> 12, over: 1 s)
I have omitted minibatch noise so that the geometry remains easy to read.
The size of each step is controlled by the @cue(sgd.lr -> 0.02, over: 1s) learning rate, eta. @cue(sgd.lr -> 0.075, over: 1s) 
The curve below shows how the loss changes as we take more steps.
@cue(step -> 40, over: 4s) Step by step, gradient descent takes a clean route into the center.

@camera(target: [0, 0.65, 0], distance: 7, azimuth: -41.25°, elevation: 34°, over: 2.5s)
That first situation is easy because the surface has the same curvature in every direction.

@chapter(Conditioning)
@cue(step = 0, sgd.lr = 0.065) 
@camera(target: [0, 0.65, 0], distance: 6.8, azimuth: -77°, elevation: 24°, over: 5s) Now I will change the problem without touching the learning rate.
@cue(kappa -> 30, over: 8s) Suppose the loss changes much more sharply with one weight than with the other. The control kappa is the condition number: here, it is the ratio between the steep and shallow curvatures. As kappa rises, the round bowl becomes a narrow ravine and the problem becomes poorly conditioned.

@camera(target: [0, 0.4, 0], distance: 7.4, azimuth: 7°, elevation: 62°, over: 3s) Now watch the orange path.
@cue(step -> 30, over: 5s) Each step crosses the ravine, overshoots, crosses back, and only slowly makes progress along the floor.

@cue(sgd.lr -> 0.02, over: 3s) 
Lowering the learning rate restores stability, but @cue(step -> 60, over: 2s)  reaching the minimum now requires more steps.
If the learning rate is too high, @cue(sgd.lr -> 0.07, over: 3s) the oscillations grow until the path becomes unstable.

@pause(prompt: "Now try to find where SGD falls apart. Vary the condition number, kappa, and SGD's learning rate. Look for a relationship between kappa and the largest stable learning rate.
Press play when you are ready to continue.")

@chapter(Two different fixes)

@cue(kappa -> 25, start -> [-1.65, 1.15], step -> 40, active -> [true, false, false], sgd.lr -> 0.075, momentum.lr -> 0.075, momentum.beta = 0.05, adamw.lr -> 0.075, over: 2s)
Let us return to the same ravine and compare every optimizer.
@camera(target: [0, 0.4, 0], distance: 7, azimuth: 32°, elevation: 60°, over: 5s)
First, add momentum. @cue(active.momentum = true) The blue path smooths the wall-to-wall motion, and the parameter beta controls how much history the optimizer retains.
@board(momentum: $\begin{aligned}\text{Momentum: }\\ u_t&=\beta u_{t-1}+(1-\beta)g_t\\\Delta w_t&=-\eta u_t\end{aligned}$)

@cue(momentum.beta -> 0.65, over: 4s) As beta rises, the optimizer averages gradients over a longer history. In this ravine, alternating gradients across the steep direction cancel, while gradients that point along the floor reinforce one another.

@camera(target: [0, 0.4, 0], distance: 7.4, azimuth: 20°, elevation: 64°, over: 6s)
Now consider AdamW, a widely used variant of Adam. Adam stands for adaptive moment estimation, and AdamW adds decoupled weight decay.
@cue(active.adamw = true) The green path tracks running averages of the gradient and its square for each coordinate. 

@board(adamw: $\begin{aligned}\text{AdamW: }\\ m_t&\leftarrow\beta_1m_{t-1}+(1-\beta_1)g_t\\v_t&\leftarrow\beta_2v_{t-1}+(1-\beta_2)g_t^2\\\Delta w_t&=-\eta\frac{\hat m_t}{\sqrt{\hat v_t}+\epsilon}-\eta\lambda w_t\end{aligned}$)
It divides the first average by a scale derived from the second, so a direction does not dominate the update merely because its gradients are consistently larger.

Momentum mainly changes how gradients are combined across steps. AdamW also adapts the scale separately for each coordinate. One global learning rate may be too large for some coordinates and too small for others, so this coordinate-wise adaptation can make
optimization much easier.

However, this ravine is deliberately simple. Real neural networks are much more complicated, and AdamW is not universally better. 

@pause(prompt: "Keep exploring: drag the start puck, change the condition number, or compare all three paths at the same step.")
