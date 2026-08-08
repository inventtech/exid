#!/bin/bash
# SubagentStop hook — when a subagent finishes, report unpushed commits /
# uncommitted files back to the parent agent via additionalContext.
# (stderr with exit 0 is NOT shown to the model — JSON output is the
# channel that reaches it.) Never blocks: many subagents legitimately
# stop without pushing (read-only audits, research, etc.).

set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo "")}"
[ -z "$ROOT" ] && exit 0
cd "$ROOT" 2>/dev/null || exit 0

BRANCH=$(git branch --show-current 2>/dev/null || echo "")
[ -z "$BRANCH" ]       && exit 0
[ "$BRANCH" = "main" ] && exit 0

WARN=""
# Is there an upstream yet?
if ! git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  WARN+="⚠️ Subagent stopped on branch '$BRANCH' — no upstream yet. If work is complete, run: git push -u origin HEAD"$'\n'
else
  AHEAD=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo "0")
  [ "$AHEAD" != "0" ] && WARN+="⚠️ Subagent stopped with $AHEAD unpushed commit(s) on '$BRANCH'. Run: git push"$'\n'
fi

DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
[ "$DIRTY" != "0" ] && WARN+="⚠️ Subagent stopped with $DIRTY uncommitted file(s) on '$BRANCH'."$'\n'

if [ -z "$WARN" ]; then
  exit 0
fi

jq -n --arg ctx "$WARN" \
  '{ hookSpecificOutput: { hookEventName: "SubagentStop", additionalContext: $ctx } }'
exit 0
