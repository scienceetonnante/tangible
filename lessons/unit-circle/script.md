---
title: The unit circle
---

@scene(circle)
@chapter(The circle and the angle)

Here is a circle of radius one. The red point is located by an angle
we call @cue(show.thetaLabel = true) theta. Watch what happens when we
let it @cue(theta -> 6.2832, over: 4s, ease: inOutCubic) vary: the
point goes all the way around the circle.

@show(projection) Now let's project this point onto the horizontal axis.
The length we get is @cue(show.cosLabel = true) the cosine of theta.
@board(cosdef: $x = \cos\theta$)

@pause(prompt: "Drag the red point yourself and watch the cosine.")

@cue(theta -> 1.5708, over: 2s) Let's continue. At ninety degrees, the
cosine is zero.
