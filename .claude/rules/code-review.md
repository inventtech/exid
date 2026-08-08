# Code Review Rules

Apply when reviewing pull requests, uncommitted changes, or auditing code quality.

## Entry Points

`/review` and `/code-review` are **Claude Code built-ins** and never reach this project's skills.
Project entry points: `/review-full --read-only` = read-only pass. `/review-full` = the one-command
ship-ready fix loop. Narrower variants (`/review-code`, `/review-code-fix`) carry their own
`description:` in the skill list.

> There is no `/review-ux` here — exid has no UI. A reviewer that reports a UX score is confused
> about the repo.

## Prerequisite Reading

Always: `invariants.md`, `typescript.md`, `testing.md`, `naming.md`, `git.md`.

## Review Focus Areas

1. **Invariants first** — `invariants.md`. Zero runtime deps · no `node:*` in `src/` · no allocation
   or CSPRNG call in the mint path · bijectivity · no module-level generator registry · golden vectors
   untouched · public API semver. **A violation here is Critical regardless of how clean the code is.**
2. **Correctness of the arithmetic** — 32-bit lane discipline (`| 0`, `>>> 0`), rotation counts,
   domain bounds (inclusive vs exclusive at `D1`/`D2`/`D3`), counter wrap, sign-extension bugs.
   Re-derive the math; don't pattern-match it.
3. **Portability** — anything that assumes Node, a DOM, a bundler, or a specific module system.
   The published surface must work on Node 18+, Bun, Deno, Workers, and browsers.
4. **Packaging** — `exports` map, `files`, `types` resolution for both ESM and CJS, `sideEffects`.
5. **Performance** — allocations and CSPRNG calls per mint; a claimed speedup needs `bun run bench`
   numbers in the PR, not an assertion.
6. **Testing** — `testing.md`; coverage thresholds (95/95/95/90) are a floor, not a target.
   Determinism: fixed state, restored globals, stated flake bounds.
7. **Code hygiene** — `git.md` §"No PR / issue refs in source code" and `typescript.md` §Comments
   (blocks ≤ 3 lines, file headers ≤ 5 — the math exception is real but must be about the math).

## Output Format

Summary (1-3 sentences) → Issues (Critical/Major/Warnings/Suggestions with `[file:line]`)
→ Positive Notes → Review Summary table (Invariants, Correctness, Portability, Testing, **Overall X/10**)
→ Key Recommendations table.

## Severity & Scoring

- **Critical** (-3): invariant violation, broken bijection, algorithm change without golden-vector
  justification, a `node:*` import in `src/`, a new runtime dependency, broken build
- **Major** (-1): correctness bug, perf regression in the mint path, missing tests on risky paths,
  packaging/export breakage
- **Warnings** (-0.5, max -2): convention violations
- **Suggestions**: style preference, naming nits

| Score | Meaning |
|-------|---------|
| 10 | Exemplary — ship immediately |
| 8-9.4 | Minor nits, not yet at our ≥ 9.5 bar |
| 6-7 | Needs cleanup |
| 4-5 | Major issues blocking merge |
| 1-3 | Critical — do not merge |

## Approval Threshold (STRICT)

- Score MUST be **strictly greater than 9** (i.e. **≥ 9.5**). A `9.0` is a fail; send it back.
- Zero Critical, zero Major, at most one Warning.
- Never round a score up to pass the gate.

When the gate fails, list every issue with `[file:line]` and send it back to dev.

## Review Depth

`src/` is ~400 lines. **Read every changed file end-to-end — and for a change to `exid.ts` or
`siphash.ts`, read the whole file, not just the diff.** A one-line change to a rotation constant is
invisible in a diff and fatal in context.

For every changed export: is it in `src/index.ts`? Then it's a semver commitment — check the type
signature, the doc comment, and whether the name has a matching inverse.

For every new test: meaningful assertions (no `toBeTruthy` on trivially-true values), deterministic
input, restored globals, edge cases at the domain boundaries.

## Don'ts

- Generic feedback without `file:line` — be specific
- Refactors outside changed scope
- "Simplifying" the `| 0` / `>>> 0` coercions or the preallocated buffers — that's the hot path
- Skip positive notes
- Inflate scores (3 critical issues is not 8/10)
- Approve at exactly 9.0 — the bar is `> 9`, not `>= 9`
