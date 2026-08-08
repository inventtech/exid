---
name: pull
description: Pull latest changes with rebase on the current branch
---

# Pull

Pull latest changes with rebase. Single command to sync the current branch.

## Behavior

1. Detect the current branch
2. Pull with rebase from origin (current branch)
3. If conflicts arise, report them and stop — do NOT auto-resolve
4. **Reinstall dependencies** when `bun.lock` changed — see below
5. Report: commits pulled, files changed, fast-forward or rebase result, install outcome

## Execute

```bash
git pull --rebase
```

Plain `git pull --rebase` uses the branch's upstream. NEVER build
`git pull --rebase origin "$BRANCH"` from a captured variable — under `wsl.exe -- bash -ic`
the substitution can come back empty and silently rebase onto main (`git.md` §Workflow).

## Conflict Handling

If rebase hits conflicts:
- List conflicted files
- Tell the user to resolve manually or offer to abort (`git rebase --abort`)
- Do NOT auto-commit conflict resolutions without user approval

## Post-pull sync

After a successful pull that brought in **new commits** (skip when "already up-to-date"):

```bash
git diff --name-only ORIG_HEAD..HEAD | grep -q '^bun.lock$' && bun install --frozen-lockfile
rm -rf dist                 # a stale dist/ makes check:universal / examples report on old code
```

`--frozen-lockfile` matters — a plain `bun install` can resolve differently from CI and quietly
change what you're testing against. Removing `dist/` is cheap insurance against the
stale-artifact class in `.claude/rules/troubleshooting.md`.

## Report

```
## Pull Report
Branch:  <branch-name>
Result:  <fast-forward | rebased N commits | already up-to-date | CONFLICT>
Changes: <N files changed, insertions/deletions>
Deps:    <reinstalled (bun.lock changed) | unchanged>
dist/:   <cleared | n/a>
```
