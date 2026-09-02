---
title: Why Adaptive Optimizers Exist — a Tangible lesson.
emoji: 🏔️
colorFrom: yellow
colorTo: indigo
sdk: docker
app_port: 7860
fullWidth: true
header: default
pinned: false
short_description: Why momentum/AdamW can outperform SGD — a Tangible lesson.
tags:
  - tangible
  - education
  - interactive-learning
  - machine-learning
  - optimization
  - gradient-descent
  - sgd
  - adamw
---

# Why Adaptive Optimizers Exist

An interactive narrated lesson comparing SGD, momentum, and AdamW on
conditioned 3D loss surfaces. Play the explanation, orbit the
landscape, move the starting point, and change optimizer settings while every
path recomputes live.

Built with [Tangible](https://github.com/scienceetonnante/tangible), a platform
for narrated explorables authored from text.

The lesson assets are a self-contained bundle. A small same-origin Node server
protects the Hugging Face Inference Providers credential used by the pause-time
written question box. Configure `HF_TOKEN` as a Space secret; answers use the
pinned `google/gemma-4-31B-it:cerebras` model. The public question API is bounded
by configured request and answer sizes, per-browser and per-IP traffic limits,
global hourly and daily limits, a bounded provider queue, concurrency, and a
provider timeout. The launch profile allows eight active provider calls and 30
waiting requests, with global ceilings of 1,000 calls per rolling hour and 5,000
per rolling day. Operators can temporarily override the traffic, queue, and
timeout values with the documented `ASSISTANT_*` Space variables.
