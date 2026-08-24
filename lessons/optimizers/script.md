---
title: Why adaptive optimizers exist
---

@scene(landscape)
@chapter(The easy bowl)
@camera(pathView)

This is an interactive lesson about optimizers. Feel free to navigate into the scene, or control it while I’m speaking. You can also pause to ask me a question.

In machine learning, training happens by optimizing the weights in order to minimize a certain loss function. The original algorithm is stochastic gradient descent, but several optimizers have since been proposed to improve training. What is the difference between vanilla gradient descent and a modern algorithm like Adam, that is widely used today.

[[Rotate around the camera in a 360° way to show the surface]]
Let’s try to understand this in a simple 2D setting. Here we represent a simple loss surface, as if they were only two weights. Let’s suppose our training starts at the position of white puck. We are trying to reach the minimum, here in the center.

[[slowly increase the number of steps to reveal the path]]
The orange trail is the trajectory for plain gradient descent. At each iteration, we compute the gradient and take a small step in the opposite direction.
@board(rules: $\begin{aligned}\text{SGD: }&\Delta w=-\eta g$)
The size of the step is controlled by the learning rate.
[[Briefly move learning rate back and forth]]
The curve below shows you the evolution of the loss as we take more steps. @camera(pathView, over: 2.5s) @cue(step -> 60, over: 4s) Step by step, SGD takes a clean route into the center.

@camera(roundBowlView, over: 2.5s)
Now this is easy because in this very simple surface, every direction has the same curvature.

@chapter(Conditioning)
[[bring back steps to zero]]
@camera(ravineView, over: 3s) Now I will change the problem without touching the learning rate. Let’s assume that one weight as way more impact on the loss than the other.
@cue(step = 0, kappa -> 24, over: 4s) This situation is obtained by raising the parameter kappa, which controls the ratio of curvature along the two directions. It is called conditioning. As kappa rises, the bowl becomes a narrow ravine.

@camera(pathView, over: 1.5s)
[[slowly increase the steps]]
@cue(step -> 50, over: 5s) Now watch the orange path. Each step crosses the ravine, overshoots, crosses back, and only slowly makes progress along the floor.

One solution is to lower the learning rate, but reaching the minimum then requires more steps. [[increase steps]]
And if the learning rate is set too high, not only do we get big oscillations, but the path can even become unstable.

@pause(prompt: "Now try to find where SGD falls apart. Experiment with different condition number kappa, and different learning rates. You should be able to see a relationship between kappa and the maximum possible learning rate.")

@chapter(Two different fixes)

@cue(kappa -> 24, step -> 18, over: 2s) Let’s try to fix this behavior with a new algorithm that adds momentum. @cue(active.momentum = true) This is the blue path here. Momentum smoothes the behavior and you can control its amount with parameter beta.
@board(rules: $\text{Momentum: }&v=\beta v+(1-\beta)g\\&\Delta w=-\eta v$)

@cue(momentum.beta -> 0.6, over: 2s) The more you raise beta, the more recent gradients are averaged together. In our ravine case, it means opposite vertical gradients cancel, while horizontal gradients accumulate, so the smoothed gradient points along the ravine.

Let’s now add one more ingredient, and consider Adam, which means Adaptative Moments.
@cue(active.adamw = true) This algorithm tracks a running
scale for each coordinate, then divides by that scale. Since each weight is rescaled, it prevents weights with large units from taking over the gradient.

@board(rules: $\text{AdamW: }&a=m_t/(\sqrt{v_t}+\epsilon)\\&\Delta w=-\eta a$)

@chapter(A different kind of hard)
Conditioning is not the only difficulty for optimizers. @camera(roughnessView, over: 3s) @cue(kappa -> 1, roughness -> 0.28, step = 0, over: 3s)
I have rounded the bowl again, and added noisy ripples along the route to the minimum. You can control the form of the loss function with this second parameter.

@camera(pathView, over: 2.5s) @cue(step -> 60, over: 5s) As you can see plain gradient descent settles into a ripple. While the other paths can carry enough history or adaptive scaling to cross this particular bump. That does not make either optimizer universally better. It shows that a change designed for one failure mode can also change how the optimizer behaves on another.

Adaptive optimizers exist because real training problems contain many directions with very different scales, and one global learning rate has to satisfy all of them.

You have been watching only two coordinates. A large model has millions or billions. The picture does not prove what will happen there, but it gives us a useful question: which directions are setting the global step size, and what is the optimizer doing to the rest?

@pause(prompt: "Keep exploring: drag the start puck, compare all three paths at one step, or combine conditioning and roughness to make a problem of your own.")