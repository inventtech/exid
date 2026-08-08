# Git Rules

## Workflow

- **Always rebase**: `git pull --rebase origin main`
- **Pull the current branch = plain `git pull --rebase`** (uses the branch's upstream). Do NOT build
  `git pull --rebase origin "$BRANCH"` from a captured var — under `wsl.exe -- bash -ic`,
  `BRANCH=$(git …)` command-substitution can return **empty**, so it becomes `origin ""` and silently
  rebases onto `main`. If you need the branch name, run the subcommand inline, don't capture-then-interpolate.
- **Never push to main** — always use feature branches + PR
- **Squash merge only** when merging PRs
- **Branch naming**: `feat/add-decode-helper`, `fix/permutation-roundtrip`, `chore/upgrade-biome`

## Stay on the current branch — ask before opening a PR

> **User directive — overrides the "split unrelated work into its own branch/PR" defaults below
> + in `planning.md`. When they conflict, this wins.**
> Do NOT autonomously create a branch, push, or open a PR. Default to the branch already checked out.

- **A branch / open PR is already checked out → ASK before opening a _new_ PR.** Never branch off
  `main` and open a separate PR on your own — even for clearly-unrelated work. Surface the choice
  ("commit to the current branch, or start a new one?") and let the user decide.
- **No explicit "push" / "ship" instruction → don't push and don't open a PR.** Just commit to the
  **current** branch (or leave the change uncommitted).
- When in doubt, keep the change on the current branch and ask — bias toward _less_ git autonomy.

## Commit Format

```
<type>(<scope>): <subject>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

**Scopes** (optional — this is a single-package repo, so a bare type is usually right):
`core` (`src/`), `docs`, `ci` (`.github/`), `bench`, `scripts`, `examples`.

**Examples**: `feat: add a decode helper`, `fix(core): keep permute3 bijective at the domain edge`,
`chore: upgrade biome`

## 🔴 The commit type IS the release

`semantic-release` cuts the npm version straight from commit messages on `main` — there is no
manual version bump, and `package.json` says `0.0.0-managed` for exactly that reason.

- `fix:` → patch · `feat:` → minor · `BREAKING CHANGE:` footer (or `feat!:`) → major
- `chore:` / `docs:` / `test:` / `refactor:` / `style:` → **releases nothing**
- **Squash-merge makes the PR TITLE the released commit.** semantic-release only ever sees the
  squash commit — `fix:` commits inside a `chore:`-titled PR ship **no release**. If the branch must
  publish, the PR title itself must be `fix(...)` / `feat(...)`.
- Never hand-run `npm publish` or `semantic-release` — releases ship from CI only (the PreToolUse
  hook will ask before letting either run).

## Commit / PR / issue body files → `/tmp/`, never `.git/`

Multiline or special-char payloads go through a file (`git commit -F <f>`, `gh pr create --body-file <f>`,
`gh issue comment --body-file <f>`) — not inline (parens in `fix(core):`, quotes, arrows break under WSL
zsh; see `troubleshooting.md`). Write that scratch file to **`/tmp/`** with an absolute path (e.g.
`/tmp/exid-pr-body.md`) and delete it after. **Never write it under `.git/`** — it abuses git's plumbing
dir and a relative path there resolves unpredictably. `/tmp/` is unambiguous, never staged by `git add`,
and leaves no `git status` noise.

## Split commits by scope — when work is UNRELATED

Split when scopes are **unrelated** — bundle when they're **phases of one coherent task**
(see `planning.md` §Multi-Phase Work).

**Split (separate branches + PRs)** when:
- A **security** bug surfaces mid-feature — ask the user first, then carve onto its own branch off `main`.
- The user explicitly says "do this in its own PR".
- A change must release on its own semver bump (a `fix:` that shouldn't wait behind an unfinished `feat:`).

**Bundle (one branch + multiple commits + ONE PR)** when:
- Multi-phase work (P1–P4 of the same issue).
- Related issues touching the same surface — one commit per issue, ONE PR closing both.
- Tightly-coupled refactor + the doc updates that describe it.
- Trivial reformats coupled to the scope (biome autofix on a file you're already touching).

**Heuristic:** "if this gets reverted, should it revert as ONE atomic unit?" — usually yes. Bundle.

## No PR / issue refs in source code

**Don't pollute source (`.ts`, `.mjs`, `.sh`) with PR-tracking comments** (`// #NNNN P2 — …`,
`// PR #NNNN — …`, `// Tracked in #NNNN.`). Git blame, the commit message, and the PR body already
record *when* and *why*.

| Context | Home |
|---|---|
| What changed in this commit | Commit message |
| What changed in this PR (and why this approach) | PR body |
| A load-bearing invariant future contributors must not break | `CONTRIBUTING.md` §The rules that matter |
| Why-this-design at the call site | Code comment WITHOUT the PR number |

**OK in source:** docstrings describing *current* behaviour, and why-this-design notes that stand alone.
The test: a year from now, would a reader still need this comment knowing nothing of the PR?

**OK in docs (`*.md`):** issue/PR refs are fine — docs record history.
**Always-loaded context files (`CLAUDE.md`, `.claude/rules/*.md`) stay lean** — no dates or ticket
numbers on rule lines; every always-loaded line costs context.

## Merge Rules

- **NEVER merge a PR when CI has not passed.** exid's CI is a matrix — `quality` plus Node 18/20/22/24
  plus the edge runtimes. Wait for **all** of it, not just the first green check.
- **Use `--admin`** when merging via `gh pr merge` (this repo blocks on REVIEW_REQUIRED).
- If CI is still running, wait. If CI fails, fix it first — never merge over red checks.
