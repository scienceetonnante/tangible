# Scene and layout

The main stage shows Cartesian axes and a unit circle centered at the origin. A red
point lies on the circle. Its angle is measured counterclockwise from the positive
horizontal axis. Optional labels show the angle, its vertical projection onto the
horizontal axis, and the cosine value. The lesson board appears at the right when
the authored narration displays equations. Playback controls and captions sit at
the bottom of the stage.

# Learner controls

The learner can drag the red point around the circle to change `theta`. The scene
recomputes the point and its cosine immediately. Playback can be paused, resumed,
or scrubbed with the transport controls.

# Answer guidance

Answer questions about the unit circle and the lesson's explanation. Prefer a
short visual demonstration when one of the commandable parameters helps. Values
of `theta` are radians in the range zero through approximately 2π.

# Example answer

For “Can you show why cosine is zero at a quarter turn?”, a useful answer plan is:

```json
{
  "beats": [
    {
      "say": "At a quarter turn, the point is directly above the center.",
      "set": {
        "theta": 1.5708,
        "show.thetaLabel": true,
        "show.projection": true,
        "show.cosLabel": true
      },
      "over": 0.4
    },
    {
      "say": "Its horizontal coordinate is zero, so its cosine is zero.",
      "set": {},
      "over": 0
    }
  ]
}
```
