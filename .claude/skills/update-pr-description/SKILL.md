---
name: update-pr-description
description: Update the current PR description to reflect ALL changes on the branch. Use when the user says /update-pr-description or asks to update/refresh the PR body.
allowed-tools: Bash(git:*), Bash(gh:*), Read, Grep, Glob
---

# Update PR Description

Update the current PR description to reflect ALL changes on the branch.

## Steps

1. **Get PR info**: `gh pr view --json number,title,url,baseRefName,headRefName`
   - If no PR exists, stop and suggest running `/push`

2. **Analyze ALL changes on branch** (diff against `origin/$BASE` — local base may be stale):
   ```bash
   BASE=$(gh pr view --json baseRefName -q .baseRefName)
   git fetch origin "$BASE" --quiet
   git log origin/$BASE..HEAD --oneline
   git diff origin/$BASE...HEAD --stat
   git diff origin/$BASE...HEAD
   ```

3. **Categorize changes**: Features / Bug Fixes / Refactoring / Config/Tooling / Documentation / Tests

4. **Generate description** using project PR template format (mirrors `.github/PULL_REQUEST_TEMPLATE.md` — keep in sync):
   ```
   ### What problem does this PR solve?
   <problem/motivation, reference Closes #123 if applicable>

   ### How does this PR solve it?
   **Features:** ...
   **Bug Fixes:** ...
   **Refactoring:** ...
   **Config/Tooling:** ...
   **Tests:** ...

   ### Screenshots or GIFs
   N/A (or describe UI changes)

   ### To-Do List (if WIP):
   - [x] Completed item

   ---
   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   ```

5. **Update PR** — IMPORTANT: use REST API (not `gh pr edit --body`, fails with GraphQL error),
   and pass the body from a FILE (multiline-safe, per `troubleshooting.md`):
   ```bash
   # write the description to /tmp/ex-pr-body.md first
   gh api repos/inventtech/ex/pulls/<PR_NUMBER> -X PATCH -F body=@/tmp/ex-pr-body.md
   rm /tmp/ex-pr-body.md
   # Update title if needed (single-line — inline -f is fine):
   gh api repos/inventtech/ex/pulls/<PR_NUMBER> -X PATCH -f title="<title>"
   ```

## Guidelines

- Analyze ALL commits (not just latest), group logically by category
- Be specific about what changed, reference issues with `Closes #123`
- No file-by-file listing — summarize by feature/area
- Keep PR title under 70 chars, conventional format: `<type>(<scope>): <subject>`
