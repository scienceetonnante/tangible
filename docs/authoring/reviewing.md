# Review a lesson

Review in layers. A technically valid build can still be a weak explanation.

## Pedagogy

- Is the conceptual obstacle clear within the opening?
- Does interaction reveal a relationship that a fixed animation would hide?
- Is there one obvious primary action?
- Does the narration direct attention and explain significance?
- Does a pause ask for a prediction, comparison, manipulation, or explanation?
- Does the ending formalize or transfer what the learner observed?

## Scene and interaction

- Try ordinary, boundary, and deliberately awkward parameter values.
- Confirm linked representations remain consistent.
- Check drag targets, labels, captions, and controls at desktop and narrow sizes.
- Test touch when the intended audience may use tablets or phones.
- Pause during an interaction, resume, and seek elsewhere.
- Confirm camera and other viewer-owned controls behave as intended.

## Choreography

- Verify every scene hint was encoded or explicitly rejected.
- Check that visuals anticipate or coincide with the relevant spoken phrase.
- Avoid overlapping transitions unless the overlap is intentional.
- Inspect representative states and frames across every chapter.
- Build with the real voice only after the prose is stable, then tune cue offsets
  against real prosody.

## Release

- Run `pnpm lesson check` and a complete bundle build.
- Review the deployed lesson privately on its target browsers.
- Verify captions and every language offered in the manifest.
- For assistant-enabled lessons, test one real answer, rate limits, logs, and the
  absence of credentials from browser assets.
