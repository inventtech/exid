---
name: review-full
description: "Smart review — auto-detects scope, read-only or fix mode. /review-full --read-only = read-only peek, /review-full = fix loop pipeline. Use --read-only before committing; bare /review-full for the full fix-until-ship pipeline."
---

# Review

One entry point for code review. Auto-detects scope from the diff.

> **No UX dimension:** `exid` is a library with no UI. There is no `/review-ux`; a review that
> reports a UX score is confused about the repo.

> **Naming note:** `/review` and `/code-review` are Claude Code **built-in** commands (GitHub-PR review /
> working-diff review) — typing them never reaches this skill. This skill's trigger is `/review-full`.

## Modes

| Command | Mode | What it does |
|---|---|---|
| `/review-full --read-only` | Read-only | Quick audit of current diff — report score, no file changes |
| `/review-full` | Fix loop | Run review-code-fix, max 3 rounds |

## Bundling note

When invoked as part of a multi-skill batch (Phase R), suppress auto-commit — leave changes staged.
When standalone, commit fixes in a single commit. Never merge — user runs `/merge-pr` manually.

## Execution model

- **Read-only mode**: delegate each review to an ad-hoc read-only `code-reviewer` agent (opus).
- **Fix mode**: the loop runs in the MAIN session (per `/review-code-fix`) — main spawns the
  reviewer per round and applies fixes itself. Never wrap a fix loop in a subagent.

## Step 1 — Detect Scope

```bash
BRANCH=$(git branch --show-current)
BASE=$(git merge-base origin/main HEAD 2>/dev/null || echo HEAD~5)
SRC_CHANGED=$(git diff --name-only $BASE..HEAD -- 'src/**' | head -1)
PKG_CHANGED=$(git diff --name-only $BASE..HEAD -- package.json 'scripts/**' 'tsconfig*.json' | head -1)
```

| `src/` | packaging | Runs |
|:---:|:---:|---|
| yes | — | full review (invariants first) |
| no | yes | review focused on the export map + build |
| no | no | tooling/docs review only |

Docs-only diff (`*.md` only) → skip, report "docs-only — no code review needed" (Phase D's
`/review-docs` covers it).

## Step 2 — Run Reviews

**Read-only mode** (`/review-full --read-only`): delegate to `/review-code`.

**Fix mode** (bare `/review-full`): `/review-code-fix` — target **> 9 (≥ 9.5)**, max 3 rounds.

## Step 3 — Report

```markdown
## Review Report

Scope: `<src | packaging | tooling>`
Mode: `<read-only | fix>`

| Review | Score | Bar | Status |
|---|---|---|---|
| Code | X/10 | > 9 | pass / fail |
| Invariants | — | zero violations | pass / fail |

Ready for Phase D (/update-docs): Yes / No
```

## Guidelines

- Code review: **> 9 (≥ 9.5)** — a 9.0 fails (see `.claude/rules/code-review.md`)
- **An invariant violation is Critical regardless of score** (`.claude/rules/invariants.md`)
- Spawn ad-hoc `code-reviewer` agent (opus) for review — or use the standing pair from `/start-team`
- Do NOT run `/update-docs` — that's Phase D, separate invocation
- Never commit, push, or merge in read-only mode
