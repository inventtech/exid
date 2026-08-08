#!/bin/bash
# PreToolUse hook: Warn before destructive Bash commands
# Exit 0 = allow, Exit 2 = block. The block reason MUST go to stderr —
# on exit 2 Claude Code feeds stderr (not stdout) back to the model.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')

if [ "$TOOL" != "Bash" ]; then
  exit 0
fi

CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Destructive patterns to block.
# `grep` is line-oriented, so `^` already anchors to the start of each
# newline-separated command; `[;&|]` covers same-line `;`/`&&`/`|` chaining.
# This avoids false positives when a command merely quotes "rm -rf ." in text.
if echo "$CMD" | grep -qiE '(^|[;&|]\s*)rm\s+-rf\s+(/(\s|$|\*)|~/?(\s|$|\*)|\$HOME(\s|$)|\.(\s|$|/(\s|$)))'; then
  echo "BLOCKED: Destructive rm detected: $CMD" >&2
  exit 2
fi
# NOTE: `git push --force-with-lease` is intentionally allowed — it fails safely
# if the remote moved (rebase-workflow safe variant), so it does not silently
# overwrite teammates' work. Plain `git push --force` and `git push -f` ARE
# blocked because they unconditionally overwrite remote history.
# The regex below matches `--force` only when followed by whitespace or end-of-string,
# so `--force-with-lease` (which has `-with-lease` immediately after `--force`) is allowed.
if echo "$CMD" | grep -qiE '(git\s+reset\s+--hard|git\s+push\s+--force(\s|$)|git\s+push\s+-f(\s|$)|git\s+clean\s+-fd|drop\s+database|drop\s+table)'; then
  echo "BLOCKED: Destructive command detected: $CMD" >&2
  exit 2
fi

# Publish guard: ASK the user instead of blocking. exid is a PUBLISHED npm
# package — a manual publish/tag is outward-facing and irreversible (npm
# forbids re-publishing a version). `permissionDecision: "ask"` prompts even
# under `bypassPermissions`; exit 2 would deny outright and only tell the model.
# Releases go through semantic-release in CI, never a hand-run publish.
ASK_REASON=""

if echo "$CMD" | grep -qE "(^|[;&|(]|[[:space:]])(npm|bun|pnpm|yarn)[[:space:]]+(publish|unpublish|deprecate)([[:space:]]|$)" ||
  echo "$CMD" | grep -qE "(^|[;&|(]|[[:space:]])(npx[[:space:]]+)?semantic-release([[:space:]]|$)"; then
  ASK_REASON="Package publish/release command"
fi

# Tags drive semantic-release; deleting or moving one rewrites release history.
if echo "$CMD" | grep -qE "git[[:space:]]+(tag[[:space:]]+(-d|--delete)|push[[:space:]].*--tags)"; then
  ASK_REASON="Git tag mutation (drives releases)"
fi

if [ -n "$ASK_REASON" ]; then
  jq -nc --arg r "$ASK_REASON — confirm before running; releases ship via CI, not by hand" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}'
  exit 0
fi

exit 0
