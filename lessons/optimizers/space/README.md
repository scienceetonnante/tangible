---
title: Why Adaptive Optimizers Exist
emoji: 🏔️
colorFrom: amber
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
short_description: Explore why momentum and AdamW outperform plain SGD
---

# Why Adaptive Optimizers Exist

An interactive narrated lesson comparing SGD, momentum, and AdamW on
conditioned and rough 3D loss surfaces. Play the explanation, orbit the
landscape, move the starting point, and change optimizer settings while every
path recomputes live.

Built with [narrable](https://github.com/scienceetonnante/narrable), a platform
for narrated explorables authored from text.

The lesson assets are a self-contained bundle. A small same-origin Node server
protects the Hugging Face Inference Providers credential used by the pause-time
written question box. Configure `HF_TOKEN` as a Space secret; answers use the
pinned `google/gemma-4-31B-it:cerebras` model.
