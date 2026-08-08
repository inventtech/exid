# Testing Rules

## Scope

- **Unit (`src/__tests__/*.test.ts` — Vitest):** the only test suite. Required for every behaviour change.
- **Gates beyond unit tests** — all four are CI-blocking and none of them is `vitest`:
  `check:universal` (no `node:*` in `dist/`), `check:pack` (`publint --strict` + `attw --pack`),
  `test:pack` (installs the packed tarball and mints an id), `examples` (ESM + CJS smoke).
- **Runtime matrix** — CI packs a tarball and installs it under Node 18/20/22/24 plus the edge
  runtimes. A change can be green locally and red there; that matrix is the real portability check.

```bash
bun run test              # vitest run
bun run test:watch
bun run test:coverage     # thresholds: 95% statements/functions/lines · 90% branches
```

Coverage thresholds live in `vitest.config.ts` and **fail the run**, not just report. `src/__tests__/**`
is excluded from the measured set.

## Conventions

- **Determinism by construction.** Assertions run against a **fixed `ExidState`** (hardcoded key +
  boot words), not a freshly-minted generator — see the `fixedState()` helper in `exid.test.ts`.
  A test that mints from real entropy and then asserts on the output is a flake waiting to happen.
- **Randomness is only tested where randomness IS the property.** `random.test.ts` swaps
  `globalThis.crypto` via `Object.defineProperty` and **restores it in `afterEach`** — a leaked stub
  poisons every later file in the same worker. Any test that replaces a global restores it.
- **State the flake bound.** Where a probe genuinely uses real entropy (body-entropy / distribution
  probes), the comment must state the failure probability and it must be ≪ 1e-15.
- One assertion per test. Descriptive names: `should round-trip every point of a deterministic sweep`.
- Test edge cases: domain boundaries (`D1`/`D2`/`D3`), counter wrap, empty/oversized prefix, the first
  and last valid body character.

## The bijection test is not an ordinary test

`unpermute3(permute3(x)) === x` over a deterministic sweep is the **witness for the package's central
claim**. Treat it as a proof obligation:

- Never narrow its sweep to make a change pass.
- If a permutation change makes it fail, the change is wrong — not the test.
- A new permutation variant needs its own sweep, not a widened tolerance.

## Golden vectors — never regenerate

`exid-golden.test.ts` pins the exact algorithm against vectors from the pre-extraction implementation.
Every other test passes under a mangled PRF; these do not. Regenerating them to make a change pass
silently deletes the only check that the output stream didn't move. See `invariants.md`.

## Don'ts

- Never regenerate golden vectors to make a change pass
- Never assert on real-entropy output without a stated, negligible flake bound
- Never leave a swapped global (`crypto`, timers) unrestored
- Never lower a coverage threshold to land a change — add the test
- Never import from `dist/` in a unit test — unit tests test `src/`; `test:pack` covers the built artifact
