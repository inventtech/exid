# Planning & Task Rules

> **Always-loaded rule.** High-level invariants every interaction needs.
> Deep-dives (pipeline table, bundling contracts, per-phase rationale, todo procedures) in
> [`planning-pipeline.md`](../skills/audit-full/references/planning-pipeline.md) — loaded on demand.

## Multi-Phase Work — One Plan, Grouped Todos, One PR

> **User override:** phases — even loosely-related batches — stay on one branch, one PR.
> Default = bundle. Do NOT split unless the user explicitly asks.

When work spans 2+ phases:

- **One unified plan + one todo list** covering ALL phases up front, grouped by phase prefix `[P1]` / `[P2]` / …
- **All phases = one branch + one PR** — branch off fresh `main`, commit per phase, then push + open ONE PR.
- **One commit per phase**, not per file — `<type>(<scope>): #<issue> P<N> — <summary>`.
- **PR title** follows `<type>(<scope>): #<issue> — <epic summary>` (no `P<N>` suffix), and **its type
  decides the release** (`git.md` §The commit type IS the release). PR body lists each phase as a section.
- **The PR closes the epic issue** once merged.

The mandatory tasks run **once at the end**, not per-phase. **4 consolidated wrap-up phases** in order:
**A → R → D → S**:

- **Phase A (Audit)** — `/audit-full` (config only if `.claude/` touched) → `/review-audit`.
  Auto-fix Critical/Major/Warning; defer Suggestions.
- **Phase R (Review)** — `/review-code-fix`. Gate ≥ 9.5. (No UX phase — exid has no UI.)
- **Phase D (Docs)** — `/update-docs` → `/review-docs`.
- **Phase S (Ship)** — `/push`. Auto-runs once A+R+D pass; opens the PR, does NOT merge.
  **The auto-push applies only inside an explicit `/ship` or `/start-impl` pipeline** — outside one,
  `git.md` §"Stay on the current branch" governs: ASK before pushing / opening a PR.

Each verify step is pass/fail, max 2 rounds.

> **A+R+D+S is mandatory for EVERY change regardless of size — never skip a phase.**
> Skip-when-clean still applies (note "Phase X — came back clean" in the PR body).

## Issue Sizing (AI Token Budget)

T-shirt size labels, NOT manday. Estimate by AI effort (tokens), not human days. exid is a small
repo — an "L" here is a rewrite of the permutation, not 20 new files.

| Size | Token est. | Scope | GitHub Label |
|------|-----------|-------|-------------|
| **S** | 100–250K | Docs, a test, a script, a non-hot-path tweak | `size:S` |
| **M** | 250–600K | A new export, a packaging change, a new gate | `size:M` |
| **L** | 600K–1.2M | Anything touching the permutation, the PRF, or the encoding | `size:L` |
| **XL** | 1.2M+ | Algorithm change with new golden vectors + a written argument | `size:XL` |

**Sizing rule specific to this repo:** touching `src/exid.ts` or `src/siphash.ts` is **never S**.
The lines are few; the proof obligation is not.

## Task-Type Routing — Rules to Load

Before drafting implementation steps, load the right rule files for the surface.

| Task surface | Rules to read (in addition to always-loaded) |
|---|---|
| `src/**` — algorithm, encoding, entropy | `invariants.md`, `typescript.md`, `testing.md` |
| `src/__tests__/**` | `testing.md` |
| `package.json` exports · `scripts/build.mjs` · tsconfig build files | `invariants.md` §Dual ESM + CJS |
| `.github/workflows/**` | `git.md` §Merge Rules (the matrix is the gate) |
| `bench/**`, `examples/**` | `typescript.md` (biome overrides allow `console` here) |
| Docs only | (see `/update-docs` doc surfaces) |

## Plan Structure

Context → Scope → Impl steps (P1…Pn, each declaring the surface; tests folded into Pn)
→ **Invariant impact** (which of `invariants.md` the change touches, and what pins it — "None" is a
valid answer, but a change to `src/exid.ts` claiming "None" is a red flag)
→ **Phase A** → **Phase R** → **Phase D** → **Phase S**.

## Plan Review — Gate Before Implementation

Before the plan is finalized (CLI plan mode: **before `ExitPlanMode`**), **review the plan itself**.
Two passes, **both required** (skip only for trivial single-step changes):

1. **Adversarial agent** — spawn an independent `Plan` (or `code-reviewer`) agent to critique the plan
   against the codebase + rules: correctness holes, invariant violations, wrong assumptions, missing
   edge cases/tests, sequencing. It returns categorized findings (Critical/Major/Minor) + a verdict —
   it does NOT rewrite the plan.
2. **Self-review checklist** — scope boundary explicit · each Pn independently testable · invariant
   impact stated · tests folded per Pn · edge cases covered (domain bounds / counter wrap / prefix
   validation) · no unrelated scope mixed in · A→R→D→S wrap-up present · **the release type the PR
   title implies is the one intended**.

**Gate:** resolve every **Critical** and **Major** finding before implementation starts; defer
Minor/nits with a note. Surface the verdict + what changed to the user. Decisions that are the user's
to make (public API shape, breaking changes) → `AskUserQuestion`, don't guess.

## Plan Storage — Issue Comment, No Plan Files

**Do NOT write plan files.** Post the full plan as a `<details>` block on the GitHub issue — that
comment is the source of truth for the team.

## Todo Lists

Impl tasks first (one per Pn; tests folded into the relevant Pn — no separate "Update tests" task),
then the wrap-up **in order: Audit → Review Audit → Review → Docs → Review Docs → Ship** (4 phases,
6 tasks). Exact task names + blocking order:
[`planning-pipeline.md`](../skills/audit-full/references/planning-pipeline.md) §Todo Lists.

## Surface Plans in the Desktop Plan Panel

The Plan panel populates **only** on `ExitPlanMode`. For non-trivial work prefer `EnterPlanMode` →
plan → `ExitPlanMode`. Soft rule — the model decides.

## Keep Todos In Sync (Real-Time Updates)

Update tasks as you work — don't batch. The user watches the task list to understand what's happening
without re-reading every tool call.

- **Before starting**: `TaskUpdate(status: "in_progress")`.
- **Immediately after finishing**: `TaskUpdate(status: "completed")` — don't wait to "complete a group".
- **When new work surfaces mid-task**: `TaskCreate`, mark `in_progress`, resume. Don't silently fold it in.
- **When blocked**: keep the task `in_progress` and `TaskCreate` a follow-up. Never flip to `completed`
  when you didn't finish.

## "Full" Mode — Deep Recheck + Before/After Summary

When the user asks for a task `แบบ full` / "full" / "แบบละเอียด" / "deep": recheck every relevant file
thoroughly → todo list per file/section that will change → **BEFORE summary** of every file you plan to
touch + reason → execute file-by-file → **AFTER summary** (diff-level changes per file, what was skipped
as already-correct, anything flagged for manual review). Full procedure:
[`planning-pipeline.md`](../skills/audit-full/references/planning-pipeline.md) §"Full" Mode.

**Why:** "Full" is the escape hatch when the default shortcut misses nuance — before/after gives the
user a veto point before any edit lands.
