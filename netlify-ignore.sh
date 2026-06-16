#!/usr/bin/env bash
# Netlify "ignore" command: decides whether a push should trigger a deploy.
#   exit 0  -> CANCEL the deploy (skip it)
#   exit 1  -> PROCEED with the deploy
#
# The score-bot commits results.json on a frequent schedule. The site reads
# results.json directly from GitHub raw, so those commits don't need a redeploy.
# We skip the deploy when a push changed ONLY results.json; any other change
# (HTML/CSS/JS, picks.json, recap.json, archive/*, etc.) deploys normally.

set -e

# First build, or refs unavailable -> always deploy.
if [ -z "$CACHED_COMMIT_REF" ] || [ -z "$COMMIT_REF" ]; then
  echo "No cached ref — proceeding with deploy."
  exit 1
fi

changed="$(git diff --name-only "$CACHED_COMMIT_REF" "$COMMIT_REF")"
echo "Files changed since last deploy:"
echo "$changed"

if [ -z "$changed" ]; then
  echo "No file changes detected — proceeding with deploy."
  exit 1
fi

# If anything other than results.json changed, build. Otherwise skip.
if echo "$changed" | grep -qvx "results.json"; then
  echo "Source/content changed — proceeding with deploy."
  exit 1
else
  echo "Only results.json changed — skipping deploy (page reads it from GitHub raw)."
  exit 0
fi
