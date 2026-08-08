---
name: audit-test
description: Audit tests for quality and determinism, then optimize. Use when the user says "/audit-test" or asks to find flaky tests, it.each opportunities, or leaked globals.
---

# Audit Test Skill

Audit the vitest suite for quality issues, then apply optimizations.

## Bundling note

**Batch mode** (invoked alongside other audit/review skills): suppress the auto-commit, leave changes
staged — contract in [planning-pipeline.md §Skill-side contract](../audit-full/references/planning-pipeline.md#skill-side-contract).
Standalone: commit as today.

## Execution

Scope: `src/__tests__/*.test.ts`. The suite is small and fast — **speed is not the concern here;
determinism and honesty of the assertions are.**

## Phase 1: Profile

```bash
bun run test -- --reporter=verbose
```

The whole suite runs in seconds. Flag anything over 2s — in a suite with no I/O, a slow test usually
means an accidentally huge sweep or real entropy in a loop, not a legitimate cost.

## Phase 2: Scan

Run all 7 checks from [`references/test-patterns.md`](./references/test-patterns.md).

**Key checks:**
1. **Non-deterministic assertions** — minting from real entropy, then asserting on the output
2. **Leaked globals** — `globalThis.crypto` (or timers) replaced without an `afterEach` restore
3. **Unstated flake bounds** — a probabilistic probe with no stated failure probability
4. **`it.each` candidates** (3+ tests with identical structure, different data)
5. **Vacuous assertions** — `toBeTruthy()` on a trivially-true value, a regex that matches anything
6. **Weakened property tests** — a narrowed bijection sweep, a widened tolerance
7. **Large test files** (> 500 lines)

## Phase 3: Report

```
Test Audit Report
━━━━━━━━━━━━━━━━━━
Execution:            X tests, XXXms
Non-deterministic:    X found — file:L42 (mints from real entropy, asserts exact value)
Leaked globals:       X found — file:L15 (replaces crypto, no afterEach)
Unstated flake bound: X found — file:L88
it.each candidates:   X found — file:L42-68 (3 tests, same structure)
Vacuous assertions:   X found
Weakened properties:  X found  ← treat as CRITICAL
Large files:          X found

Total Opportunities: XX
```

## Phase 4: Apply

Priority order (highest risk first):

1. **Restore weakened property tests** — a narrowed bijection sweep is a Critical finding, not an
   optimization. Widen it back and confirm it still passes.
2. Fix non-determinism — switch to `fixedState()`, or state and justify the flake bound
3. Add missing `afterEach` restores
4. Replace vacuous assertions with real ones
5. Convert to `it.each` (readability, not speed)

After all fixes: `bun run test:coverage` — the thresholds must still pass, and coverage must not have
*dropped* (a merged `it.each` that quietly covers fewer cases is a regression).

## Guidelines

- **Never delete tests** — only refactor or merge
- **Never touch `exid-golden.test.ts`** — the vectors pin the algorithm; "cleaning them up" defeats
  their entire purpose (`.claude/rules/invariants.md`)
- **Never narrow the bijection sweep** — it is the collision-freedom witness
- Preserve test names and assertions
- `it.each` threshold: 3+ tests with identical structure. 3 clear simple tests beat 1 clever table.

## References

[`references/test-patterns.md`](./references/test-patterns.md) — full check commands, grep patterns,
and worked examples.
