---
title: Temperature in ten lines of Python
language: en
---

@scene(editor)
@chapter(A tiny sampler)

This is a tiny Python editor, and we are going to build the part of a language model that chooses what comes next. These are pretend model scores for three possible tokens.

@cue(code -> SCORE_SETUP, over: 3.5s, ease: linear) Higher scores mean the model currently prefers that token.

@cue(code -> COLD_PROGRAM, over: 9s, ease: linear) The sample function turns those scores into weights. Temperature controls how strongly the largest score wins, and a fixed random seed keeps our comparison honest.

@cue(run -> 1, over: 0.7s, ease: linear) Now the lesson presses Run. @cue(output = COLD_OUTPUT) With a temperature of zero point five, the strongest token wins every draw.

@pause(prompt: "Your turn. Change temperature from zero point five to two point five and press Run. You can also rename a token, change a score, or pause and ask for a code variation.")

@chapter(More surprise)

@cue(code -> HOT_PROGRAM, over: 4s, ease: linear) Here is that temperature edit. The rest of the program stays the same.

@cue(run -> 2, over: 0.7s, ease: linear) Run it again, @cue(output = HOT_OUTPUT) and lower-scoring tokens now appear more often. Temperature did not invent new choices; it changed how adventurous the sampler is among the choices it already had.

@pause(prompt: "Keep experimenting. Try an extreme temperature, add a fourth token, or ask the lesson assistant to edit the sampler for a different behavior.")
