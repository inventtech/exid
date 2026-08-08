---
name: audit-full
description: Full Audit Pipeline — orchestrates /audit-config + /audit-code + /audit-test. Branch-aware; on a feature branch runs scoped to the diff, on main runs a whole-project scan + ONE tracker issue. Use when the user says "/audit-full", asks for a Phase A wrap-up, or asks to audit everything.
---

# Full Audit Pipeline

Orchestrates the 3 audit skills (`/audit-config` + `/audit-code` + `/audit-test`) as a single pass. This is the canonical Phase A in the wrap-up pipeline — see [`references/planning-pipeline.md`](references/planning-pipeline.md) for the full pipeline doctrine; high-level invariants live in [`.claude/rules/planning.md`](../../rules/planning.md).

## Branch-aware execution

Detect the current branch FIRST:

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
# `-c color.status=false` bypasses the rtk hook (it rewrites only bare `git status`), which
# truncates long change lists and can drop deletions — a wrong DIRTY count. See troubleshooting.md.
DIRTY=$(git -c color.status=false status --porcelain | wc -l)
```

Then fork:

| Branch / state | Mode | Scope | Output |
|---|---|---|---|
| `main` / `master`, clean | **Standalone (project-wide)** | Whole repo | ONE consolidated tracker issue per [audit-code Phase 2b](../audit-code/SKILL.md#phase-2b-track-as-a-single-issue-on-user-request) |
| `feat/*` / `fix/*` / `chore/*` (in-ticket), with active plan | **In-ticket (Phase A)** | `git diff main...HEAD` (changed files only) | Add Phase A todos to active plan, auto-fix Critical/Major/Warning, defer Suggestions |
| `main` with uncommitted changes | **Ask user** | — | Confirm: "Did you forget to branch? Or audit anyway as project-wide?" |

The skill MUST detect mode before running anything. In ambiguous cases, ask.

## Bundling note

Like the other audit skills, when invoked as part of a wrap-up batch (Phase A → R → D), **suppress the auto-commit step at the end** — leave changes staged for the parent agent's batch commit per phase. When invoked standalone with `--commit` flag or after explicit user OK, commit + open tracker as today.

## Standalone mode (on main)

Whole-project scan. User invoked `/audit-full` outside any ticket — they want a health check.

### Step 1 — Run all 3 audits sequentially

```
1. /audit-config (full mode)        — Claude tooling layer (settings.json, hooks, skills, agents)
2. /audit-code (scope=all)          — src/ + scripts/ + bench/ + examples/
3. /audit-test (scope=all)          — src/__tests__/*.test.ts
```

Run **sequentially**, not parallel — audit-config can clean tooling that affects subsequent audit signal quality. Order rationale matches `planning.md`.

### Step 2 — Aggregate findings

Merge findings from all 3 audits into a **single combined report** with priorities preserved:

```
Full Audit Report (Standalone)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Branch: main
Date: <date>
Files scanned: XXX (config: X · code: X · test: X)
Total findings: XXX

[P0] CRITICAL — config: <description>
  File: <path>:<line>
  Source: /audit-config

[P0] CRITICAL — code: <description>
  ...

[P1] HIGH — test: <description>
  ...

Summary by source:
  config: X findings (P0: X · P1: X · P2: X · P3: X)
  code:   X findings (P0: X · P1: X · P2: X · P3: X)
  test:   X findings (P0: X · P1: X · P2: X · P3: X)

Total: P0: X | P1: X | P2: X | P3: X
```

### Step 3 — Open ONE consolidated tracker issue

After presenting the report, ask user: *"Open a consolidated tracker issue with these findings as a checklist?"*

If yes — use `/open-ticket` ONCE with grouped checkboxes (per `audit-code` SKILL Phase 2b pattern):

```bash
gh issue create \
  --title "chore: audit-full findings — project-wide (<date>)" \
  --label "refactor,priority:medium" \
  --body "$(cat <<'EOF'
## Summary

Consolidated findings from \`/audit-full\` run on <date> (whole project scan from main).
Total: X findings across audit-config + audit-code + audit-test, P0–P3.

Each checkbox below is a self-contained fix; pick them off in follow-up PRs, or batch by priority.

## audit-config findings
### P0 — Critical
- [ ] ...

### P1 — High
- [ ] ...

## audit-code findings
### P0 — Critical
- [ ] ...

### P1 — High
- [ ] ...

## audit-test findings
### P1 — High
- [ ] ...

### P2 — Medium
- [ ] ...

## Notes
- All findings auto-generated from \`.claude/skills/audit-{config,code,test}/references/\` checks.
- Fix individual items with a dedicated \`<type>(<scope>):\` commit; re-tick the box on PR merge.
- Re-run \`/audit-full\` after major refactors to surface newly introduced issues.
EOF
)"
```

**Do NOT:**
- Open one issue per source (config / code / test) — single tracker is the convention.
- Open one issue per finding — multi-ticket spam.
- Auto-fix without user OK in standalone mode — user is doing a health check, not a fix run.

## In-ticket mode (on feature branch)

User invoked `/audit-full` while shipping a ticket — this IS Phase A of the wrap-up pipeline. Auto-fix happens, no tracker issue.

### Step 1 — Verify there's an active plan / todo list

```bash
# Active plan signals:
TaskList                                       # active todos?
git log main..HEAD --oneline                   # impl commits exist?
gh issue list --state open --assignee @me      # assigned issues?
```

If NO active plan + NO todo list + NO impl commits → **ask user**: "There's no active plan. Should I run as standalone (open tracker issue) or are you mid-ticket?"

### Step 2 — Add Phase A todos to active plan

Add 3 todos to the existing TaskList:

- `Phase A.1 — audit-config` (only if `.claude/` was touched in `git diff main...HEAD`; otherwise SKIP and note in todo)
- `Phase A.2 — audit-code` (always)
- `Phase A.3 — audit-test` (always, if any code changed)

Mark each `in_progress` when starting, `completed` when done, per `planning.md` "Keep Todos In Sync".

### Step 3 — Run audits scoped to the diff

```bash
CHANGED_FILES=$(git diff main...HEAD --name-only)
```

Each sub-skill receives the changed files as scope (not whole repo). audit-code Phase 1 deep-scan gets only the diff'd files; audit-test only the changed `.spec.ts` files (or the spec files for changed source).

### Step 4 — Auto-fix per planning.md Phase A convention

- Critical / Major / Warning findings → **auto-fix** (in-ticket mode = ship-now mode)
- Suggestions → defer to user triage with a comment in the PR body
- Skip-when-clean: if a sub-skill reports 0 findings, mark its todo `completed` with note "no findings" and **don't create a commit** for it

### Step 5 — Stage, don't commit

Per Bundling note above — leave changes staged. Main session creates the per-phase commit:
- `chore(claude): #<n> PA.1 audit-config — <summary>`
- `refactor: #<n> PA.2 audit-code — <summary>`
- `test: #<n> PA.3 audit-test — <summary>`

### Step 6 — Hand off to Phase R

After Phase A finishes (or skips clean), Phase R (`/review-code-fix`) runs next. audit-full does not run /review-full itself. There is no UX phase — this package has no UI.

## Output (in-ticket mode)

```markdown
## Phase A — Audit Report (in-ticket)

| Sub-phase | Skill | Findings | Auto-fixed | Deferred (Suggestions) | Commit |
|---|---|---|---|---|---|
| A.1 | audit-config | X (or N/A if `.claude/` untouched) | X | X | staged or skipped |
| A.2 | audit-code | X | X | X | staged |
| A.3 | audit-test | X | X | X | staged |

Diff against main: X files / Y added lines / Z deleted lines

Hand off to Phase R: ready
```

## Output (standalone mode)

```markdown
## Full Audit Report (project-wide)

[full prioritized P0–P3 list from Step 2]

Tracker issue: #<n> (if user OK'd creating one)
```

## Guidelines

- **Branch detection FIRST** — never run all-files scan on a feature branch (creates noise from unchanged code).
- **Sequential, not parallel** — config → code → test. Each audit may surface issues the next audit cares about.
- **One consolidated tracker** in standalone mode — never multi-ticket spam.
- **Auto-fix only in-ticket** — standalone = report-only, fixes happen in follow-up PRs from the tracker.
- **Skip-when-clean** — don't create empty commits for clean sub-phases. Note in PR body / report instead.
- **Never run /review-full or /update-docs** — those are Phase R and Phase D, separate concerns.

## References

- Sub-skills: [`audit-config`](../audit-config/SKILL.md), [`audit-code`](../audit-code/SKILL.md), [`audit-test`](../audit-test/SKILL.md)
- Pipeline definition: [`references/planning-pipeline.md`](references/planning-pipeline.md) (deep dive); [`.claude/rules/planning.md`](../../rules/planning.md) (lean rule)
- Tracker pattern: [`audit-code` Phase 2b](../audit-code/SKILL.md#phase-2b-track-as-a-single-issue-on-user-request)
