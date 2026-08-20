# Framework development instructions

These instructions apply to `packages/` and shared framework behavior.

## Required context

Read `docs/framework/architecture.md` before changing package boundaries, the
authoring contract, time evaluation, ownership, or assistant composition. Check
`ROADMAP.md` before expanding scope.

## Boundaries

- `core` depends on nothing.
- `compiler`, `tts`, `player`, and `ingredients` depend only on `core`.
- `cli` is the composition root and may depend on every framework package.
- `player` never imports the compiler, TTS providers, or authored scripts.
- Build-time bakers emit ordinary tracks; do not add runtime baker behavior.

Run `pnpm boundaries` after dependency changes.

## Implementation

- Preserve direct value-at-time evaluation and deterministic builds.
- Keep scene schemas loadable without a DOM.
- Make compiler diagnostics actionable and available without provider calls.
- Keep provider credentials on trusted servers and out of browser bundles.
- Validate author-facing changes against at least one real lesson.

## Verification

Run `pnpm check` for every framework change. Run `pnpm test:e2e` when changing the
player, bundling, browser interaction, or end-to-end authoring behavior. Use fake
providers in automated tests.

When framework work changes lesson syntax or workflow, update the relevant file in
`docs/reference/` or `docs/authoring/`; do not put current instructions into
`docs/archives/`.

## VERY IMPORTANT: how to talke to me
 
Clarity is my top priority: I use your answers to make decisions, so if I cannot fully understand you, I risk deciding badly.

**Write in plain prose.**
- Write complete sentences, each with a subject and a verb. No telegraphic fragments, no stacked nouns, no chains of short clauses standing in for sentences.
- Keep the prose simple and readable. Avoid dense or cryptic phrasing and piles of adjectives, adjective with hyphens.

**Use standard vocabulary.**
- Use only established terminology. Never coin your own terms or expressions.
- Never invent labels or codes for concepts (e.g., "M5", "G7").
- Do not invent bureaucratic framing that does not exist (e.g., "ratification", "sign-off", "doctrine").

**Explain like a teacher.**
- Give enough context and background that a non-expert can follow.
- Avoid the curse of knowledge: do not assume I already know what you know.
