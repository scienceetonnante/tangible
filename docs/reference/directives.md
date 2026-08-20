# Narration directive reference

Narration is Markdown. Prose is spoken verbatim. Front matter, HTML comments, and
formal directives are stripped before TTS and captions.

Inline directives anchor to the onset of the next word. Block directives occupy
their own line.

## State cues

```markdown
@cue(theta = 0)                         instant assignment
@cue(theta -> 3.14, over: 2s)           animated assignment
@cue(theta -> HALF_PI, ease: linear)     named constant and easing
@cue(weights -> [0.1, 0.2, 0.3])        named parameter group
```

Options are `over: <seconds>`, `ease: linear|inOutCubic|inCubic|outCubic|spring`,
and `at: +0.5s|-0.2s|sentence-end`. Values are absolute and validated against the
scene schema.

Convenience directives:

```markdown
@show(projection, cosLabel)
@hide(projection)
@camera(sideView, over: 3s)
```

## Structure and pauses

```markdown
@scene(main)
@chapter(Why the path zigzags)
@pause(prompt: "Find where SGD becomes unstable.")
@pause(prompt: "Explore before continuing.", speak: false)
```

A spoken pause inserts its prompt into narration and stops at the prompt boundary.
A silent pause stops without adding text. The normal play control resumes.

## Board

```markdown
@board(loss: $L = (y - \hat y)^2$)
@board(note: "The update follows the negative gradient.")
@highlight(loss.term)
@dim(loss)
@clear(loss)
@clear(board)
```

KaTeX subexpressions are addressed through `\htmlClass{name}{...}` tags.

## Build-time computation

```markdown
@bake(descent, steps: 3, over: 6s, ease: inOutCubic)
```

The named scene baker receives its declared reads and returns exactly its declared
writes. The compiler validates and expands the result into ordinary keyframes.
Repeat one-step bakes when each update needs a separate narration anchor.

## Natural-language hints

HTML comments are not directives. They let a human describe choreography before
the scene contract is known:

```markdown
<!-- scene: reveal the projection as the narrator says "horizontal" -->
```

The implementing agent translates these comments into the formal syntax above.
