---
name: start-impl
description: Start implementing a feature with proper workflow
argument-hint: <feature-description or issue-number>
---

Start implementing a feature with proper workflow.

## Pre-Implementation Checklist

### 0. Cleanup Environment
Run `/cleanup` first to ensure a clean dev environment.

### 1. Check/Create Issue
- Search for existing issue: `gh issue list --search "<keywords>"`
- If no issue: Create one with `gh issue create`
- **IMPORTANT**: Always have an issue number before starting work

### 2. Research Codebase
- Read the issue requirements carefully
- Explore codebase for related code
- Check existing patterns in similar features
- Identify files that need to be modified

### 3. Plan with Opus (MANDATORY)

**After research, ALWAYS plan before writing any code. Planning uses Opus for deep reasoning.**

Spawn an Opus Plan agent (`Plan` is a harness built-in agent type, not a `.claude/agents/` definition):
```
Agent(
  subagent_type: "Plan",
  model: "opus",
  prompt: "Plan the implementation for issue #<N>. Context: <paste research findings + issue details here>.
  
  The plan MUST follow this structure:
  1. Context — What problem are we solving? Link to issue.
  2. Scope boundary — What is IN scope and what is OUT of scope.
  3. Implementation steps (P1…Pn) — Numbered phases with specific files, changes, and task surface + skill per phase. Tests folded into relevant Pn.
  4. Invariant impact — FIRST read `.claude/rules/invariants.md` + `CONTRIBUTING.md` §The rules that matter. List which invariants this work touches and what test pins each one. Then list any NEW invariant this work would establish (hard-to-reverse + surprising + real trade-off) — it gets written into CONTRIBUTING.md + invariants.md in Phase D. If none: write 'None — no invariant touched'. On a `src/exid.ts` or `src/siphash.ts` diff, 'None' is a red flag, not a pass.
  5. Phase A (Audit) — /audit-full: audit-config (if .claude/ touched) + audit-code + audit-test. Auto-fix Critical/Major/Warning.
  6. Phase R (Review) — /review-code-fix (gate ≥ 9.5). No UX phase — this package has no UI.
  7. Phase D (Docs) — /update-docs: sync all doc tiers + finalize ADRs flagged in step 4 (status: proposed → accepted, fill Consequences).
  8. Phase S (Ship) — /push: auto push + create PR (no merge). User reviews PR before merging.
  9. Verification — How to confirm it works end-to-end.
  
  Do NOT write a plan file to .claude/plans/. The plan lives in the issue comment + ADR draft."
)
```

Wait for the Opus plan agent to return the plan, then **review it (step 3.5) before posting/coding**.

### 3.5. Review the Plan (MANDATORY)

Catching a hole in the plan is far cheaper than after code is written. Run **both** passes (see `planning.md` §Plan Review) — skip only for trivial single-step changes:

1. **Adversarial agent** — spawn an independent `Plan` (or `code-reviewer`) agent to critique the plan against the codebase + rules:
   ```
   Agent(subagent_type: "Plan", prompt: "INDEPENDENT plan reviewer. Adversarially review the plan for issue #<N> (paste plan). Find holes the author missed — correctness/races, wrong assumptions, missing edge cases/tests, scope/sequencing, rule compliance (.claude/rules/*). Return Critical/Major/Minor findings + verdict (APPROVE / APPROVE-WITH-CHANGES / NEEDS-REWORK). Do NOT rewrite or edit files.")
   ```
2. **Self-review checklist** — scope boundary explicit · each Pn independently testable · ADR candidates correct · tests folded per Pn · schema/migration workflow · edge cases (null/empty/concurrent/failure) · no unrelated scope mixed in.

**Gate:** fold every **Critical + Major** finding into the plan before proceeding; defer Minor with a note. Decisions that are the user's (pricing, product behaviour) → `AskUserQuestion`. Surface the verdict + what changed.

### 4. Post Implementation Plan to Issue

Write the plan body to a temp FILE first — never an inline heredoc (parens/quotes/arrows
break under WSL zsh; `git.md` §"Commit / PR / issue body files → /tmp/"):

```bash
# 1) write /tmp/ex-plan-<issue>.md with this structure:
#    <details><summary>Implementation Plan</summary>
#    ## Scope        (IN: … / OUT: …)
#    ## Approach
#    ## Files to Modify
#    ## Testing Strategy
#    </details>
gh issue comment <issue-number> --body-file /tmp/ex-plan-<issue>.md
rm /tmp/ex-plan-<issue>.md
```

### 5. Create Feature Branch
```bash
git checkout main
git pull --rebase origin main
git checkout -b feat/<feature-name>
```

### 6. Verify Clean State
```bash
git status
git branch --show-current
```

## Start Implementation — AUTO-PROCEED

**`/start-impl` = full pipeline, no confirmation pauses.** Once the checklist is done (issue exists, branch created, plan posted), proceed immediately through:

1. **Implementation** (P1…Pn) — commit per phase
2. **Phase A** — audit + review-audit
3. **Phase R** — code review + fix
4. **Phase D** — docs + review-docs
5. **Phase S** — push + create PR

Do NOT stop to ask "เริ่มเลยไหม?" or "Ready to implement?". The user already said `/start-impl` — that IS the go signal.

**If you discover something beyond scope:** STOP and either update the plan (if small) or create a separate issue (if new concern). Do NOT silently expand scope.

## Workflow Reminders

- Commit per phase with conventional format: `<type>(<scope>): #<issue> P<N> — <summary>`
- After all Pn phases: run A → R → D → S wrap-up pipeline (see `planning.md`)
- Phase S auto-pushes + creates PR — user reviews before merging
- Use `/merge-pr` when user approves the PR

## Output

After PR is created, report: Issue #xxx, Branch: feat/xxx, PR #xxx URL
