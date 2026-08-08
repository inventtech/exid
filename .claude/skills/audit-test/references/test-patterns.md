# Audit Test — Detailed Patterns Reference

Scope: `src/__tests__/*.test.ts` (vitest).

## Check 1: Non-deterministic assertions 🔴

The suite's determinism comes from asserting against a **fixed `ExidState`**, not a freshly-minted
generator. A test that mints from real entropy and then asserts on the output is a flake.

```bash
grep -n 'createExid(' src/__tests__/*.test.ts        # which call sites use real entropy?
grep -n 'fixedState\|createExidFromState' src/__tests__/*.test.ts
```

```typescript
// ❌ real entropy + exact assertion — passes today, fails eventually
const id = createExid('usr')();
expect(id).toBe('usr_k3f...');

// ✅ fixed state — fully deterministic
const gen = createExidFromState('usr', fixedState());
expect(gen()).toBe('usr_k3f...');

// ✅ real entropy + a SHAPE assertion is fine
expect(createExid('usr')()).toMatch(/^usr_[a-z][a-z0-9]{23}$/);
```

**Rule:** real entropy may only be paired with a shape/property assertion, or with a stated flake
bound (Check 3).

---

## Check 2: Leaked globals 🔴

`random.test.ts` swaps `globalThis.crypto` via `Object.defineProperty`. A swap without a restore
poisons **every later test file in the same worker** — the failure surfaces somewhere else entirely.

```bash
grep -rln 'defineProperty\|globalThis\.\|vi\.spyOn\|vi\.useFakeTimers' src/__tests__/
```

Cross-check each hit has a matching `afterEach` restore (or `vi.useRealTimers()`).

```typescript
const realCrypto = globalThis.crypto;
afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true, writable: true });
});
```

---

## Check 3: Unstated flake bounds

Where randomness genuinely IS the property under test (entropy/distribution probes), mocking it would
be vacuous — so the real CSPRNG is allowed. The price is an explicit bound.

```bash
grep -n -B2 'randomKey()\|randomBelow(' src/__tests__/*.test.ts
```

Every such probe needs a comment stating the failure probability, and it must be ≪ 1e-15. A probe
with no stated bound is a finding — either compute it or make the test deterministic.

---

## Check 4: `it.each` candidates

Detect 3+ consecutive `it()` blocks in one `describe()` that call the same function, assert the same
matcher, and differ only in input/expected values.

```typescript
// AFTER: tagged template literal for multi-column tables
it.each`
  label             | prefix
  ${'empty'}        | ${''}
  ${'too long'}     | ${'x'.repeat(64)}
  ${'non-alpha'}    | ${'1st'}
`('should reject a $label prefix', ({ prefix }) => {
  expect(() => createExid(prefix)).toThrow();
});
```

Plain array syntax is the convention for single-parameter lists.

**Threshold:** 3+ tests with identical structure. 2 similar tests are fine as-is.

---

## Check 5: Vacuous assertions

```bash
grep -n 'toBeTruthy()\|toBeDefined()\|not\.toBeNull()' src/__tests__/*.test.ts
```

Red flags in this codebase specifically:
- `expect(id).toBeTruthy()` — every non-empty string passes; assert the **shape**
- a body regex without anchors (`/[a-z0-9]{23}/` matches inside a longer string — needs `^…$`)
- `expect(result).toBeDefined()` after a function that cannot return `undefined`

---

## Check 6: Weakened property tests 🔴 CRITICAL

The bijection sweep (`unpermute3(permute3(x)) === x`) is the witness for the package's central claim.
Compare against `git log -p` on the test file:

```bash
git log -p --follow src/__tests__/exid.test.ts | grep -nE '^[-+].*(for \(|i <|30_000|mismatches)'
```

Findings, all Critical:
- the iteration count was reduced
- the sweep's domain coverage was narrowed (fewer lattice points, one domain dropped)
- a tolerance/allowance was introduced (`mismatches < N` instead of `=== 0`)
- the golden vectors in `exid-golden.test.ts` were regenerated

**None of these are optimizations.** Restore and re-run.

---

## Check 7: Large test files

```bash
wc -l src/__tests__/*.test.ts | sort -rn
```

Flag > 500 lines as split candidates. Keep the prefix-clustering convention when splitting
(`exid.test.ts` → `exid-golden.test.ts`, per `.claude/rules/naming.md`).

---

## Optimization Priority Order

1. Restore weakened property tests (Critical)
2. Fix non-determinism / add missing global restores
3. Replace vacuous assertions
4. Convert to `it.each`
5. Split large files

---

## Guidelines

- **Never delete tests** — only refactor or merge
- **Never regenerate golden vectors**, never narrow the bijection sweep
- **Preserve test names** — keep the `should X when Y` format
- **Re-run `bun run test:coverage` after changes** — coverage must not drop; a merged `it.each` that
  covers fewer cases is a regression, not a cleanup
- **Don't over-optimize** — 3 clear simple tests beat 1 clever `it.each` that's hard to read
