---
name: review-code
description: Review code changes or pull request with structured multi-phase approach. Use when the user says "/review-code", asks to review code, or wants changes checked before merging.
---

# Code Review Skill

Review current code changes (or a specific PR) with a structured, multi-phase approach.


## Execution

Spawn an Agent with `subagent_type: "code-reviewer"`. It covers the three review dimensions (Phase 2) in a single pass — the code-reviewer agent has no Agent tool, so it cannot spawn sub-agents.

**Argument:** PR number (optional) — if none, reviews uncommitted/staged changes.

Return only the final Code Review Summary (Phase 3 report) to the user.

## Phase 1: Gather Changes

**If PR number provided:**
```bash
gh pr diff $ARGUMENTS
gh pr view $ARGUMENTS --json title,body,files,additions,deletions
```

**If no argument:**
```bash
git diff HEAD
git diff --cached
git -c color.status=false status --short   # -c form bypasses rtk truncation (see troubleshooting.md) so deletions stay in scope
```

Classify: count files/lines, identify scope (api/www/both/packages), list affected modules.

## Phase 2: Review Dimensions (one pass, three lenses)

### Dimension 1: Invariants 🔴 (check FIRST)
- Zero runtime dependencies · no `node:*` import under `src/` · no allocation or CSPRNG call in the
  mint path · bijectivity intact · no module-level generator registry · golden vectors unchanged
- Public API: is a changed export a semver commitment being broken silently?
- Full list + rationale: `.claude/rules/invariants.md`. **A violation is Critical regardless of score.**

### Dimension 2: Correctness & Portability
- 32-bit lane discipline (`| 0`, `>>> 0`), rotation counts, sign extension
- Domain bounds (`D1`/`D2`/`D3`, inclusive vs exclusive), counter wrap, prefix validation
- Anything assuming Node, a DOM, a bundler, or one module system — the package ships to Node 18+,
  Bun, Deno, Workers, and browsers
- Packaging: `exports` map, `files`, type resolution for BOTH ESM and CJS

### Dimension 3: Types, Tests & Hygiene
- Type safety (no `any`), `verbatimModuleSyntax` type imports, Biome compliance (zero warnings)
- Tests: deterministic input (fixed state), restored globals, stated flake bounds, real assertions
- Coverage thresholds still pass (95/95/95/90) and did not merely survive on a widened test
- Comments ≤ 3 lines (the math exception is real, but must be about the math), no PR refs in source

## Phase 3: Aggregate & Report

```
## Code Review Summary

**Scope:** <src/packaging/tooling> | **Files:** <N> | **+<added>/-<removed>**
**Invariants touched:** <list, or "none">

### Critical Issues (<count>)
#### <file_path>:<line>
**Issue:** <description>
**Fix:** <actionable suggestion with code snippet>

### Major Issues (<count>)
...

### Warnings (<count>)
...

### Suggestions (<count>)
- <file>:<line> — <suggestion>

### Positive Notes
- <what was done well>

### Review Summary

| Area | Score |
|------|-------|
| Security | X/10 |
| Best Practices | X/10 |
| Performance | X/10 |
| Testing | X/10 |
| **Overall** | **X/10** |

### Verdict: Ready to merge (score > 9) / Needs changes / Needs rework
```

Severity buckets + deductions + the scoring rubric come from `.claude/rules/code-review.md`
(§Severity & Scoring, §Approval Thresholds). The `| **Overall** | **X/10** |` row is a
CONTRACT — `/review-code-fix` parses it verbatim; never rename or drop it.

## Guidelines

- Every issue MUST have an actionable fix
- Include code snippets for Critical and Warning items
- Acknowledge good patterns — don't only report problems
- Check that tests were added for changes (per planning rules)
- Check that docs were updated if needed
- If reviewing a PR, verify PR description matches actual code changes
