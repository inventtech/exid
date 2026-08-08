---
name: review-docs
description: "Review documentation updates for accuracy, reference hygiene, and conciseness (docs load into context — wordiness has a token cost). Verifies docs match code, claims aren't over-stated, no stale refs. Spawns doc-writer agent (opus). Use when the user says /review-docs, or automatically after Phase D in the wrap-up pipeline."
---

# Review Documentation Updates

Verify that Phase D documentation updates (from `/update-docs`) are accurate, complete, and match the
actual shipped code. This is the quality gate for docs.

## When to Run

Always after Phase D completes (even if update-docs "came back clean" — verify the claim).
Pipeline: **P1→Pn → A → review-audit → R → D → review-docs → S**

## Bundling note

When invoked as part of the wrap-up pipeline, suppress auto-commit — leave changes staged.
If issues are found, fix them in-place and re-stage.

## Execute as Subagent

Spawn an Agent with `subagent_type: "doc-writer"` and `model: "opus"`.

**Why opus for doc review:** docs are a trust surface, and this package's central claim is
mathematical. Sonnet reliably misses a guarantee that has quietly widened by one adjective.

## Step 1 — Gather Doc Changes (+ reverse-drift scope)

```bash
git diff --cached --stat -- '*.md'
git diff --cached -- '*.md'
```

**Reverse-drift scope:** docs the PR *didn't* touch can still be invalidated by code it *did* touch.
Collect the changed code files (`git diff origin/main...HEAD --name-only -- '*.ts' '*.mjs' '*.json'`),
then grep `*.md` + `.claude/**` for their basenames and for renamed/removed exported symbols — any doc
referencing them joins the review scope.

**Explicit trigger — the lockstep pairs.** If the diff touches either side of a pair from
[`doc-surfaces.md` §Cross-file consistency pairs](../update-docs/references/doc-surfaces.md), pull
**both** sides into scope:

- `CONTRIBUTING.md` §The rules that matter ↔ `.claude/rules/invariants.md`
- README supported-runtimes ↔ `package.json` `engines` ↔ CI matrix
- README API section ↔ `src/index.ts`

A rule changed on only one side is a Completeness fail, not a nit.

If no staged doc changes AND no reverse-drift hits AND update-docs reported "came back clean" →
report "Phase D clean — no doc changes to review" and pass.

## Step 2 — Review Focus Areas

| Risk | What to check |
|------|---------------|
| **🔴 Claim scope** | Is collision-freedom still described as **structural, within one generator**? Flag any dropped scope ("exid never collides") AND any probabilistic hedge ("virtually impossible") — both are wrong, in opposite directions. **Critical, always.** |
| **Code-doc sync** | Verify EVERY cheap-to-check concrete claim against source with Grep/Read — exported names + signatures (`src/index.ts`), id shape (`EXID_BODY_LEN`, the body regex), script names (`package.json`), runtime versions (CI matrix), dependency count. A claim that contradicts source = Critical. Never trust a code comment over the code itself. |
| **Runnable samples** | Does every README snippet actually run? `bun run build && bun run examples` must pass, and a snippet that can't be lifted from a passing example must be executed before it ships. |
| **Unsourced numbers** | Benchmark figures without a stated `bun run bench` + hardware; "X% faster" claims; size claims. Remove or source them. |
| **File path validity** | Do all `[link](path)` refs point to files that exist? |
| **Completeness** | Were all relevant tiers updated? (`doc-surfaces.md` — 7 tiers, each explicitly covered or marked N/A) |
| **Duplicate / redundant refs** | Is the same fact stated in 2+ docs? It should live in ONE canonical spot; the others link to it. (The invariants pair is a deliberate exception — it's mirrored on purpose and must stay in lockstep.) |
| **Conciseness (context economy)** | Does every line earn its place? Flag verbose phrasing and over-explanation. Propose tighter wording keeping the **full meaning** (concise ≠ lossy). Docs load into context — wordiness has a real token cost. |
| **CHANGELOG untouched** | `CHANGELOG.md` is semantic-release-owned. A hand edit in the diff = automatic fail. |

## Step 3 — Automated Checks

There is no doc-drift tool here; run these directly:

```bash
jq '.dependencies // {} | length' package.json                # zero-dependency claim → must be 0
cat src/index.ts                                              # exports vs README API section
grep -n '"engines"' -A3 package.json; grep -n "node:" .github/workflows/ci.yml
bun run build && bun run examples                             # every sample runs
grep -oE '\]\(\.?/?[A-Za-z0-9_./-]+\.md[^)]*\)' *.md .claude/**/*.md | sort -u   # link targets
```

Any dead link, any failed example, any mismatch in the lockstep pairs = automatic fail.

## Step 4 — Scoring

Binary pass/fail. Any issue = fail, fix and re-review.

## Step 5 — Report

```markdown
## Review Docs — Report

Files reviewed: X docs changed
Tiers covered: 1 core / 2 contributor / 3 security / 4 agent / 5 claude-config / 6 examples / 7 config-as-doc

| Check | Status |
|-------|--------|
| Claim scope (structural, per-generator) | pass / fail |
| Code-doc sync | pass / fail |
| Runnable samples | pass / fail |
| Unsourced numbers | pass / fail |
| File path validity | pass / fail |
| Completeness (7 tiers) | pass / fail |
| Duplicate / redundant refs | pass / fail |
| Conciseness (context economy) | pass / fail |
| Lockstep pairs in sync | pass / fail |
| CHANGELOG untouched | pass / fail |

Issues: (if any, with file path + description)

Result: PASS / FAIL
Ready for Phase S: Yes / No
```

## Guidelines

- **Binary pass/fail** — no numeric score.
- **A widened guarantee is Critical, not a wording nit.** It is the one doc defect in this repo that
  costs users correctness rather than clarity.
- **Conciseness is a real gate** — a wordy doc that's "accurate" still fails if it could say the same
  in fewer words. Suggest the tighter rewrite inline; never drop meaning to hit brevity.
- **Scope = doc diff + reverse-drift hits** — don't review impl code itself (Phase R did that); read
  source only to verify doc claims.
- **Verify findings before fixing** — the main session re-checks each Critical/Major against source
  before editing; reject findings the code contradicts.
- **Fix in-place** — main session fixes, re-stages, re-runs this review.
- **Reviewer is READ-ONLY** — the agent only reports, never edits.
- **Max 2 rounds** — if still failing after 2 fix rounds, flag to the user.
