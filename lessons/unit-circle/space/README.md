---
title: The Unit Circle
emoji: 🔵
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
short_description: An interactive narrated explorable of the unit circle
---

# The Unit Circle — an interactive narrated explorable

A lesson that is a live scene driven by a recorded voiceover: play it, or grab
the red point and scrub the angle yourself at any time and watch the cosine
recompute, then glide back to whatever the narration has reached.

Built with [narrable](https://github.com/) — narrated explorables authored from
a single text script.

The lesson assets remain a self-contained static bundle. A small same-origin Node
server protects the Hugging Face Inference Providers credential used by the
pause-time written question box. Configure `HF_TOKEN` as a Space secret; answers
use the pinned `google/gemma-4-31B-it:cerebras` model. The public question API is
bounded by per-browser, global hourly, and concurrency limits.
