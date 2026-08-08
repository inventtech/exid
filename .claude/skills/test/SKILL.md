---
name: test
description: Run tests and checks (lint, typecheck, vitest, build, packaging gates)
argument-hint: unit|lint|build|pack|all
---

## Execute as Subagent

Spawn an Agent with `subagent_type: "test-runner"` to run the checks below. Test output can be 200+
lines — running as a subagent keeps the main context clean.

Return only the pass/fail summary to the user.

---

Run the gates for `exid`. Scope depends on the argument provided.

## Arguments

| Argument | What it runs |
|----------|-------------|
| (none) / `all` | The full CI chain: lint → typecheck → coverage → build → universal → pack → tarball → examples |
| `unit` | `bun run test:coverage` only |
| `lint` | `bun run lint` + `bun run typecheck` |
| `build` | `bun run build` |
| `pack` | build + the four `dist/`-reading gates |

## 🔴 Order is load-bearing

`check:universal`, `check:pack`, `test:pack`, and `examples` all inspect **`dist/`**, not `src/`.
Running them without a fresh `bun run build` reports on the previous code — a `node:crypto` import you
just added passes, because it isn't in the stale bundle yet. Never reorder the chain, never skip the
build.

## Scope: `all` (mirrors `.github/workflows/ci.yml`)

```bash
bun run lint            # biome, --error-on-warnings (a WARNING fails)
bun run typecheck       # tsc -p tsconfig.json (noEmit)
bun run test:coverage   # vitest + thresholds 95/95/95/90
bun run build           # dual ESM + CJS into dist/
bun run check:universal # no node: import may reach dist/
bun run check:pack      # publint --strict + attw --pack .
bun run test:pack       # install the packed tarball, mint via import AND require
bun run examples        # node ESM + CJS smoke against dist/
```

One-liner (stops at the first failure):

```bash
bun run lint && bun run typecheck && bun run test:coverage && bun run build \
  && bun run check:universal && bun run check:pack && bun run test:pack && bun run examples
```

> Never pipe the chain into `tail`/`head` — a pipeline reports the **last** command's exit code, so a
> failing gate exits 0 through the pipe (`.claude/rules/troubleshooting.md`).

## Scope: `unit`

```bash
bun run test:coverage
```

Report the coverage numbers, not just pass/fail — thresholds are 95% statements/functions/lines and
90% branches, and they **fail the run**. A pass at 95.1% is worth flagging.

## Scope: `lint`

```bash
bun run lint && bun run typecheck
```

## Scope: `build`

```bash
bun run build
```

## Scope: `pack`

```bash
bun run build && bun run check:universal && bun run check:pack && bun run test:pack && bun run examples
```

Required whenever `package.json` `exports`, `scripts/build.mjs`, or the tsconfig build files changed —
an export-map or type-resolution break passes every unit test and fails on the first consumer.

## What CI runs that you can't run locally

After `quality`, CI packs a tarball and installs it under **Node 18/20/22/24 plus Bun and Deno**.
`bun run test:pack` is the closest local proxy (one runtime, real tarball). A green local chain does
not guarantee a green matrix — an ES2023 builtin passes here and fails on Node 18.

## Report

```
Lint ✅ · Typecheck ✅ · Tests ✅ (S% F% L% B%) · Build ✅ · universal ✅ · pack ✅ · tarball ✅ · examples ✅
```

Flag prominently, never as an ordinary failure:
- **a golden-vector failure** — the algorithm's output stream moved (`.claude/rules/invariants.md`)
- **a bijection-sweep failure** — the collision-freedom guarantee is broken
- **a `check:universal` failure** — a Node built-in reached the bundle; every edge runtime is broken
