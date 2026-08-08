#!/bin/bash
# PostToolUse hook: Auto-fix Biome on Write|Edit for JS/TS/CSS files

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -n "$FILE_PATH" && "$FILE_PATH" =~ \.(ts|tsx|js|jsx|css|json|jsonc)$ ]]; then
  bunx biome check --write --no-errors-on-unmatched "$FILE_PATH" 2>/dev/null || true
fi
