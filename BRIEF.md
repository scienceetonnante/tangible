# Designing a Narrated Explorable Lesson


## The medium in one minute

A narrated explorable is a short guided lesson whose visual world remains
interactive.

The learner hears an explanation while a diagram, model, graph, equation, or
spatial scene changes in synchrony with the narration. At any moment, the learner
can reach into the explanation: drag a point, change a quantity, alter a vector,
rotate a view, choose a case, or rearrange a structure. The model responds
immediately and all related representations can update together.

The narration provides a deliberate path through the idea, but the learner is not
confined to the examples chosen by the narrator. After an intervention, the lesson
can smoothly return to the narrated example. It can also stop at explicit
checkpoints and ask the learner to predict, manipulate, compare, or explain before
continuing.

Depending on the topic, a lesson may combine:

- a manipulable 2D or 3D representation;
- graphs, diagrams, symbols, and numerical values that update together;
- persistent equations or short written statements;
- highlighted features that direct attention during the narration;
- chapter navigation, replay, captions, and translated versions; and
- pauses that invite a specific act of exploration.

Think of it less as a video with buttons and more as **a scientific model that the
learner can reach into while a narrator guides their attention**.

## The central design question

The most productive starting question is:

> What should the learner be able to change, and what important relationship
> should become visible as a result?

The answer should concern the concept itself. “The learner can click for more
information” is interaction, but it does not make the scientific relationship more
intelligible. “The learner changes the angle and sees the point, its projections,
the trigonometric values, and the graph move together” does.

## What makes a concept a strong fit?

A strong topic usually has several of the following qualities.

### The insight lies in a relationship

The learner needs to understand how one quantity, structure, representation, or
view depends on another. A single worked example hides this relationship; varying
the situation reveals its shape.

Useful starting sentences include:

- “As **X** changes, what happens to **Y**?”
- “How can the same object be understood in these different representations?”
- “Which features remain invariant when the system is transformed?”
- “Under what conditions does the behaviour change qualitatively?”
- “How does a local change propagate through the whole system?”

### Learner actions have conceptual meaning

The learner should manipulate something that an expert would recognize as part of
the model: a parameter, initial condition, point, vector, expression, assumption,
viewpoint, or structural choice. The action should test an idea rather than merely
reveal the next piece of content.

### Unscripted states are informative

The learner will try values and combinations the narrator did not demonstrate.
Those “off-path” states should still teach something: continuity, a boundary case,
an exception, an invariant, a surprising reversal, or the limits of a claim.

### Several representations can be connected

The medium is especially valuable when an action in one representation immediately
changes another: geometry and algebra, microscopic and macroscopic views, a system
and its graph, a formula and its sampled outcomes, or an input and the stages of a
computation.

### Guidance still matters

The topic should benefit from a particular explanatory order. A completely open
sandbox can overwhelm a novice; narration can establish vocabulary, focus
attention, pose a question, model one comparison, and then hand control to the
learner.

## Promising patterns

The following patterns often make good narrated explorables. They are prompts, not
a list of prescribed subjects.

- **Continuous variation:** sweep a quantity through a range and observe coupled
  changes, turning points, limits, or thresholds.
- **Linked representations:** manipulate one view while graphs, equations,
  diagrams, or other views update with it.
- **Spatial reasoning:** rotate, project, slice, unfold, or change viewpoint to make
  a three-dimensional relationship intelligible.
- **Transformation and invariance:** change a system while drawing attention to
  what changes and what remains fixed.
- **Competing effects:** adjust factors that pull an outcome in different
  directions and find where one begins to dominate.
- **Local-to-global behaviour:** make a small change and trace its consequences
  through a larger system.
- **Boundary and limiting cases:** move deliberately toward zero, infinity, a
  symmetry point, instability, saturation, or another revealing edge case.
- **Stepwise processes:** move through successive updates in an algorithm,
  inference, reaction, or model and inspect the state after each step.
- **Counterfactuals:** change an assumption or premise and see which conclusions
  survive.

## Examples across disciplines

These examples illustrate the level at which to brainstorm. They are not lesson
specifications.

| Area | Learner changes | Learner observes | Possible guiding question |
|---|---|---|---|
| Trigonometry | An angle on the unit circle | The point, projections, values, and graphs move together | Why do sine and cosine have their particular shapes? |
| Calculus | A point or interval on a curve | Secant, tangent, slope, area, and corresponding graphs | How does a limiting process produce a derivative or integral? |
| Linear algebra | A vector or transformation | Coordinates, basis components, grids, and invariant directions | What does a matrix do geometrically? |
| Probability | A distribution parameter, prior, or observation | Shape, samples, likelihoods, and updated probabilities | How does new evidence change what should be believed? |
| Mechanics | Initial velocity, force, mass, or angle | Motion, vectors, component graphs, energy, and limiting cases | Which aspects of the motion are coupled, and which are independent? |
| Waves and optics | Frequency, phase, source spacing, lens, or object position | Superposition, rays, image formation, and graphs | When do separate contributions reinforce, cancel, or change regime? |
| Chemistry | Concentration, temperature, or a reaction condition | Particle-level and macroscopic representations change together | What does equilibrium mean dynamically rather than statically? |
| Biology | Substrate, inhibitor, population, or regulatory input | Mechanism, rate curve, saturation, or system response | Where does proportional response end, and why? |
| Machine learning | An input, weight, threshold, or update step | Prediction, loss, gradients, and the next model state | How does changing one part affect the network and its learning? |

## When another medium is probably better

This format is not automatically better because a topic can be animated. Prefer a
diagram, text, ordinary video, exercise set, physical practical, or open simulation
when:

- the objective is mainly recall of facts, terminology, or a fixed sequence;
- one well-designed figure or one author-chosen animation already carries the idea;
- learner interaction would be limited to clicking “next” or revealing labels;
- only the narrator's chosen path is meaningful and nearby states add noise;
- the main learning goal is extended calculation practice or formal proof;
- authentic measurement, experimental technique, collaboration, or uncertainty is
  the essential experience; or
- the proposed model is so broad that learners would not know what to attend to.

A useful negative test is: **if the interaction were removed, would the central
insight remain essentially unchanged?** If so, interactivity is probably
decoration.

## Principles for the pedagogical design

### Begin with a conceptual obstacle, not a chapter title

“Electromagnetism” is too broad. “Why a charged particle can curve even when its
speed does not change” points to a relationship, a likely misconception, and
something the learner could manipulate.

Identify what learners currently say, draw, predict, or calculate incorrectly. The
lesson should be designed around a change in understanding, not coverage of a
syllabus section.

### Give the learner one clear handle

Start with one primary action and, at most, a small number of supporting controls.
The learner should quickly understand what can be changed and why they might change
it. More controls do not necessarily create more agency; they often obscure the
question.

### Ask for a prediction before exploration

A prompt such as “What will happen to the image if the object crosses the focal
point?” gives the manipulation a purpose. Prediction makes the learner compare a
mental model with the system's response.

### Use narration to direct attention, not describe every movement

The voice should pose questions, explain significance, and connect observations.
It need not say aloud everything already obvious on screen. Visual changes and
narration should complement one another.

### Build understanding through contrast

Choose comparisons that expose structure: before and after, small and large,
aligned and misaligned, stable and unstable, typical and limiting, correct
prediction and counterexample.

### Connect intuition to formalism

Let learners first notice a pattern, then name or formalize it. Equations and
definitions can remain visible while the model moves, so symbols acquire meaning
through the behaviour they describe.

### End with explanation or transfer

Manipulation alone does not demonstrate understanding. Ask learners to explain the
relationship, predict an unshown case, choose between models, or apply the idea in
a new context.

## A simple narrated arc

As a starting point, design one short lesson around a single conceptual knot rather
than a whole unit.

1. **Orient:** establish the phenomenon, question, and essential parts of the
   representation.
2. **Show a baseline:** narrate one carefully chosen case and name only what is
   needed.
3. **Vary and compare:** change the primary quantity and draw attention to the
   coupled consequences.
4. **Predict and explore:** pause with a focused prompt; let the learner manipulate
   the model and test a prediction.
5. **Examine a revealing case:** visit a limit, threshold, counterexample, or
   alternative representation.
6. **Formalize:** connect the observed relationship to a principle, equation, or
   disciplinary term.
7. **Transfer:** ask about a new case that was not directly narrated.

This sequence is not mandatory. Its purpose is to preserve both halves of the
medium: a coherent explanation and meaningful learner agency.

## Concept canvas for a brainstorming session

Complete this canvas before discussing visual style or production.

### 1. Learners and objective

- Course, level, and approximate prior knowledge:
- Conceptual objective: “After this lesson, learners should be able to explain…”
- Common misconception or recurring difficulty:
- What learners should *not* need to learn in this lesson:

### 2. The explorable relationship

- Relationship sentence: “When the learner changes **___**, **___** changes
  because **___**.”
- Primary learner action:
- Meaningful range of cases to explore:
- Boundary, extreme, or counterexample worth trying:
- What, if anything, remains invariant:

### 3. What becomes visible

- Main representation:
- A second linked representation, if useful:
- Quantities, structures, or features that should be highlighted:
- Equation, definition, or short statement that should remain visible:
- What the learner should notice without being told directly:

### 4. The guided story

- Opening question or phenomenon:
- Baseline example:
- Most revealing contrast:
- Moment when control passes to the learner:
- Prediction or exploration prompt:
- Formal idea introduced after exploration:
- Final transfer question:

### 5. Evidence and scope

- What learner response would indicate improved understanding:
- Why a static figure or ordinary video would be insufficient:
- Smallest useful version of this lesson:
- Elements that can be postponed or omitted:
- Accessibility concerns, including reliance on colour, sound, spatial perception,
  or fine motor control:

## Quick fit check

Before proposing the concept, ask:

- Is there one precise conceptual difficulty?
- Can the core idea be expressed as a relationship rather than a fact?
- Is there a meaningful action the learner can take on the model?
- Do the resulting and off-path states remain scientifically meaningful?
- Does interaction reveal something a fixed illustration would conceal?
- Would linked representations help learners connect different ways of thinking?
- Is there a useful order in which a narrator should build the idea?
- Can a checkpoint ask learners to predict, compare, or explain?
- Can the first version focus on one main relationship and a few controls?

A strong proposal answers “yes” to most of these questions. A “no” does not reject
the subject; it usually means the idea needs to be narrowed, reframed around a more
specific obstacle, or taught through a different medium.

## What to bring forward as a concept proposal

A useful initial proposal can fit on one page. It should contain:

1. a working title and intended learner level;
2. the conceptual obstacle or misconception;
3. the sentence “the learner changes **X** and observes **Y**”;
4. a rough sketch of the main and linked representations;
5. four to seven beats in the narrated arc;
6. one prediction or exploration checkpoint;
7. one boundary case, counterexample, or transfer question; and
8. a short explanation of why interactivity adds genuine pedagogical value.

Do not worry yet about visual polish or technical feasibility. The most important
work at this stage is deciding what the learner should think about, what they should
be able to change, and what they should understand differently after doing so.
