# PR Conventions & Examples

## PR Title Format

```
<type>(<scope>): <subject>
```

### Types (required)

| Type       | Description                                      | Use When                           |
|------------|--------------------------------------------------|------------------------------------|
| `feat`     | New feature                                      | Adding new functionality           |
| `fix`      | Bug fix                                          | Fixing broken behavior             |
| `perf`     | Performance improvement                          | Optimizing existing code           |
| `test`     | Adding/correcting tests                          | Test-only changes                  |
| `docs`     | Documentation only                               | README, CLAUDE.md, comments        |
| `style`    | Formatting only (no logic change)                | Whitespace, lint autofix           |
| `refactor` | Code change (no bug fix or feature)              | Restructuring without behavior change |
| `chore`    | Routine tasks, maintenance                       | Dependencies, configs, build       |

### Scopes (canonical set — `git.md`)

Single-package repo, so a **bare type is usually right**. Optional scopes:

- `core` — `src/` (the published surface)
- `docs` — README / CONTRIBUTING / SECURITY
- `ci` — `.github/`
- `bench`, `scripts`, `examples`
- **Omit the scope** for cross-cutting changes (e.g. `chore: upgrade biome`)

### 🔴 The title IS the release

Squash-merge makes the PR title the released commit. `feat:` → minor, `fix:` → patch,
`feat!:` / a `BREAKING CHANGE:` footer → major, everything else → **no release at all**.
A `fix:` commit inside a `chore:`-titled PR ships nothing. Pick the title type deliberately.

### Subject Rules

- Use imperative present tense: "add" not "added"
- Lowercase first letter — matches repo history (`feat: add a decode helper`)
- No period at the end
- Keep under 72 characters
- Be specific and descriptive

## Title Validation

The PR title should match:
```
^(feat|fix|perf|test|docs|style|refactor|chore)(\((core|docs|ci|bench|scripts|examples)\))?!?: .+[^.]$
```

## Examples

### New public API (→ minor release)
```
feat: add a decode helper for extracting the counter
```

### Bug fix (→ patch release)
```
fix(core): keep permute3 bijective at the upper domain edge
```

### Breaking change (→ major release; add `!` before the colon)
```
feat(core)!: rename createExidFromState to fromState
```

### Documentation update (→ no release)
```
docs: state the per-generator scope of the collision guarantee
```

### Maintenance work (→ no release)
```
chore: upgrade biome to 2.4.16
```

### Packaging fix (→ patch release — it reaches consumers)
```
fix: correct the types condition in the CJS export map
```

## Git Workflow Notes

### Squash Merge Only
- All PRs will be **squash merged** to keep history clean
- Your PR title becomes the commit message
- All commits in PR are combined into one

### Before Creating PR
Must complete the checklist from CLAUDE.md:
1. `bun run lint` — zero warnings
2. `bun run typecheck`
3. `bun run test:coverage` — thresholds pass
4. `bun run build && bun run check:universal && bun run check:pack && bun run test:pack`
5. Documentation updated

### PR Review Process
- PRs require approval before merging
- CI must pass — **the whole matrix** (quality + Node 18/20/22/24 + Bun + Deno), not just the first check
- Address review comments
- Keep PR scope focused (one issue = one PR)
