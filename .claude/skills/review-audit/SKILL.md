---
name: review-audit
description: "Review audit auto-fixes for correctness. Runs after Phase A to verify audit-code/audit-test/audit-config fixes didn't introduce regressions. Spawns code-reviewer agent (opus). Use when the user says /review-audit, or automatically after Phase A in the wrap-up pipeline."
---

# Review Audit Fixes

Verify that Phase A auto-fixes (from `/audit-full`) are correct and didn't introduce regressions.
This is the quality gate for audit output — catches over-eager auto-fixes, broken imports, removed code that was actually needed, etc.

## When to Run

Always after Phase A completes (even if audit "came back clean" — verify the claim).
Part of the pipeline: **P1→Pn → A → review-audit → R → D → review-docs → S**

## Bundling note

When invoked as part of the wrap-up pipeline, suppress auto-commit — leave changes staged.
If issues are found, fix them in-place and re-stage.

## Execute as Subagent

Spawn an Agent with `subagent_type: "code-reviewer"` and `model: "opus"`.

## Step 1 — Gather Audit Changes

```bash
# Show what Phase A changed (staged diff)
git diff --cached --stat
git diff --cached
```

If no staged changes AND audit reported "came back clean" → report "Phase A clean — no fixes to review" and pass.

## Step 2 — Review Focus Areas

The reviewer checks these specific risks:

| Risk | What to check |
|------|---------------|
| **Over-eager removal** | Did auto-fix delete code that was actually in use? Grep for removed function/variable names. |
| **Import breakage** | Are all imports still valid after refactoring? |
| **Test integrity** | Did audit-test changes preserve assertion intent? Mock factories still match service signatures? |
| **Config correctness** | Did audit-config changes break settings.json schema, hook scripts, or skill references? |
| **Convention drift** | Do fixes follow project conventions (`.claude/rules/naming.md`, `typescript.md` §Hot-path style)? |
| **Invariant erosion** 🔴 | Did an audit "simplification" remove a `>>> 0`, replace a scratch buffer with an allocation, narrow the bijection sweep, or touch the golden vectors? Any of these is an automatic FAIL (`.claude/rules/invariants.md`). |

## Step 3 — Scoring

| Score | Meaning |
|-------|---------|
| Pass | All fixes are correct, no regressions introduced |
| Fail (with issues) | One or more fixes need correction — list `[file:line]` per issue |

No numeric score — binary pass/fail. Any issue = fail, fix and re-review.

## Step 4 — Report

```markdown
## Review Audit — Report

Phase A sub-phases reviewed: A.1 (config) / A.2 (code) / A.3 (test)
Files changed: X
Lines: +Y / -Z

| Check | Status |
|-------|--------|
| Over-eager removal | pass / fail |
| Import breakage | pass / fail |
| Test integrity | pass / fail |
| Config correctness | pass / fail (or N/A) |
| Convention drift | pass / fail |

Issues: (if any, with [file:line])

Result: PASS / FAIL
Ready for Phase R: Yes / No
```

## Guidelines

- **Binary pass/fail** — no numeric score, no "suggestions". Either the fix is correct or it's not.
- **Scope to audit diff only** — don't review impl code (that's Phase R's job).
- **Fix in-place** — if issues found, main session fixes them immediately, re-stages, and re-runs this review.
- **Reviewer is READ-ONLY** — agent only reports, never edits files.
- **Max 2 rounds** — if still failing after 2 fix rounds, flag to user for manual review.
