# exid Invariants — the constraints a change must not break

> These are the load-bearing properties of the package. They are not style preferences.
> Canonical prose: [`CONTRIBUTING.md`](../../CONTRIBUTING.md) §The rules that matter — this file is
> the always-loaded short form. A change that violates one of these is rejected regardless of score.

## Zero runtime dependencies — permanently

`dependencies` in `package.json` stays **empty**. Everything in `devDependencies` is build/test-only.
"It's tiny" is not an argument — the whole value proposition is that exid installs into anything.

## No Node built-ins in `src/`

Web Crypto only. **No `node:*` import may reach `dist/`** — `bun run check:universal` fails the build
if one does. This is what keeps the package working on Workers, Deno, and browsers. A `node:crypto`
import is the single easiest way to silently break every edge runtime while every local test stays green.

`bench/`, `scripts/`, `examples/` are exempt — they never ship (`files: ["dist"]`).

## The mint path allocates nothing and touches no entropy

Generating an id must not allocate or call the CSPRNG. Entropy is drawn once, at generator
construction. If a change adds a per-id allocation or CSPRNG call, it needs a benchmark
(`bun run bench`) showing the cost and a stated reason.

## Bijectivity is the collision-freedom guarantee

`unpermute3(permute3(x)) === x` must stay green for the whole domain. That test **is** the guarantee —
"structurally impossible, not merely improbable" is a claim the permutation either satisfies or doesn't.
Anything touching the permutation is reviewed against this property first.

## Never add a module-level generator registry

A memoising `exid('usr')` helper backed by a module-scope `Map` is the ergonomic API people keep asking
for, and it is a trap: a bundler that loads both the ESM and CJS build splits the registry in two, you
get two generators for one prefix, and the structural guarantee degrades to probabilistic **with no
error anywhere**.

Today the only module-scope state is scratch buffers that are fully rewritten on every call, which is
why dual-loading is harmless. If such a helper ever ships, key it off a `globalThis` symbol *and* add a
pack test that loads both copies in one process and asserts the streams stay disjoint.

## Golden vectors pin the algorithm — never regenerate them

`src/__tests__/exid-golden.test.ts` holds vectors minted by the pre-extraction implementation, which no
longer exists. Every other test still passes under a mangled PRF; these do not. **Regenerating them to
make a change pass destroys the only check that the algorithm didn't change.** If they fail, the change
is wrong until proven otherwise.

## The public API is a semver commitment

Everything exported from `src/index.ts` is public and versioned. Everything else is internal and free
to change. Adding an export is a `feat:`; changing or removing one is a breaking change.

## Dual ESM + CJS output must stay correct

`bun run check:pack` (`publint --strict` + `attw --pack .`) and `bun run test:pack` guard the
`exports` map and the type resolution for both module systems. Touching `package.json` `exports`,
`scripts/build.mjs`, or the tsconfig build files means re-running both.
