---
name: review-code-fix
description: Automated review → fix → re-review loop for Ex Platform. Runs /review-code, extracts issues, auto-fixes Critical/Major/Warnings, then re-reviews until score > 9 (i.e. ≥ 9.5) or max 3 rounds. Use when the user says "/review-code-fix" or asks to review and automatically fix all issues.
---

# Code Review Fix Skill

Automated loop: review → fix → re-review. Stops when score **> 9 (i.e. ≥ 9.5)** or after 3 rounds max. A score of exactly 9.0 is a fail — see `.claude/rules/code-review.md` §Approval Thresholds.

## Execution — runs in the MAIN session

The loop runs inline: the main session spawns a read-only `code-reviewer` agent per round,
then applies the fixes ITSELF (`agents.md`: "Main session does ALL source edits").
Do NOT spawn fix agents and do NOT wrap the loop in a subagent.

**IMPORTANT: Report each round's results back to the user** — show the score + issues table BEFORE proceeding to fixes. Do NOT run silently in background. The user needs to see progress at every round, not just the final report.

## Algorithm

```
MAX_ROUNDS = 3
round = 1

loop:
  run code-reviewer agent → capture score (X from "**X/10**") + issues list

  if score == 10:
    stop → "Perfect score on round {round}. Nothing to fix."

  if score > 9:   // i.e. score >= 9.5 — a 9.0 does NOT pass
    stop → show score + summary, no fixes needed

  if round == MAX_ROUNDS:
    stop → Final Report (see below)

  extract Critical + Major + Warning issues
  show_issues_table()
  fix_all_issues()
  run lint to verify zero warnings
  round += 1
```

## Step 1 — Run Code Review

Spawn `subagent_type: "code-reviewer"` agent. The agent reads `.claude/rules/code-review.md` for the full checklist and scoring rubric.

Diff to review (base on origin/main — local main may be stale):
```bash
BASE=$(git merge-base origin/main HEAD 2>/dev/null || echo HEAD~5)
git diff $BASE..HEAD        # if unpushed commits exist
git diff HEAD               # fallback for unstaged changes
git diff --cached           # staged changes
```

**Parse score** from the output table: `| **Overall** | **X/10** |` (the Review Summary row `/review-code`'s template guarantees)

## Step 2 — Evaluate Score

| Score | Action |
|-------|--------|
| 10 | Stop immediately. "Perfect score — nothing to fix." |
| 9.5 – 9.9 | Stop. "Score passes the > 9 gate — production-ready. No auto-fix needed." |
| < 9.5 AND round < 3 | Extract issues → fix → next round (anything below 9.5 — incl. 9.0–9.4 — fails the gate per §Approval Thresholds) |
| < 9.5 AND round == 3 | Stop → Final Report |

## Step 3 — Show Issues Table

Before fixing, display a concise table:

```markdown
## Round {N} — Score {X}/10 — Fixing {K} issues

| # | Severity | File:Line | Issue | Fix Plan |
|---|----------|-----------|-------|----------|
| 1 | Critical  | src/exid.ts:NN | Description | Fix plan |
| 2 | Major     | src/siphash.ts:NN | Description | Fix plan |
| 3 | Warning   | ... | Description | Fix plan |
```

**Only fix Critical, Major, Warnings.** Never auto-fix Suggestions/Nitpicks.

## Step 4 — Fix All Issues (main session)

The main session applies every fix directly — no fix agents. Work file-by-file using:
- Exact file paths and line numbers from the review
- The specific issue and expected fix
- The rule being violated (from `.claude/rules/code-review.md`)

After all fixes complete: run lint to verify zero warnings:
```bash
bun run lint && bun run typecheck && bun run test:coverage
# if src/ or packaging changed, the built artifact must be re-verified too:
bun run build && bun run check:universal && bun run check:pack
```

If lint fails, fix the new warnings before proceeding to next round.

## Step 5 — Final Report (max rounds reached or done)

```markdown
## Code Review Fix Report

| Round | Score | Fixed |
|-------|-------|-------|
| 1 | X/10 | N critical, N major, N warnings |
| 2 | X/10 | N critical, N major, N warnings |
| 3 | X/10 | (max rounds reached) |

**Score trajectory:** X → Y → Z /10

### Result
✅ Score passes the > 9 gate (≥ 9.5) — ready to merge.
OR
⚠️ Max 3 rounds reached. Score: Z/10. Manual action needed.

### Remaining Issues (manual action required)
| Severity | File:Line | Issue |
|----------|-----------|-------|
| Critical | ... | ... |

### Recommended Next Steps
- [specific actionable items for remaining issues]
```

## Guidelines

- **Never push** — user runs `/push` manually after reviewing fixes
- **Never fix Suggestions/Nitpicks** — only Critical, Major, Warnings
- **Never auto-fix DB migrations** — flag to user instead: "Schema change required — fix manually"
- **Persistent issues** (same issue after 2+ rounds) — mark as "requires manual fix" in report
- **Scoring**: A score inflates if the reviewer is lenient — if you see the same Critical from round N in round N+1, it is a persistent issue, not a new one
