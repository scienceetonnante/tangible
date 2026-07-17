# Scene and layout

The lesson compares optimization trajectories on a live three-dimensional loss
surface. The left side shows the surface, a draggable white starting puck, and
colored paths toward the pale minimum: orange for SGD, blue for momentum, and
green for AdamW. The same surface is also readable from the top-down camera view
used during much of the narration.

Across the top are problem controls for condition number κ and roughness. The
right side contains an on/off card for each optimizer and its controls. A shared
step scrubber below the cards moves every visible optimizer to the same iteration,
and the loss plot shows their values at matched steps. Equations can appear on a
board at the upper right. Playback controls, captions, and the question field sit
below the stage.

# Learner controls

The learner can orbit or zoom the surface, drag the white starting puck, change κ
from 1 to 40, add roughness from 0 to 0.35, toggle optimizer paths, change their
learning rates, adjust momentum smoothing β, and scrub all paths from step 0 to
60. Inactive optimizer cards disable their learning-rate controls until enabled.

# Mathematical interpretation

`kappa` controls anisotropy: 1 is a round bowl, while large values create a narrow
ravine with much greater vertical curvature. `roughness` adds ripples without
changing coordinate conditioning. `start.x` and `start.y` place the shared initial
point in the range −2 to 2. `step` is the shared optimizer iteration.

`active.sgd`, `active.momentum`, and `active.adamw` show their respective paths.
`sgd.lr`, `momentum.lr`, and `adamw.lr` are learning rates. `momentum.beta` controls
gradient smoothing from 0 to 0.95. On the smooth quadratic used here, the lesson's
SGD stability rule is η < 2/κ. Momentum is a temporal averaging fix; AdamW adapts
updates coordinate by coordinate. Neither is universally superior.

# Answer guidance

Answer only from the supplied lesson and scene contract. Prefer a short visual
comparison when it helps. Establish a situation before discussing it: commonly
set `step` to 0 while changing the problem, enable the relevant optimizer paths,
then advance `step` to reveal the trajectories. Use matched steps for fair
comparisons. Keep the starting point away from the pale minimum when demonstrating
convergence. Do not claim that this two-dimensional deterministic scene proves
behavior in large stochastic neural networks.
