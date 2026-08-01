# Contributing

Thanks for taking a look. `exid` is small on purpose — it is 350 lines of arithmetic with a proof obligation attached, so changes are held to a high bar.

## Getting started

```bash
bun install
bun run test        # vitest
bun run typecheck   # tsc (TypeScript 7)
bun run lint        # biome, warnings fail
bun run build       # dual ESM + CJS into dist/
bun run bench
```

Full local gate, the same order CI runs:

```bash
bun run lint && bun run typecheck && bun run test:coverage && bun run build \
  && bun run check:universal && bun run check:pack && bun run test:pack
```

## The rules that matter

- **No runtime dependencies.** Ever. `exid` must stay installable into anything.
- **No Node built-ins in `src/`.** Web Crypto only — `check:universal` fails the build if a `node:` import reaches `dist/`. This is what keeps the package working on Workers, Deno and browsers.
- **The mint path allocates nothing** and touches no entropy. If a change adds an allocation or a CSPRNG call per id, it needs a benchmark showing the cost and a reason.
- **Bijectivity is not negotiable.** Anything that touches the permutation must keep `unpermute3(permute3(x)) === x` green — that test *is* the collision-freedom guarantee.
- **Public API changes need a reason.** Everything not exported from `src/index.ts` is internal and free to change; everything exported is a semver commitment.

## Commits

Conventional commits — `feat:`, `fix:`, `docs:`, `perf:`, `refactor:`, `test:`, `chore:`. The release is cut automatically from these by semantic-release, so the type you pick decides the version bump.

## Pull requests

CI must be green, including the runtime matrix (Node 18/20/22/24, Bun, Deno). If you change the algorithm, say in the PR description what property you believe still holds and which test pins it.
