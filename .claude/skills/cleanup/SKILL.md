---
name: cleanup
description: Clean up the dev environment (build output, caches, temp artifacts, git)
---

Run a full cleanup of the development environment. Use this before starting a new ticket to ensure a
clean slate.

`exid` has no Docker stack, no database, and no dev server — cleanup here is build output, caches,
and git hygiene.

## 1. Build Output

```bash
rm -rf dist coverage
rm -f exid-*.tgz          # tarballs left behind by `npm pack` / test:pack
```

> `dist/` is deleted by `scripts/build.mjs` on every build anyway — the point of removing it here is
> to make sure the next `check:universal` / `examples` run can't read a stale bundle
> (`.claude/rules/troubleshooting.md`).

## 2. Temp Artifacts

```bash
rm -rf /tmp/exid-pack-*   # throwaway projects from test:pack (mkdtemp)
rm -f /tmp/exid-*.md      # commit / PR body scratch files
```

`test:pack` cleans up after itself on success; a crashed or interrupted run leaves the dir behind.

## 3. Claude Artifacts

```bash
git worktree list
git worktree prune
```

Report any stale worktrees found.

## 4. Git Cleanup

```bash
git fetch --prune origin
# Squash-merge policy means `git branch --merged` NEVER detects merged branches —
# detect gone upstreams instead (branch deleted on origin after PR merge):
git branch -vv | grep ': gone]' || echo "No merged branches to clean"
```

## 5. Report

Report: space reclaimed, caches cleared, worktrees pruned, stale branches found.

## 6. Deep Cleanup (`--deep` only)

Only when the user passes `--deep` or explicitly asks.

```bash
rm -rf node_modules
bun install --frozen-lockfile
```

`--frozen-lockfile` matters: a plain `bun install` may resolve differently from CI and quietly change
what you're testing against. Dependency versions here are pinned exact on purpose.

**Never** clear `~/.bun/install/cache` as part of routine cleanup — it's shared across every repo on
the machine.
