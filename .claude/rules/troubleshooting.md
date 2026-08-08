# Troubleshooting Rules

## 🔴 Four gates read `dist/` — a stale `dist/` gives a confident wrong answer

`check:universal`, `check:pack`, `test:pack`, and `examples` all inspect the **built output**, not
`src/`. `scripts/build.mjs` deletes `dist/` and re-emits, so until you re-run it those four gates are
reporting on the *previous* commit's code:

- edit `src/`, run `check:universal` → **passes**, because the `node:crypto` import you just added
  isn't in the stale bundle yet;
- delete `dist/`, run `examples` → fails with a module-not-found that looks like a broken export map.

**Always `bun run build` before any of the four.** The full local gate, in CI's order:

```bash
bun run lint && bun run typecheck && bun run test:coverage && bun run build \
  && bun run check:universal && bun run check:pack && bun run test:pack
```

## Green locally, red in the runtime matrix

Unit tests run under one runtime (Node via vitest). CI packs a tarball and installs it under
Node 18/20/22/24 **plus Bun and Deno**. Things that pass locally and fail there:

- a `node:*` import (caught by `check:universal` — *if* `dist/` is fresh, see above)
- an ES2023+ builtin (`Array.prototype.toSorted`, …) — `lib` is `es2022` for a reason; Node 18 lacks them
- a type-resolution break that only `attw`/`publint` sees (`check:pack`)

Reproduce locally with `bun run test:pack` before blaming CI.

## An empty result — or a confident `ok` — is not evidence

A missing match invites "look harder"; a positive `✓ clean` invites nothing, which makes it the more
dangerous of the two. Mechanisms that return a confident, wrong answer:

- **zsh expands an unquoted glob in a flag before the command runs.** `grep -rn x src/ --include=*.ts`
  aborts with `no matches found: --include=*.ts` — grep never executes. Quote it (`--include='*.ts'`).
- **A pipeline reports the LAST command's exit code** — plain POSIX. `bun run lint | tail -20` yields
  `tail`'s status, so a failing gate exits 0 through the pipe. Never gate on a piped run.
- **rtk mangles/truncates output.** The global `rtk` hook rewrites commands like `git status` into
  `rtk git status`, which compacts and **truncates long change lists** — staged deletions and renames
  have been observed to vanish. Fine for a routine glance; the moment you **act on** the list (staging,
  counting, verifying deletions), re-run it a second way.

**Rule: when a result you would act on comes back empty — or clean — re-run it a second way before
concluding anything.**

## `gh pr edit` fails repo-wide — use the REST API to update a PR

`gh pr edit … --body/--title` aborts with `GraphQL: Projects (classic) is being deprecated …
(repository.pullRequest.projectCards)` and **silently does not apply the change** (exit 1). Use REST:

```bash
gh api -X PATCH repos/inventtech/exid/pulls/<PR> -F body=@/tmp/exid-pr-body.md
gh api -X PATCH repos/inventtech/exid/pulls/<PR> -f title="<title>"
```

## The release didn't happen

A merged PR that ships no npm version is almost always the commit type, not a broken pipeline:

- the squash-merge title was `chore:` / `docs:` / `refactor:` → semantic-release correctly published
  nothing (`git.md` §The commit type IS the release);
- `[skip ci]` is in the subject — semantic-release's own release commit carries it by design, but a
  hand-written one suppresses the whole workflow.

Check `.github/workflows/release.yml` run logs before assuming a token or config problem.

## Coverage failed but every test passed

`vitest.config.ts` sets **thresholds that fail the run** (95% statements/functions/lines, 90%
branches). `bun run test` passes while `bun run test:coverage` — the gate CI actually runs — fails.
The fix is a test, never a lowered threshold.

## Biome says the whole repo is mis-formatted

Check `biome.json` for comments. Biome prints a parse diagnostic and then falls back to its **DEFAULT
config**, so every file reports as mis-formatted while looking like ordinary lint errors. `biome.json`
is strict JSON — rationale goes in `.claude/rules/typescript.md`, not in the config.
