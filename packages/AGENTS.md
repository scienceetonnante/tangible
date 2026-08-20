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
`docs/research/`.
