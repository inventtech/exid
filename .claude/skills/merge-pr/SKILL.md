---
name: merge-pr
description: Merge current PR after CI passes, then cleanup
---

Merge the current PR after CI checks pass.

## Steps

1. **Get current PR** — capture its number; the branch is deleted by step 5, so later steps need the explicit number.
   ```bash
   PR=$(gh pr view --json number --jq '.number')
   gh pr view "$PR" --json state,statusCheckRollup,headRefName
   ```

2. **Wait for CI to complete**
   ```bash
   gh pr checks --watch --interval 15
   ```

3. **If CI passes - Merge PR**
   ```bash
   gh pr merge --squash --admin --delete-branch
   ```

4. **Switch to main and pull**
   ```bash
   git checkout main
   git pull --rebase origin main
   ```

5. **Watch the release** — merging to `main` triggers `release.yml`, and the **squash-merge title**
   is what semantic-release reads. Confirm the version the merge was supposed to produce actually
   shipped:
   ```bash
   gh run list --workflow=release.yml --limit 1 --json status,conclusion,headSha
   gh release list --limit 3
   npm view exid version          # the published version, after the run completes
   ```
   A `chore:`/`docs:`/`refactor:` title publishes **nothing** — that's correct behaviour, not a
   failure, but say so explicitly in the report so nobody waits for a version that was never coming.

6. **Clear stale build output**
   ```bash
   rm -rf dist
   ```

7. **Report result** — PR number merged, branch deleted, status on main, **release outcome**
   (version published / no release — `<type>:` title), local cleanup

## Error Handling

- If CI fails: Report which checks failed and stop
- If PR is not mergeable: Report the reason
- If merge conflicts exist: Report and stop
- If the release workflow fails (step 5): the merge already landed — report the error and the run
  URL; never re-run a publish by hand (`.claude/rules/git.md`)
- If no version was published, check the squash title's type before assuming the pipeline broke
