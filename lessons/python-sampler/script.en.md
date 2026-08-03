---
title: Sampling temperature in Python
language: en
---

@scene(editor)
@chapter(A tiny sampler)

This is a tiny Python editor. We are going to build a simplified version of the step where a language model chooses its next token.

@cue(code -> IMPORTS, over: 4s, ease: linear) I start by importing math for the exponential function, and random for drawing weighted choices.

@cue(code -> SCORE_SETUP, over: 5s, ease: linear) Next I create a dictionary named scores. Its keys are three possible tokens, and each number is a pretend model score. The larger the score, the more the model currently prefers that token.

@cue(code -> WEIGHT_FUNCTION, over: 8s, ease: linear) Now I define sample with temperature as its input. For every score, this list computes its exponential after dividing by temperature. A low temperature magnifies the differences, while a high temperature makes the weights more similar.

@cue(code -> SAMPLER_FUNCTION, over: 7s, ease: linear) Then I fix the random seed so repeated runs are comparable, and return twelve choices using those weights. The seed is only for our demonstration; normal generation is allowed to vary.

@cue(code -> COLD_PROGRAM, over: 5s, ease: linear) Finally I set temperature to zero point five, call sample, and join the selected tokens with spaces so the result is easy to read.

@cue(run -> 1, over: 0.7s, ease: linear) Now the lesson presses Run. @cue(output = COLD_OUTPUT) At this low temperature, the strongest token wins every draw.

@pause(prompt: "Your turn. Change temperature from zero point five to two point five and press Run. You can also rename a token, change a score, or pause and ask for a code variation.")

@chapter(More surprise)

@cue(code -> HOT_PROGRAM, over: 4s, ease: linear) Here is that temperature edit. Only zero point five becomes two point five. The larger denominator pulls the exponential weights closer together; the rest of the program stays the same.

@cue(run -> 2, over: 0.7s, ease: linear) Run it again, @cue(output = HOT_OUTPUT) and lower-scoring tokens now appear more often. Temperature did not invent new choices; it changed how adventurous the sampler is among the choices it already had.

@pause(prompt: "Keep experimenting. Try an extreme temperature, add a fourth token, or ask the lesson assistant to edit the sampler for a different behavior.")
