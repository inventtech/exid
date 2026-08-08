#!/bin/bash
# SessionStart hook (matcher: "compact") — fires right after compaction
# builds the new context window. Injects a terse git snapshot (branch,
# unpushed commits, open PR) via additionalContext so Claude reorients.
# PreCompact cannot inject context — this is the supported channel.

set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo ".")}"
cd "$ROOT" 2>/dev/null || exit 0

# Gather state — every line is optional (missing data → skipped)
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
PR_URL=$(gh pr view --json url --jq .url 2>/dev/null || echo "")
LATEST_COMMIT=$(git log -1 --format="%h %s" 2>/dev/null || echo "")

# Build a terse snapshot — enough to reorient Claude, not a history dump.
SNAPSHOT=""
[ -n "$BRANCH"        ] && SNAPSHOT+="Branch: $BRANCH"$'\n'
[ "$AHEAD" != "0"     ] && SNAPSHOT+="Commits ahead of origin/main: $AHEAD"$'\n'
[ "$DIRTY" != "0"     ] && SNAPSHOT+="Uncommitted changes: $DIRTY files"$'\n'
[ -n "$LATEST_COMMIT" ] && SNAPSHOT+="Latest commit: $LATEST_COMMIT"$'\n'
[ -n "$PR_URL"        ] && SNAPSHOT+="Open PR for this branch: $PR_URL"$'\n'

if [ -z "$SNAPSHOT" ]; then
  exit 0
fi

HEADER="## Session snapshot (post-compaction)"
jq -n --arg ctx "$HEADER"$'\n\n'"$SNAPSHOT" \
  '{ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: $ctx } }'
