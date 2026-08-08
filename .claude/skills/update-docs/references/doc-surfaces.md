# Doc Surfaces — the 7 tiers

> Loaded on demand by `/update-docs` and `/review-docs`. Walk **every** tier; mark the ones that don't
> apply as "Tier X — N/A" explicitly rather than skipping them silently.

`exid` is a single published package with no `docs/` directory. Every doc surface below is either a
root-level markdown file, executable code, or configuration that a consumer reads as documentation.

| Tier | Surface | Update when | Notes |
|---|---|---|---|
| **1 — Core context** | `README.md` | Public API changed · guarantee wording · id shape · supported runtimes · install/usage | The primary artifact. npm renders it verbatim — a wrong claim here reaches every consumer. |
| **2 — Contributor rules** | `CONTRIBUTING.md` | A new invariant · a changed gate · a changed local command chain | §"The rules that matter" is this repo's ADR analogue (see `/update-docs` Phase 2.5). |
| **3 — Security** | `SECURITY.md` | Entropy source changed · threat model changed · a reported vulnerability class becomes relevant | Ids are **not** secrets — if a change makes them look guessable-relevant, this file must say so. |
| **4 — Agent context** | `CLAUDE.md` | Commands changed · project shape changed · a new always-loaded constraint | Stays lean — every line costs context on every session. |
| **5 — Claude config** | `.claude/rules/*.md`, `.claude/skills/**`, `.claude/agents/*.md` | A workflow, gate, or invariant changed | `invariants.md` must stay in lockstep with `CONTRIBUTING.md`. Both or neither. |
| **6 — Executable docs** | `examples/*.mjs`, `examples/*.cjs`, `bench/bench.ts` | Public API changed · usage pattern changed | **CI-checked** (`bun run examples`). These are the only samples guaranteed to work — prefer linking them over inventing snippets. |
| **7 — Config-as-doc** | `package.json` (`description`, `keywords`, `engines`, `exports`, `files`), `.github/workflows/ci.yml` | Runtime support changed · entry points changed · a gate added | The CI matrix **is** the compatibility claim. If the README says "Node 18+", the matrix must test 18. |

## Auto-generated — never hand-edit

| File | Owner | Why |
|---|---|---|
| `CHANGELOG.md` | `semantic-release` (`.releaserc.json`) | Regenerated and committed on every release; a hand edit is overwritten and can conflict with the release commit. |
| `dist/**` | `scripts/build.mjs` | Deleted and re-emitted on every build. |
| `coverage/**` | vitest | Regenerated per run. |

## Tier-1 README anatomy

The README carries four things that drift independently — check each separately:

1. **The guarantee sentence** — structural, within one generator. Scope intact? (`/update-docs` §The claim)
2. **The API section** — must match `src/index.ts` exactly. An undocumented export is as wrong as a documented non-export.
3. **The id shape** — prefix rules, body length (`EXID_BODY_LEN`), alphabet, the leading-letter constraint. All greppable from `src/exid.ts`.
4. **The comparison table** (vs uuid/nanoid/cuid2) — the most over-claim-prone region. Every cell needs a source.

## Cross-file consistency pairs

These pairs say the same thing in two places and drift silently. Check them together, always:

| A | B |
|---|---|
| `CONTRIBUTING.md` §The rules that matter | `.claude/rules/invariants.md` |
| README "supported runtimes" | `.github/workflows/ci.yml` matrix + `package.json` `engines` |
| README API section | `src/index.ts` exports |
| README id-shape prose | `EXID_BODY_LEN` + the body regex in the tests |
| README "zero dependencies" | `package.json` `dependencies` (must be `{}` / absent) |
