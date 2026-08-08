---
name: ship
description: "One-command ship pipeline — commit current changes then run the full A → R → D → S wrap-up (audit, review+fix, docs, push+PR). Use when the user says /ship, 'ship it', 'ส่งงาน', 'commit แล้ว review ให้เลย', or asks to run the full ARDS pipeline in one go. NOT for standalone /push or /review-full — those are individual steps."
---

# Ship Pipeline

Single command that commits current work and runs the full wrap-up: **A → R → D → S**.

Every phase runs **serially in the main session**, which spawns read-only agents for the review and
audit passes. `enableWorkflows` is `false` in `.claude/settings.json` — there is no fan-out engine
here, and this repo is far too small to need one.

## One-writer contract

> Review and audit agents are **READ-ONLY** — they return findings, never edits. The **main session
> is the only writer**: it applies fixes serially, commits once per phase, pushes, and opens the PR.
> This is `.claude/rules/agents.md` verbatim.

## Pre-flight (main session)

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE=$(git merge-base origin/main HEAD)
CHANGED=$(git diff --name-only "$BASE"..HEAD)
```

- If on `main` → **block**. Tell the user to create a feature branch first.
- If no uncommitted changes AND no unpushed commits → **block**. "Nothing to ship."
- Classify `CHANGED`: does it touch `src/**` (algorithm/API), packaging (`package.json`,
  `scripts/build.mjs`, tsconfig build files), or docs/config only? The classification decides which
  gates Phase A and R must run.

## Step 0 — Commit current changes

Stage and commit all uncommitted work before the pipeline starts. Conventional commit format,
auto-detected from the changed files. Skip if the tree is already clean.

```bash
git add <relevant files>
git commit -m "<type>(<scope>): <description>"
```

> **The type matters** — it becomes the release when squash-merged (`.claude/rules/git.md`).

## Phase A — Audit

1. **`/audit-config`** — only if `.claude/` was touched. Serial, main session, first (it cleans the
   tooling layer → better signal downstream).
2. **`/audit-code`** — spawn a read-only agent; scope = the changed files.
3. **`/audit-test`** — determinism, leaked globals, weakened property tests.
4. **`/review-audit`** — spawn `code-reviewer` (opus) to verify the fixes are correct. Binary
   pass/fail, max 2 rounds.

Auto-fix Critical / Major / Warning serially; defer Suggestions to user triage. One commit per
sub-skill that produced fixes: `chore(claude): #<issue> PA.1 audit-config — …`,
`refactor: #<issue> PA.2 audit-code — …`, `test: #<issue> PA.3 audit-test — …`.
Skip-when-clean: 0 findings → note "Phase A — came back clean", no commit.

## Phase R — Review (the gate loop lives here)

Gate per `.claude/rules/code-review.md`: **code ≥ 9.5 (strictly > 9)**. There is no UX gate — this
package has no UI.

```
round = 1
loop:
  spawn code-reviewer (opus) → /review-code on the branch diff
  if score > 9 AND zero Critical AND zero Major:
      PASS → break
  if round == 3:
      STOP — report gate failure, do NOT proceed to Phase D/S
  apply findings SERIALLY (verify each against source first — reject the ones the code contradicts)
  run: bun run lint && bun run typecheck && bun run test:coverage
  commit: fix: #<issue> PR — review fixes (round {round})
  round += 1
```

- **An invariant finding is never "fixed" by weakening a test.** If review flags a bijection or
  golden-vector problem, the change is wrong until proven otherwise (`.claude/rules/invariants.md`).
- Skip-when-clean: round 1 passes with no fixes → note "Phase R — came back clean", no commit.

## Phase D — Docs

1. `/update-docs` — walk all 7 tiers in
   [`update-docs/references/doc-surfaces.md`](../update-docs/references/doc-surfaces.md).
2. Verify claims against code (there is no doc-drift tool here):
   ```bash
   cat src/index.ts                                    # exports vs README API section
   jq '.dependencies // {} | length' package.json       # zero-dependency claim → 0
   bun run build && bun run examples                    # every sample actually runs
   ```
3. `/review-docs` — spawn `doc-writer` (opus). Binary pass/fail, max 2 rounds.

Commit: `docs: #<issue> PD — sync against …`. Skip-when-clean if nothing is stale.
**Never stage `CHANGELOG.md`** — semantic-release owns it.

## Phase S — Ship (serial, main session)

After A + R + D have passed (skip-when-clean noted where applicable):

1. Full gate chain must be green first:
   ```bash
   bun run lint && bun run typecheck && bun run test:coverage && bun run build \
     && bun run check:universal && bun run check:pack && bun run test:pack && bun run examples
   ```
2. `git push -u origin <branch>`
3. `gh pr create` with a body covering: summary + `closes #<issue>`, phase-commit table,
   **the release the PR title implies** (patch/minor/major/none), review notes, out-of-scope /
   follow-ups, rollback plan, test plan.
4. Ping the user **in Thai**: "PR #N พร้อม review แล้ว — `<url>`".

Never merge — the user reviews first (`/merge-pr` is a separate action). Never force-push.

## After the pipeline returns

Report to the user in Thai:

```
Ship pipeline เสร็จแล้ว 🚀

Phase A: ✅ <N findings fixed / clean>
Phase R: ✅ Code <score>/10  (round <n>)
Phase D: ✅ <N files updated / clean>
Phase S: ✅ PR #<N> — <url>
         Release: <patch | minor | major | none> (จาก PR title)
```

## Guidelines

- Run phases in order **A → R → D → S**. Each phase commits its own fixes (one commit per phase).
- If any gate fails after its max rounds, **stop and report** — do not skip ahead.
- **A red gate on a loaded machine is still a red gate here** — this suite has no parallelism-flake
  class. Don't dismiss a failure as "load"; re-run it once, then treat it as real.
- Never merge the PR — the user reviews first. Never force-push. Never hand-run a publish.
- A→R→D→S is mandatory regardless of size; skip-when-clean still applies (note
  "Phase X — came back clean" in the PR body instead of an empty commit).
