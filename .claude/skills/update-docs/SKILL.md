---
name: update-docs
description: Update documentation after code changes. Use when the user says "/update-docs" or asks to sync docs after changing the API, the algorithm, or the packaging.
---

# Update Docs Skill

Update documentation to keep it in sync with code changes.

## Bundling note

**Batch mode** (invoked alongside other audit/review skills): suppress the auto-commit, leave changes
staged — contract in [planning-pipeline.md §Skill-side contract](../audit-full/references/planning-pipeline.md#skill-side-contract).
Standalone: commit as today.

## Execution

Spawn an Agent with `subagent_type: "doc-writer"` and `run_in_background: true`. **Exception:** when
running as pipeline Phase D (inside `/ship`), run synchronously so the Phase S pre-flight sees the
final docs.

Immediately tell the user: "กำลัง update docs อยู่ background ครับ พอเสร็จจะแจ้งให้ทราบ!"

**Scope argument:** if empty, auto-detect from `git diff`.

## Phase 1: Auto-Detect Changes

```bash
BASE=$(git merge-base origin/main HEAD 2>/dev/null || echo HEAD~5)
git diff --name-only $BASE..HEAD -- . ':!node_modules' ':!bun.lock' | sort -u
git diff --name-only HEAD -- . ':!node_modules' ':!bun.lock' | sort -u
```

Classify into: `api-surface` (`src/index.ts` exports changed), `algorithm` (`src/exid.ts` /
`src/siphash.ts` / `src/random.ts`), `packaging` (`package.json`, `scripts/build.mjs`, tsconfig build
files), `ci`, `claude-config`.

## Doc surfaces checklist (mandatory)

**Every doc update MUST walk through [`references/doc-surfaces.md`](./references/doc-surfaces.md) —
7 tiers.** Skip a tier explicitly with "Tier X — N/A" rather than silently.

## 🔴 The claim is the documentation's main risk

This package's headline is a **mathematical** claim. The most likely doc defect here is not a stale
number — it's a sentence that quietly widens the guarantee:

- collision-freedom is **structural, within one generator instance**. Any phrasing that drops the
  scope ("exid never collides") is wrong and must be fixed even if it reads better.
- never hedge it in the other direction either ("virtually impossible", "astronomically unlikely") —
  that's the cuid2/nanoid claim, not this one.
- benchmark figures need an actual `bun run bench` and stated hardware, or they get removed.

## 🔴 MANDATORY: Review pass after every doc update

**Every doc update MUST be followed by a review pass** before the work is complete — both
`/update-docs` macro invocations (Phase D) and standalone doc edit batches.

1. After the doc-writer agent completes its commit
2. Spawn `/review-docs` OR a fresh `doc-writer` agent (opus): "Review docs in commits <SHAs>. Verify
   every claim, signature, and number against the actual code. Flag over-claims / under-claims /
   stale refs / non-runnable samples. Max 2 fix rounds."
3. Wait for a pass (no Major findings) before considering Phase D complete

**Why:** the author and reviewer should not be the same agent — doc drafts ship with over-claimed
guarantees, dead refs, and samples that no longer compile otherwise.

**Skip-when-clean:** if doc changes are trivial (typo, single cross-ref), note "review-docs — trivial,
skipped" but still verify links resolve.

## Phase 2: Documentation Tiers

Canonical tier list lives in [`references/doc-surfaces.md`](./references/doc-surfaces.md) — walk it
tier by tier. Highest-frequency surfaces: `README.md` (the API section + the guarantee statement),
`CONTRIBUTING.md` (§The rules that matter), `CLAUDE.md`, `.claude/rules/invariants.md`, and the
executable `examples/`.

See [`references/doc-checklist.md`](./references/doc-checklist.md) for per-change-type checklists.

## Phase 2.5: Invariant Check (this repo's ADR analogue)

exid has no `docs/adr/`. The equivalent record is **`CONTRIBUTING.md` §The rules that matter**,
mirrored in `.claude/rules/invariants.md`.

**Add an entry only when ALL THREE are true:**

1. **Hard to reverse** — undoing it later is a breaking change or a re-audit of the algorithm
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth?"
3. **Result of a real trade-off** — there were genuine alternatives

**Triggers:** a rejected-on-purpose API shape (the module-level registry is the precedent), a new
structural guarantee, a deliberate portability constraint, a decision to NOT use something.

**If a trigger fires:** add the rule to `CONTRIBUTING.md` in the same voice as the existing entries
(what the trap is, why it's silent, what would have to be true to allow it), then mirror the short
form into `.claude/rules/invariants.md`. Both, or neither — a rule in only one place drifts.

**If none fires:** note "No new invariants this batch" and skip. Don't manufacture rules.

## Phase 3: Verify Claims Against Code

There is no stats-sync tool here — the counts are small enough to check directly, and every one of
these has a single source of truth in code:

```bash
# exported API surface — the README's API section must match this exactly
cat src/index.ts

# id shape: prefix + body length + alphabet — grep the constant, don't trust the prose
grep -n 'EXID_BODY_LEN\|BODY_RE\|ID_RE' src/exid.ts src/__tests__/*.ts scripts/pack-smoke.ts

# supported runtimes — the CI matrix IS the compatibility claim
grep -n "node:\s*\[" .github/workflows/ci.yml
grep -n '"engines"' -A3 package.json

# dependency count — the README's "zero dependencies" claim
jq '.dependencies // {} | length' package.json    # must be 0
```

Any number in the docs that isn't derivable from one of these is a guess — remove it or verify it.

## Phase 4: Sample Verification

Code samples in `README.md` must be real. The `examples/` directory is executable and CI-checked:

```bash
bun run build && bun run examples
```

Prefer pointing at `examples/node-esm.mjs` / `examples/node-cjs.cjs` over inventing a snippet. If a
README snippet can't be lifted from a passing example, run it before shipping it.

## Phase 5: Commit & Report

```bash
git add README.md CONTRIBUTING.md SECURITY.md CLAUDE.md .claude/ examples/
git commit -m "docs: update documentation"
```

> **Never hand-edit `CHANGELOG.md`** — semantic-release owns it (`.releaserc.json`). An edit is
> overwritten on the next release and can conflict with the release commit.

Report format:
```
Documentation Update Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scope: <auto-detected>
Updated:   file — what changed
Verified:  exports: X | body len: X | runtimes: X | deps: 0
Skipped:   file — already up to date
Needs manual review: file — reason
```
