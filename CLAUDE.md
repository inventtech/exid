# CLAUDE.md

> Context file for Claude Code. Keep it concise — each line competes with actual work.

## Communication

- Respond in **Thai (ภาษาไทย)**, keep code content in **English**
- **Agent/teammate language**: English only between agents. Thai only for main session → user.
- Tone: enthusiastic, warm, concise
- **Explain at product/design altitude first** — what the change means for consumers of the package;
  go deep into the arithmetic when asked. Explanations only — the work stays technically precise.
- **No dev-slang in user-facing replies** — say it plainly in Thai. Established technical terms
  (commit, hook, mock, coverage, bijection) are fine.
- **"Remember this"**: save to `.claude/rules/`, not user memory.
- **User directives override rules**: follow the user, flag the conflict once, then proceed.

## Project Overview

**exid** — collision-free, cuid2-looking public ids with zero database dependency. A single
published npm package (~900 lines including tests). Within one generator, collisions are
**structurally impossible** — ids are a keyed bijection applied to a monotonic counter.

**Stack:** TypeScript 7 (strict) · Bun (dev) · Vitest · Biome 2.4 · dual ESM + CJS build ·
semantic-release. **Zero runtime dependencies.**

## 🔴 Invariants — read before touching `src/`

Full list + rationale: [`.claude/rules/invariants.md`](./.claude/rules/invariants.md) (always loaded)
and [`CONTRIBUTING.md`](./CONTRIBUTING.md) §The rules that matter. In short:

- **Zero runtime dependencies.** Ever.
- **No `node:*` import may reach `dist/`** — Web Crypto only (`check:universal` enforces it).
- **The mint path allocates nothing and touches no entropy.**
- **`unpermute3(permute3(x)) === x`** is the collision-freedom guarantee, not an ordinary test.
- **Never add a module-level generator registry** — a bundler loading both builds splits it in two.
- **Never regenerate the golden vectors** in `exid-golden.test.ts` to make a change pass.
- **Everything exported from `src/index.ts` is a semver commitment.**

## Commands

```bash
bun install

bun run lint            # biome — a WARNING fails, like CI
bun run typecheck       # tsc -p tsconfig.json (noEmit)
bun run test            # vitest
bun run test:coverage   # + thresholds 95/95/95/90 — this is what CI runs
bun run build           # dual ESM + CJS into dist/
bun run bench

bun run check:universal # no node: import reached dist/
bun run check:pack      # publint --strict + attw --pack .
bun run test:pack       # install the packed tarball, mint via import AND require
bun run examples        # node ESM + CJS smoke against dist/
```

**Full local gate, in CI's order** (`/test all` runs this):

```bash
bun run lint && bun run typecheck && bun run test:coverage && bun run build \
  && bun run check:universal && bun run check:pack && bun run test:pack && bun run examples
```

## Project Gotchas

- **🔴 Four gates read `dist/`** — `check:universal`, `check:pack`, `test:pack`, `examples`. Without a
  fresh `bun run build` they report on the **previous** code: a `node:crypto` import you just added
  passes because it isn't in the stale bundle yet. Never reorder the chain.
- **No git hooks** — CI is the gate. Nothing runs lint/tests for you on commit.
- **Coverage thresholds fail the run** (`vitest.config.ts`). `bun run test` can pass while
  `test:coverage` — what CI runs — fails. The fix is a test, never a lowered threshold.
- **The commit type IS the release.** semantic-release cuts the npm version from commit messages;
  `package.json` says `0.0.0-managed` for that reason. Squash-merge makes the **PR title** the
  released commit, so a `fix:` inside a `chore:`-titled PR publishes nothing.
- **Never hand-run `npm publish` / `semantic-release`** — releases ship from CI. The PreToolUse hook
  asks before either runs.
- **Never hand-edit `CHANGELOG.md`** — semantic-release owns it.
- **Pin exact dependency versions** — no `^` or `~`.
- **CI is a matrix** (quality + Node 18/20/22/24 + Bun + Deno). Green locally ≠ green there;
  `bun run test:pack` is the closest local proxy.

## Repo Layout

| Path | What |
|---|---|
| `src/index.ts` | the public API — everything here is a semver commitment |
| `src/exid.ts` | counter → permutation → encoding; the mint path |
| `src/siphash.ts` | the keyed PRF |
| `src/random.ts` | Web Crypto entropy, drawn once per generator |
| `src/__tests__/` | vitest suite (`exid-golden.test.ts` pins the algorithm) |
| `scripts/` | `build.mjs` (dual build) · `check-universal.ts` · `pack-smoke.ts` |
| `examples/` · `bench/` | executable docs (CI-checked) · benchmarks |

## Git Workflow

See [`.claude/rules/git.md`](./.claude/rules/git.md) for commit format, branch naming, release
semantics, and merge rules.

- Before PR: run the full gate chain above
- **Never push to main** — feature branches + PR
- **Stay on the current branch** — ask before opening a new PR (`git.md` §Stay on the current branch)

## Documentation

- [`README.md`](./README.md) — the primary artifact; npm renders it verbatim
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — the rules that matter (this repo's ADR log)
- [`SECURITY.md`](./SECURITY.md) — ids are identifiers, not secrets
- `.claude/rules/` — always-loaded coding rules
- `.claude/platform/wsl.md` — WSL-only rules, **not** auto-loaded; injected by the `SessionStart`
  hook only when running under WSL

## Claude Tools

Skills and agents are auto-discovered from `.claude/`.

**Harness settings** (`.claude/settings.json`):
- `permissions`: ONLY `defaultMode: bypassPermissions` — never add an `allow`/`deny` list
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` — enables `/start-team` · `teammateMode: tmux`
- `enableWorkflows: false` — `/ship` runs its phases serially in the main session
- Also pinned: `model` (opus 1m), `language: thai`, `autoCompactThreshold: 40`

**Agents:** `code-reviewer` (opus), `doc-writer` (opus), `test-runner` (sonnet), `scout` (haiku) —
ad-hoc by default, `/start-team` for a standing build+review pair. Roster + routing:
[`.claude/rules/agents.md`](./.claude/rules/agents.md).

**Hooks:** `biome-auto-fix` (PostToolUse) · `pre-tool-guard` (blocks destructive commands, asks
before a publish) · `session-start-wsl` · `session-start-compact` · `subagent-stop`.

# Compact instructions

When compacting, always preserve: current branch + issue/PR numbers, the task list state and which
A→R→D→S phase is active, unresolved review findings with `file:line`, which invariants the current
work touches, and any user decisions/overrides given this session. Drop verbatim tool outputs, file
dumps, and superseded drafts.

---

**Issues:** https://github.com/inventtech/exid/issues
