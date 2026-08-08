---
name: update-tests
description: Analyze recent changes and add/update vitest unit tests. Use when the user says "/update-tests" or asks to add test coverage for recent changes.
---

# Update Tests Skill

Analyze recent code changes and ensure unit-test coverage is complete. Write smart, optimized tests.

> Coverage thresholds (95% statements/functions/lines, 90% branches — `vitest.config.ts`) **fail the
> run**. Uncovered new code is a red gate, not a warning.

## Execution

Run in the main session — this repo is small enough that a subagent costs more than it saves. Return
a summary: tests added + coverage before → after.

## Workflow

### 1. Discover What Changed

```bash
git diff --name-only HEAD~5
git diff --cached --name-only
git -c color.status=false status --short
```

### 2. Find the Coverage Gap — measure, don't guess

```bash
bun run test:coverage
```

Read the per-file report. A file at 100% lines can still have an untested branch — check the branch
column, and check that the *behaviour* is covered, not just the line.

### 3. Write the Tests

Test files live in `src/__tests__/`, named after the module they cover (`siphash.test.ts`), with
`exid-golden.test.ts` as the prefix-clustered sibling per `.claude/rules/naming.md`.

Non-negotiables from `.claude/rules/testing.md`:

- **Deterministic input.** Assert against a fixed `ExidState` (hardcoded key + boot words) — the
  `fixedState()` helper in `exid.test.ts`. Never mint from real entropy and then assert on the output.
- **Restore any swapped global** in `afterEach` — `random.test.ts` replaces `globalThis.crypto` via
  `Object.defineProperty`; a leaked stub poisons every later file in the worker.
- **State the flake bound** where real entropy is genuinely the property under test, and keep it ≪ 1e-15.
- **One behaviour per test.** Descriptive name: `should reject a prefix longer than the limit`.

Edge cases this codebase actually needs: domain boundaries (`D1`/`D2`/`D3`, inclusive vs exclusive),
counter wrap, empty/oversized prefix, the first and last valid body character, sign extension on the
32-bit lanes.

**Never touch `exid-golden.test.ts` to make a change pass.** Those vectors pin the algorithm; a
failure there means the output stream moved (`.claude/rules/invariants.md`).

### 4. Run

```bash
bun run test:coverage
bun run test -- src/__tests__/<file>.test.ts    # single file while iterating
```

### 5. Report

```
Tests Added: +X
Behaviours now covered: <list>
Coverage: S% → S% · F% → F% · L% → L% · B% → B%
Gaps: <if any, with reason>
```

## What this skill does NOT cover

`test:pack`, `check:universal`, `check:pack`, and `examples` are gates, not unit tests — they exercise
the built artifact and the published export map. If the change touches packaging, run `/test pack`;
no amount of vitest coverage substitutes for it.
