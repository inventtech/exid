#!/usr/bin/env bash
# SessionStart hook: load WSL-only rules on Windows/WSL, skip on macOS/Linux.
#
# Why: .claude/rules/*.md auto-load into every session. wsl.md is only
# relevant on Windows/WSL, so it lives in .claude/platform/ (NOT rules/) and
# this hook injects it as additionalContext only when running under WSL.
# On macOS/Linux the hook exits silently and adds nothing to context.
#
# WSL detection: /proc/version contains "microsoft" (WSL1/WSL2) or "WSL".
# macOS has no /proc/version, so the guard short-circuits to a clean exit.
set -euo pipefail

WSL_RULES="${CLAUDE_PROJECT_DIR:-.}/.claude/platform/wsl.md"

# Not WSL (no /proc/version, or kernel string lacks the marker) -> add nothing.
if [[ ! -r /proc/version ]] || ! grep -qiE 'microsoft|wsl' /proc/version; then
  exit 0
fi

[[ -r "$WSL_RULES" ]] || exit 0

# On WSL: emit the rules file as additionalContext (jq -Rs handles escaping).
jq -Rs '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ("# WSL Development Rules (platform-conditional)\n\n" + .)
  }
}' "$WSL_RULES"
