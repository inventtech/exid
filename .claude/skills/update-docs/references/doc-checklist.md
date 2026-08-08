# Doc Checklist — per change type

> Loaded on demand by `/update-docs`. Find the row that matches what changed, update every listed
> surface, then run the verification commands at the bottom.

## New or changed public export (`src/index.ts`)

- [ ] `README.md` API section — signature, params, return, one runnable example
- [ ] `examples/node-esm.mjs` + `examples/node-cjs.cjs` — if it's part of the primary usage path
- [ ] `CLAUDE.md` — only if it changes how the package is *used*, not merely what it offers
- [ ] Confirm the commit type: adding an export is `feat:`, changing/removing one is **breaking**
- [ ] JSDoc on the export itself — this is what shows in a consumer's editor

## Algorithm change (`src/exid.ts`, `src/siphash.ts`, `src/random.ts`)

- [ ] `README.md` — the guarantee sentence, the id shape, and the "how it works" prose
- [ ] `CONTRIBUTING.md` — if the change adds or removes a property contributors must preserve
- [ ] `.claude/rules/invariants.md` — mirror any `CONTRIBUTING.md` rule change
- [ ] `SECURITY.md` — if the entropy source, key derivation, or guessability story moved
- [ ] Golden vectors: confirm they still pass **unchanged**. If they had to change, the docs must say
      what changed and why, and the PR is a breaking change (the output stream moved)
- [ ] `bench/` numbers quoted anywhere — re-run `bun run bench` or delete the figures

## Packaging change (`package.json` exports/files, `scripts/build.mjs`, tsconfig build files)

- [ ] `README.md` install + import instructions (ESM/CJS, deep imports if any)
- [ ] `package.json` `description` / `keywords` — still accurate?
- [ ] `CONTRIBUTING.md` local gate chain — did the command list change?
- [ ] Verify with `bun run build && bun run check:pack && bun run test:pack`

## Runtime support change (`engines`, `lib`/`target`, CI matrix)

- [ ] `README.md` supported-runtimes statement
- [ ] `package.json` `engines`
- [ ] `.github/workflows/ci.yml` matrix — **these three must agree**; the matrix is the real claim
- [ ] `CONTRIBUTING.md` — if the local toolchain requirement changed

## New gate / CI job

- [ ] `CONTRIBUTING.md` §Getting started — the local command chain, in CI's order
- [ ] `CLAUDE.md` §Commands
- [ ] `.claude/skills/test/SKILL.md` — the scope tables and the one-liner
- [ ] `.claude/agents/test-runner.md` — the gate list
- [ ] `.claude/rules/testing.md` §Scope — if it's a new *class* of check

## Claude config change (`.claude/**`)

- [ ] `CLAUDE.md` — only if the change alters how a session behaves by default
- [ ] The skill/rule's own cross-references — a moved file breaks every link to it
- [ ] `.claude/rules/invariants.md` ↔ `CONTRIBUTING.md` lockstep, if invariants were touched

## Docs-only change

- [ ] Every code sample still runs (`bun run build && bun run examples`)
- [ ] Every relative link resolves
- [ ] No new probabilistic hedge on the collision claim, no new unsourced number

## Verification commands

```bash
# exports vs README API section
cat src/index.ts

# id shape constants
grep -n 'EXID_BODY_LEN' src/exid.ts

# runtimes: engines vs CI matrix
grep -n '"engines"' -A3 package.json
grep -n "node:\s*\[" .github/workflows/ci.yml

# zero-dependency claim
jq '.dependencies // {} | length' package.json     # must print 0

# samples actually run
bun run build && bun run examples

# dead relative links in root docs
grep -oE '\]\(\.?/?[A-Za-z0-9_./-]+\.md[^)]*\)' *.md .claude/**/*.md 2>/dev/null | sort -u
```

> An empty grep result is not evidence — re-run it a second way before concluding a surface is clean
> (`.claude/rules/troubleshooting.md`).
