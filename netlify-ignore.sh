#!/usr/bin/env bash
# Netlify "ignore" command: decides whether a push should trigger a deploy.
#   exit 0  -> CANCEL the deploy (skip it)
#   exit 1  -> PROCEED with the deploy
#
# The bots commit data the site reads straight from GitHub raw:
#   - results.json  (score-bot, frequent)
#   - recap.json / chirps.json  (nightly archive job)
# Those commits don't need a redeploy. archive/* are historical snapshots that
# can wait for the next real deploy. We skip the deploy when a push touched ONLY
# those files; any other change (index.html/CSS/JS, picks.json, outlook.json,
# scripts/*, etc.) deploys normally.

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

# Deploy only if something OTHER than raw-served data / archive snapshots
# changed. results.json, recap.json and chirps.json are read from GitHub raw;
# archive/* are static history that can wait for the next real deploy.
remaining="$(echo "$changed" | grep -vE '^(results\.json|recap\.json|chirps\.json|archive/)' || true)"
if [ -n "$remaining" ]; then
  echo "Source/content changed — proceeding with deploy:"
  echo "$remaining"
  exit 1
else
  echo "Only raw-served data / archive changed — skipping deploy."
  exit 0
fi
