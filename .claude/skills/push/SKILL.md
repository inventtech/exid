---
name: push
description: "Smart push — commit + push + auto-create PR if needed. Blocks push to main. Use /push after completing work."
---

# Push

Commit, push, and ensure a PR exists. Single command for the ship step.

See `references/conventions.md` for PR title format, types, scopes, and examples.
See `references/pr-template.md` for PR body template and section guidelines.

## Execution — run INLINE in the main session

Run Steps 1–5 directly in the main session. **Do NOT spawn a subagent.**

Push is a mechanical git+gh flow that needs no isolation. Spawning a subagent from a long
session duplicates the parent's (potentially 1M-token) context into the child and trips
`API Error: Usage credits required for 1M context` — the gate is on context *size*, not model.

This repo has no git hooks — nothing runs the gates for you. Run them yourself before
committing (Step 1.5).

## Step 1 — Safety Check

```bash
BRANCH=$(git branch --show-current)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "ERROR: on main — create a feature branch first"
  exit 1
fi
```

**Block push to main.** If on main with uncommitted changes, create a feature branch first (`feat/`, `fix/`, `chore/`, `docs/` prefix based on changed files), then continue.

## Step 1.5 — Pre-Flight Gate Check (when running as Phase S)

If this push is part of the A → R → D → S pipeline (not a standalone `/push`), verify gates before proceeding:

- **Code review ≥ 9.5** — check recent review scores from Phase R
- **The full gate chain is green**:
  ```bash
  bun run lint && bun run typecheck && bun run test:coverage && bun run build \
    && bun run check:universal && bun run check:pack && bun run test:pack && bun run examples
  ```
- **`git status` clean** — no uncommitted changes
- **The PR title's type matches the intended release** (`.claude/rules/git.md`) — a `chore:` title
  publishes nothing

If any gate fails, report which gate failed and stop. Do NOT push with failing gates.

## Step 2 — Commit Uncommitted Changes

```bash
git -c color.status=false status --short   # -c form bypasses rtk truncation (see troubleshooting.md) — deletions must show
git diff --stat
```

If uncommitted changes exist, stage and commit with conventional format:
```bash
git add <relevant files>
git commit -m "<type>(<scope>): <description>"
```

If no changes and no unpushed commits → report "nothing to push" and stop.

## Step 3 — Push

```bash
git pull --rebase origin main
git push -u origin HEAD
```

`HEAD` avoids the captured-`$BRANCH` empty-var trap (`git.md`). If the branch was pushed
BEFORE the rebase, the push is rejected — use the safe variant `git push --force-with-lease`
(pre-tool-guard allows it; plain `--force` stays blocked).

## Step 4 — Check / Create PR

```bash
gh pr view --json number,title,url,state 2>/dev/null
```

**Scenario A — PR exists:** report PR info + CI status. Done.

**Scenario B — No PR:** create one using the template from `references/pr-template.md`:

1. Analyze all commits: `git log origin/main..HEAD --oneline`
2. Analyze diff: `git diff origin/main...HEAD --stat`
3. Determine type, scope, subject from changes
4. Create PR — body goes through a temp FILE, never an inline heredoc (parens/quotes/arrows
   break under WSL zsh; `git.md` §"Commit / PR / issue body files → /tmp/"):
   ```bash
   # 1) write the body (filled from references/pr-template.md) to /tmp/ex-pr-body.md
   gh pr create --title "<type>(<scope>): <subject>" --body-file /tmp/ex-pr-body.md
   rm /tmp/ex-pr-body.md
   ```

## Step 5 — Report (in Thai to user)

Report to user in Thai:

```
PR #<number> พร้อม review แล้ว — <url>

Branch:    <branch-name>
Committed: <new commit message or "no new commits">
Pushed:    <N> commits pushed
CI:        <status>
```

## Guidelines

- **Never push to main** — block and suggest branch creation
- **Never plain force push** — `--force-with-lease` only, and only after the Step 3 rebase rejects
- Commit messages follow conventional format (see `references/conventions.md`)
- Auto-detect scope from changed files (`core`, `docs`, `ci`, `bench`, `scripts`, `examples` — omit for cross-cutting changes, per `git.md`)
- **State the release impact in the PR body** — patch / minor / major / none, derived from the title
- Do NOT update PR description of existing PRs — user runs `/update-pr-description` manually
