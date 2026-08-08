# Planning Pipeline — Deep Dive

> **Loaded on demand** by the wrap-up skills (`/audit-full`, `/audit-config`, `/audit-code`, `/audit-test`, `/review-full`, `/update-docs`, `/push`). The lean rule at [`.claude/rules/planning.md`](../../../rules/planning.md) carries the high-level invariants every interaction needs; the doctrine deep-dives, rationale, and skill-side bundling contracts live here so they don't inflate every prompt's context budget.

## Multi-Phase Work — Doctrine Deep-Dive

### Why one PR per epic

"PR ขยะ" (junk PR) proliferation makes the merge log noisy and bisect/revert harder. Atomic-PR-per-coherent-task lets the user revert one specific concern without touching unrelated work — a related cleanup batch shipped as 3 PRs is *worse* for revert ergonomics than one PR with 3 commits.

**Standing user override:** even loosely-related cleanup batches stay on the same branch and ship in one PR. Default to bundling — do not revert to phase-per-PR unless the user explicitly asks.

**The exception this repo adds:** a change that must ship its own **semver bump** may need its own PR. A `fix:` that shouldn't wait behind an unfinished `feat:` is a legitimate split, because the squash title can only express one release type (`.claude/rules/git.md`).

### Why consolidate wrap-up into A → R → D → S

Running audit + review + docs per-phase iteratively wastes time — most issues only surface when phases interact. Consolidating into Phase A + Phase R + Phase D delivers faster (single context-switch per phase, single pass over docs) without losing the gates' rigor.

Audit-before-review prevents the reviewer from re-flagging issues that an audit pass would have auto-fixed.

### When to still split into multiple PRs

- **Unrelated scope** — a bug fix that surfaces mid-feature still goes on its own branch (see `git.md` "Split commits by scope"). The "loosely related" exemption does NOT extend to fundamentally different concerns.
- **Release type conflict** — the branch contains both a `fix:` that should publish now and a `feat:` that isn't ready. One squash title, one release type; split.
- **User explicitly asks** — if the user says "ship P1 first, then we'll do P2", treat it as the phase-per-PR flow.

## Wrap-up Skill Pipeline

> **Atomic-PR rule:** ship the cumulative output as **ONE PR with one commit per skill**, not 5 separate PRs. Same rationale as "Multi-Phase Work" — atomic-revert ergonomics, no junk-PR proliferation.

When wrap-up phases run, the pipeline is:

| Phase | Skill | Mode | Commit message convention |
|---|---|---|---|
| **PA** | `/audit-full` → `/review-audit`. Audit runs `/audit-config` + `/audit-code` + `/audit-test` sequentially. **Branch-aware:** in-ticket = scoped to `git diff main...HEAD` + auto-fix; standalone = whole-project scan + tracker issue. Then `/review-audit` verifies fixes (pass/fail, max 2 rounds). | report → auto-fix Critical/Major/Warnings; defer Suggestions; review fixes | One commit per sub-skill that produces fixes: `chore(claude): PA.1 audit-config — …`, `refactor: PA.2 audit-code — …`, `test: PA.3 audit-test — …`. Skip-when-clean per "When a phase has no fixes". |
| **PR** | `/review-full` (= `/review-code-fix`). **Does NOT run `/update-docs`** — Phase D is separate. | re-review loop, gate ≥ 9.5 | `refactor: PR review — code-fix to ≥9.5` — skip if review came back clean. |
| **PD** | `/update-docs` → `/review-docs`. Docs sync ALL 7 tiers (`update-docs/references/doc-surfaces.md`) + verify claims against code. Then `/review-docs` verifies accuracy (pass/fail, max 2 rounds). | auto-detect tier, sync docs, verify accuracy | `docs: PD update-docs — sync against P1–Pn + PA + PR` |
| **PS** | `/push` | push + `gh pr create` with full body; then ping user in Thai with PR URL. Does NOT merge — user reviews first. | NO commit (push + PR creation only) |

### `/ship` runs this pipeline serially

`enableWorkflows` is `false` and there are no bundled workflow scripts — `/ship` runs A → R → D → S
in the main session, spawning read-only agents for review and audit. The **A→R→D→S order,
skip-when-clean semantics, commit prefixes (`PA.*` / `PR` / `PD` / `PS`), the gate (code ≥ 9.5), and
the atomic-PR rule** are the contract; how fan-out happens is not. Full detail: [`ship/SKILL.md`](../../ship/SKILL.md).

### Why PD runs after PR (not bundled)

Phase R may auto-fix issues that affect docs (e.g. renamed function, removed import, changed prop signature). Running `/update-docs` separately AFTER review settles guarantees docs reflect the final shipped state — including audit-fixes from Phase A AND review-fixes from Phase R. The old `/review-full` shape (which auto-ran update-docs) skipped audit-fix coverage.

### Why PS runs after PD (not before)

The PR body should reference the FINAL state of docs (e.g. updated history.md entry, freshly synced README stats). Pushing/opening the PR before PD risks a stale PR description. PS is also non-destructive once gates have passed — push + PR creation are reversible (`gh pr close`, force-push), unlike a merge.

### Skill-side contract

Each of these 5 skills has an "auto-commit at the end" step in its standalone form. **When bundled, suppress it** — leave changes staged for the parent agent's batch commit per phase. The skill files themselves carry a "Bundling note" pointing back at this section so future invocations behave correctly.

**Detection:** the parent agent / user signals bundling by passing `--bundled` or by invoking via this rule's pattern. When in doubt, ask. When invoked standalone (single `/audit-test` from a fresh main with no other audit scheduled), commit + push + PR as today.

### Ordering rationale

Config first (cleans Claude tooling layer → better signal on subsequent audits) → code → tests (depend on cleaned code) → review (gate after auto-fixes settle) → docs (sync against everything shipped). Override only with cause — flag deviations in the plan.

### When a phase has no fixes

If a phase comes back clean (e.g. PR review gate passes 9.8/10 with no fixes needed), **skip the commit** — note "PR — review came back clean, no fixes" in the PR body instead. An empty commit adds no signal.

### Phase numbering inside a feature ticket

For feature tickets that already use P1, P2, … for impl phases, the wrap-up phases use **letter suffixes** (A, R, D) to avoid collision:

| Position | Naming | Example commit |
|---|---|---|
| Impl phase 1 | `P1` | `feat(core): #<n> P1 — permutation change + sweep` |
| Impl phase 2 | `P2` | `feat: #<n> P2 — public export + README` |
| Audit | `PA.1` (config), `PA.2` (code), `PA.3` (test) | `chore(claude): #<n> PA.1 audit-config — …`, `refactor: #<n> PA.2 audit-code — …`, `test: #<n> PA.3 audit-test — …` |
| Review | `PR` | `refactor: #<n> PR — review-code-fix to ≥9.5` |
| Docs | `PD` | `docs: #<n> PD — sync against P1–P2 + PA + PR` |
| Ship | `PS` | _no commit — push + `gh pr create`_ |

(For audit-only quality-pass sessions where there are NO impl phases, use the `P1…P5` naming from the table above — it's the same pipeline with different prefix conventions.)

## Per-Phase Detail

### Phase A — Audit + Review Audit

Auto-fix Critical / Major / Warning findings; defer Suggestions to user triage. Skip-when-clean per "When a phase has no fixes".

- **`/audit-config`** — only if `.claude/` was touched in the impl phases (settings, hooks, skills, agent definitions)
- **`/audit-code`** — invariant violations first, then code smells, dead code, magic values, per-mint allocations
- **`/audit-test`** — determinism, leaked globals, weakened property tests, `it.each` collapse
- **`/review-audit`** — after all audit fixes are staged, spawn `code-reviewer` agent (opus) to verify fixes are correct. Binary pass/fail. Max 2 rounds — if still failing, flag to user.

### Phase R — Review

Validates already-cleaned code (Phase A ran first). Gates are STRICT — do not approve below them.

1. **`/review-code-fix`** — gate per `code-review.md` Approval Thresholds (**strict > 9** / ≥ 9.5)
2. **Invariant check** — zero violations of `.claude/rules/invariants.md`, independent of the numeric score. There is no UX phase; this package has no UI.

Review is done by spawning an ad-hoc `code-reviewer` agent (opus), or by the standing pair from `/start-team`. See `agents.md`.

### Phase D — Docs + Review Docs

Run the `/update-docs` skill approach (auto-detect changes, check all tiers). One pass synced against everything shipped through Phases P1…Pn + A + R.

Tier numbering follows `update-docs/references/doc-surfaces.md` (7 tiers — canonical). Highlights:

- **Tier 1 Core**: `README.md` — the API section, the guarantee sentence, the id shape
- **Tier 2 Contributor**: `CONTRIBUTING.md` — a new invariant or a changed gate chain
- **Tier 3 Security**: `SECURITY.md` — entropy source or threat model moved
- **Tier 4 Agent context**: `CLAUDE.md`
- **Tier 5 Claude config**: `.claude/rules/*.md`, `.claude/skills/**` — keep `invariants.md` in lockstep with CONTRIBUTING.md
- **Tier 6 Executable docs**: `examples/*` — CI-checked, so they cannot silently rot
- **Tier 7 Config-as-doc**: `package.json`, `.github/workflows/ci.yml` — the runtime matrix IS the compatibility claim
- JSDoc on every public export — that's what a consumer's editor shows
- **`/review-docs`** — after all doc updates are staged, spawn `doc-writer` agent (opus) to verify accuracy. Binary pass/fail. Max 2 rounds — if still failing, flag to user.

Tests for new code are folded into the impl phase that touches the code under test (no separate "Update tests" task — batched into the relevant Pn). New impl PHASES that ship without tests should be flagged in code review.

### Phase S — Ship

After Phases A + R + D have all passed (with skip-when-clean acknowledgements where applicable), automatically run **`/push`** to push the branch and open the PR. NO commit is produced in this phase.

Pre-flight verification before invoking `/push`:

- **Gates verified**: code review ≥ 9.5, zero invariant violations, and the full local chain green
  (`lint` → `typecheck` → `test:coverage` → `build` → `check:universal` → `check:pack` → `test:pack` → `examples`)
- **No uncommitted changes**: `git status` clean
- **No unsynced commits ahead of `origin/main`** that this branch isn't aware of: `git fetch origin main && git rev-list --count HEAD..origin/main` returns 0; if non-zero, rebase first

Then:

1. `git push -u origin <branch>`
2. `gh pr create` with body covering: summary + closes-issue link, phase commit table, **the release the PR title implies** (patch/minor/major/none), issue-body deviations (if any), review notes, out-of-scope (incl. follow-up tickets), rollback plan, test plan
3. Ping user **in Thai**: "PR #N พร้อม review แล้ว — `<url>`"

**No extra confirmation needed** before push once A + R + D have passed — adding "is it ok to push?" prompts is mute when the gates have already been the gating signal. DOES still require user to **merge** the PR manually (that's a separate action handled by `/merge-pr`) — user may want to adjust the PR before merging.

Phase S is "skip-when-blocked" — if any earlier phase failed (e.g. review came back at 9.0, audit found Critical issue), DO NOT proceed to S; bounce back to whichever phase needs more work.

These phases are NON-OPTIONAL even if the change seems small. Skip-when-clean still applies per "When a phase has no fixes" — note "Phase X — came back clean, no fixes" in the PR body instead of an empty commit. (Phase S itself never has commits to skip — it just creates the PR.)

**Quick test — how deep does Phase R need to go?** Run `git diff --name-only main...HEAD -- 'src/**'` — if it's non-empty, the reviewer reads `src/exid.ts` and `src/siphash.ts` **end-to-end**, not just the hunks. Full gating rules in `.claude/rules/code-review.md`.

## Todo Lists

When creating todo lists (TaskCreate), include wrap-up tasks at the end **in order: Audit → Review → Docs → Ship**. Impl tasks first (one per Pn); tests folded into the relevant Pn (no separate "Update tests" task).

4 phases, 6 tasks (Phase A and D each include a verification sub-task):

- `Phase A — Audit` (activeForm: "Running quality audits") — blocks all subsequent.
- `Phase A — Review Audit` (activeForm: "Reviewing audit fixes") — blocked by Audit, verifies fixes are correct.
- `Phase R — Review` (activeForm: "Running review pipeline") — blocked by Review Audit, blocks Docs/Ship.
- `Phase D — Docs` (activeForm: "Updating documentation") — blocked by Review, blocks Review Docs/Ship.
- `Phase D — Review Docs` (activeForm: "Reviewing doc updates") — blocked by Docs, verifies accuracy.
- `Phase S — Ship` (activeForm: "Pushing branch + opening PR") — blocked by Review Docs. NO commit. Auto-runs after gates pass.

## "Full" Mode — Deep Recheck + Before/After Summary

When the user asks for a task `แบบ full` / "full" / "แบบละเอียด" / "deep" (especially on `/update-docs`, `/review-full`, `/audit-*`):

1. **Recheck every relevant file thoroughly** — re-read `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CLAUDE.md`, `.claude/rules/*.md`. Re-verify every claim against source.
2. **Create a todo list per file/section that will change** — user sees the plan before you start.
3. **Show a BEFORE summary** — every file you plan to touch + reason.
4. **Execute** — file-by-file.
5. **Show an AFTER summary** — diff-level changes per file, what was skipped (already correct), and anything flagged for manual review.

**Why:** "Full" is the escape hatch when the default shortcut misses nuance. Surface-level triggers and stat checks aren't enough. Before/after gives the user a veto point before any edit lands.
