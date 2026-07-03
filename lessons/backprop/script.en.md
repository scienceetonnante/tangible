---
title: Backpropagation
language: en
---

@scene(net)
@chapter(A tiny network)

This is about as small as a neural network gets. Two inputs on the
left, feeding two hidden neurons in the middle, which combine into a
single output on the right. Every arrow carries a weight — a number
that scales the signal passing along it. Those six weights are the only
things the network gets to learn.

@chapter(The forward pass)

To use the network, we push the inputs through it. @cue(forward -> 1, over: 3.5s)
Each hidden neuron adds up its incoming signals, squashes the total
with a smooth function, and passes it on. The output neuron does the
same, and out the right-hand side comes a prediction we call y-hat.

But how good is that prediction? @show(loss) We compare it against a
target, and measure the gap with a loss. @board(loss: $L = \tfrac12(\hat y - t)^2$)
Right now that loss is large: the network is wrong.

@chapter(The learning question)

So here is the question backpropagation has to answer. For each of the
six weights, which way should we nudge it, and how hard, to make the
loss go down? What we want is the gradient of the loss with respect to
every weight.

@chapter(The backward pass)

The trick is to work backwards. @cue(backward -> 1, over: 4s) Starting
from the loss, we ask how much the output was to blame, then pass that
blame back through the network, edge by edge, all the way to the inputs.

Each weight's share of the blame is a product of local slopes, chained
together. @board(chain: $\frac{\partial L}{\partial w_{11}} = \htmlClass{a}{\frac{\partial L}{\partial \hat y}}\,\htmlClass{b}{\frac{\partial \hat y}{\partial h_1}}\,\htmlClass{c}{\frac{\partial h_1}{\partial z_1}}\,\htmlClass{d}{\frac{\partial z_1}{\partial w_{11}}}$)
Take the weight from the first input to the first hidden neuron. Its
gradient is @highlight(chain.a) how the loss depends on the output,
@highlight(chain.b) times how the output depends on that hidden neuron,
@highlight(chain.c) times how the neuron responds to its own input,
@highlight(chain.d) times how that input depends on the weight. That
chain of multiplications is the chain rule, and it is the whole idea.

@chapter(One step of learning)

Now we know which way is downhill for every weight. @dim(chain) @cue(backward -> 0, over: 1s)
So we take a small step: each weight moves against its gradient, scaled
by a learning rate. @board(update: $w \leftarrow w - \eta\,\frac{\partial L}{\partial w}$)

@cue(weights -> [0.74, -0.28, -0.517, 0.692, 0.727, -0.456], over: 2s)
Watch the loss. As the weights shift, the prediction climbs toward the
target and the loss falls.

And we can simply do it again, @cue(weights -> [0.878, -0.211, -0.635, 0.633, 0.87, -0.501], over: 1.2s)
and the loss drops further. One more time, @cue(weights -> [0.949, -0.176, -0.698, 0.601, 0.962, -0.545], over: 1.2s)
and each step nudges the network a little closer to getting this
example right. That, in the end, is all that training is: forward,
backward, step, and repeat.

@chapter(Your turn)

@pause(prompt: "Drag any weight up or down to change it, or move the learning-rate slider. The forward pass and the loss recompute instantly.")
