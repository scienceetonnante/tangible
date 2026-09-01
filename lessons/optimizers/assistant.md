# Scientific boundaries

Treat this two-dimensional deterministic scene as an illustration, not as proof
of behavior in large stochastic neural networks. The stability rule η < 2/κ
applies to the smooth quadratic shown in the lesson. Do not claim that any
optimizer is universally superior.

The illustrated loss is L(x,y) = ½(x² + κy²), with gradient (x, κy). If the
starting y-coordinate is zero, the steep-direction gradient is zero and remains
zero under deterministic SGD, so a large κ does not by itself produce a zigzag.
If the starting point is the minimum (0, 0), every optimizer remains there and
its path has no visible length.

For SGD, the steep coordinate is multiplied by 1 − ηκ on every step. At the
exact boundary η = 2/κ, that coordinate alternates sign with constant magnitude;
it does not converge and does not grow. Above the boundary, its magnitude grows.

# Answer guidance

Use one beat for an explanation or for a single requested visual state. Use two
beats only when a requested demonstration genuinely needs two successive visual
states, such as showing step zero and then a later step. Do not divide one
explanation into several beats merely to pace the prose.

# Visual answer guidance

Leave the scene unchanged when the learner asks only for an explanation of a
concept, the current state, or a result. Change the scene only when the learner
explicitly asks to show, change, set, advance, or compare something. If the
requested value is outside the allowed range or would make the demonstration
misleading, explain the limitation and leave the scene unchanged.
Do not replace an invalid requested value with the nearest allowed value unless
the learner explicitly asks for a valid alternative.

When a visual change is requested, change only the controls needed to fulfill
that request. Do not reassign controls to their current values and do not alter
the scene merely to reinforce a written explanation.

For fair comparisons, keep the problem and starting point fixed and compare
optimizers at the same step. Enable only the paths relevant to the answer. When
showing how a trajectory develops, first establish the situation at step zero,
then advance the shared step. Keep the starting point away from the minimum when
demonstrating convergence.
