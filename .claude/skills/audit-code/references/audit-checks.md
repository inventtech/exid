# Audit Code — Detailed Checks Reference

> Scope: `src/` (published surface) and `scripts/` · `bench/` · `examples/` (tooling).
>
> **🔴 Before any finding in `src/exid.ts` or `src/siphash.ts`:** read the whole file and check it
> against `.claude/rules/invariants.md`. This is arithmetic with a proof obligation. The three most
> common false findings in this repo are "redundant `>>> 0`", "unnecessary preallocated buffer", and
> "this loop could be a `.map()`" — all three are the design.

## Check 1: Magic Values (Constants Extraction)

```bash
grep -rn '[^a-zA-Z_0-9][0-9]\{3,\}' --include="*.ts" src/ scripts/ bench/
```

**Red flags:**
- A repeated bound or length literal that should be `EXID_BODY_LEN` / `D1` / `D2` / `D3`
- A retry/timeout literal in `scripts/`
- A duplicated regex for the id shape (it exists in the tests and in `scripts/pack-smoke.ts` — if a
  third copy appears, that's a finding)

**Exceptions (ignore — these are algebra, not magic):** rotation counts, round constants, odd
multipliers, mask literals (`0xff`, `0xffff`), and the SipHash initialization words. A named constant
for `0x9e3779b9` adds a lookup without adding meaning. Also ignore `0`, `1`, `-1` in loops.

---

## Check 2: Dead Code (Unused Exports)

```bash
grep -rn "export \(function\|const\|class\|interface\|type\|enum\)" --include="*.ts" src/
```

Cross-check each against `src/index.ts` and the test imports.

**Dead patterns:**
- An internal export imported by nothing (not even a test)
- Commented-out code blocks (> 5 lines)
- A helper left behind by a refactor

**Exceptions:**
- Everything re-exported from `src/index.ts` — that's the **public API**, "unused internally" is
  meaningless for it, and removing one is a breaking change
- Internals imported only by tests (`permute3`, `unpermute3`, `D1`–`D3`, `encodeBody`, `freshState`)
  — the tests are the reason they're exported. Not dead.

---

## Check 3: Code Smells & Decomposition

```bash
wc -l src/*.ts scripts/*.ts bench/*.ts | sort -rn
```

| Size | Action |
|------|--------|
| > 400 lines | SHOULD split — but only along a real seam |
| 200–400 lines | Review |
| < 200 lines | OK |

The whole package is ~400 lines of `src/`. **Splitting for the sake of a line count is a finding
against the auditor, not the code** — `siphash.ts` is one algorithm and belongs in one file.

**Function size:** > 80 lines MUST extract · 50–80 SHOULD · < 30 OK. Same caveat: an unrolled round
function is not "too long", it's unrolled on purpose. Check `bun run bench` before extracting
anything in the mint path.

**Real smells here:**
- Deeply nested conditionals (3+ levels) → early returns
- Duplicated logic between `exid.ts` and a script
- A validation branch that silently returns instead of throwing

---

## Check 4: Security Smells

- `eval()` / `new Function()`
- Hardcoded secrets or tokens (there should be none — this package takes no config)
- `any` casting to bypass validation
- **Entropy misuse**: any path that derives generator state from something other than
  `crypto.getRandomValues` (time, `Math.random`, a counter, a hash of the prefix). This is the
  security-relevant smell in this codebase — flag it P0.
- **Ids treated as secrets** in docs or samples — they are not unguessable-by-design; `SECURITY.md`
  is the place that says so.

```bash
grep -rn 'Math\.random\|Date\.now\|performance\.now' src/
```

Every hit needs a justification: entropy must come from the CSPRNG, and the mint path must not read
the clock.

---

## Check 5: Performance & Algorithmic Complexity

The mint path is the only hot path, and its budget is **zero allocations, zero CSPRNG calls**.

| Pattern in the mint path | Why it's a finding |
|---|---|
| `.map()` / `.filter()` / spread / `Array.from` | allocates per call |
| template literal built in a loop | allocates per call |
| `.slice()` on a typed array | allocates per call |
| a `new Uint8Array(...)` outside generator construction | allocates per call |
| `crypto.getRandomValues` per id | defeats the design (entropy is drawn once) |

```bash
grep -n '\.map(\|\.filter(\|\.slice(\|\.join(\|new Uint8Array\|new Int32Array\|getRandomValues' src/exid.ts
```

Outside the mint path (construction, validation, scripts) ordinary readable code is fine — don't
flag a `.map()` in `scripts/`.

**Any perf claim needs numbers.** `bun run bench` before and after, in the finding.

---

## Check 6: Consistency Issues

- Mixed error styles (throw vs return null) for the same class of failure
- Two different regexes describing the same id shape
- Inconsistent lane discipline — some paths coercing with `| 0`, adjacent ones not
- A constant defined twice (once in `src/`, once in a script or test)
- Import style drift (`.js` extension required by `nodenext` — a missing one is a build break, not a nit)

---

## Check 7: Simplification & Reuse

**Simplification opportunities:**
- Verbose conditionals → early return
- Intermediate variables used once
- `if (x) return true; else return false;` → `return x;`
- Verbose null checks where `??` suffices

**Over-engineering (remove):**
- Abstractions used in one place — inline them
- Premature generalization (an options object with one caller)
- A wrapper that only forwards

**🔴 NOT simplification here** — leave all of these alone:
- `| 0` / `>>> 0` coercions (they are the 32-bit type contract)
- Preallocated module-scope scratch buffers (they're what makes dual ESM/CJS loading safe)
- Manual index arithmetic in the encode loop (a `.map()` allocates)
- The unrolled PRF rounds

**Code tightening (safe everywhere):**
- Unused parameters / destructured variables → remove
- Empty catch blocks → comment or handle
- `async` without `await` → drop `async`
- Unused imports (biome's `noUnusedImports` catches these — a hit here means the gate wasn't run)

---

## Priority Levels

| Priority | Label | Criteria |
|----------|-------|----------|
| P0 | CRITICAL | Invariant violation, entropy misuse, a `node:` import in `src/`, a new runtime dependency |
| P1 | HIGH | Dead code, real duplication, a per-mint allocation, a correctness risk |
| P2 | MEDIUM | Magic values, code smells, consistency issues |
| P3 | LOW | Naming, minor refactors, style |

## Verification after fixes

```bash
bun run lint && bun run typecheck && bun run test:coverage && bun run build \
  && bun run check:universal && bun run check:pack
```

If anything in the mint path changed: `bun run bench` and put the before/after in the report.
