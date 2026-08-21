# Deploy a lesson to Hugging Face Spaces

Build and review the lesson locally before touching its Space:

```bash
pnpm lesson check --lesson lessons/<id>
pnpm lesson build --bundle --lesson lessons/<id>
```

Use `--offline` only for structural review. A release bundle should contain the
intended narration.

## Release artifact

Publish only `lessons/<id>/build/site/` plus a Space `README.md` and
`.gitattributes`. Do not publish the monorepo, caches, `.env` files, or source
credentials.

The current repository convention uses an artifact-only orphan branch such as
`release/<id>` with one root commit. Record the source commit in its message. On a
later release, replace the artifact, amend that commit, and push it to the Space's
`main` with `--force-with-lease`.

Static lessons may use a static Space. Assistant-enabled lessons use the generated
Docker bundle and Space card settings:

```yaml
sdk: docker
app_port: 7860
```

## Assistant credentials

Store a dedicated fine-grained inference token as the Space secret `HF_TOKEN`.
Keep build-only credentials such as `HF_TTS_TOKEN`, `TTS_ENDPOINT_URL`, and
`ELEVENLABS_API_KEY` local or in CI; they must not appear in the release branch or
Space variables.

The public API defaults to global hourly, per-browser ten-minute, and concurrency
limits. Override them only with positive integer Space variables:

- `ASSISTANT_HOURLY_LIMIT`;
- `ASSISTANT_CLIENT_10M_LIMIT`;
- `ASSISTANT_MAX_CONCURRENT`.

## Safe release sequence

1. Keep the Space private.
2. Deploy the artifact and review playback, interaction, and captions.
3. Test one real assistant question when enabled.
4. Inspect structured request logs for safe success or error categories.
5. Confirm browser assets contain no credentials.
6. Make the Space public only after verification.

For credential rotation, deploy first, replace the secret, revoke the old token,
and test after the container restarts. Test path-containment defenses with a
harmless target such as `/etc/os-release`, never with a sensitive file such as
`/proc/self/environ`.
