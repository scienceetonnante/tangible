#!/usr/bin/env bash
# Deploy the unit-circle bundle and assistant server to a Docker Hugging Face Space.
#
# Usage:  scripts/deploy-space.sh <space-git-url>
#   e.g.  scripts/deploy-space.sh https://huggingface.co/spaces/david/unit-circle
#
# Assumes `lesson build --bundle` has already produced build/site/, and that git
# is authenticated for the Space remote (HF token as the git password, or a
# configured credential helper). Configure HF_TOKEN as a Space secret before
# using the question box.
set -euo pipefail

SPACE_URL="${1:?Usage: deploy-space.sh <space-git-url>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/lessons/unit-circle/build/site"
SPACE="$ROOT/lessons/unit-circle/space"

[ -f "$SITE/index.html" ] || { echo "No bundle at $SITE — run 'lesson build --bundle' first."; exit 1; }
command -v git-lfs >/dev/null || { echo "git-lfs not found — install it (brew install git-lfs); HF requires audio via LFS."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone "$SPACE_URL" "$TMP/space"

# Replace all tracked content (keep .git), then drop in the fresh bundle + card.
# .gitattributes routes *.mp3 through LFS — HF rejects plain-blob binaries.
find "$TMP/space" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$SITE"/. "$TMP/space"/
cp "$SPACE/README.md" "$TMP/space/README.md"
cp "$SPACE/.gitattributes" "$TMP/space/.gitattributes"

cd "$TMP/space"
git lfs install --local
# Stage .gitattributes first so the LFS filter applies when the mp3s are added.
git add .gitattributes
git add -A
git commit -m "Deploy unit-circle explorable (real voice)"
git push
echo "✓ pushed to $SPACE_URL"
