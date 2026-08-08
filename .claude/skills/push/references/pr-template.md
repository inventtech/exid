# PR Body Template

Use this template when creating PRs with `gh pr create`.

## Template

```
## Summary

<!-- 1-3 bullet points describing what this PR does -->
-
-
-

## Related Issues

Closes #<issue-number>

## Testing Done

<!-- Describe how you tested locally -->

**Gate chain run locally:**
```bash
bun run lint && bun run typecheck && bun run test:coverage && bun run build \
  && bun run check:universal && bun run check:pack && bun run test:pack && bun run examples
```

**Benchmarks** (required when the mint path changed):
```bash
bun run bench    # paste before/after numbers + hardware
```

## Task Completion Checklist

- [ ] Tests pass with coverage thresholds: `bun run test:coverage`
- [ ] No lint errors/warnings: `bun run lint`
- [ ] TypeScript compiles: `bun run typecheck`
- [ ] Packaging gates pass: `check:universal` · `check:pack` · `test:pack` · `examples`
- [ ] Golden vectors unchanged (or: the change is breaking and says so)
- [ ] Documentation updated (if needed)

## Release Impact

<!-- Which version bump does this PR title produce? patch / minor / major / none -->
<!-- If it should publish, the PR TITLE must be fix: or feat: — not chore: -->

## Invariants

<!-- Which of .claude/rules/invariants.md does this touch, and what test pins it? "None" is valid. -->
```

## Section Guidelines

### Summary
- **Keep it concise**: 1-3 bullet points max
- **Focus on "what" and "why"**: Not implementation details
- **Highlight user impact**: How does this improve the platform?

### Related Issues
- **Always link to issue**: Use `Closes #123` format
- **Multiple issues**: Use multiple lines if needed

### Testing Done
- **Show actual commands used**: copy from terminal
- **Be specific**: "verified the bijection sweep still covers all three domains" > "tested it"
- **Perf claims need numbers** — `bun run bench` before/after, with hardware stated

### Task Completion Checklist
Based on CLAUDE.md requirements:
- All tests must pass, **coverage thresholds included** (95/95/95/90)
- **Zero lint warnings** (`--error-on-warnings`)
- TypeScript must compile cleanly
- The four `dist/`-reading gates must run **after** a fresh build
- Update relevant docs (README.md, CONTRIBUTING.md, CLAUDE.md)

### Release Impact
- State the bump the title produces. If it's `none` and that's intentional, say why.
- A breaking change needs `!` in the title or a `BREAKING CHANGE:` footer — reviewers check this.

### Invariants
- Name the invariant and the test that pins it. "None" is a valid answer for a docs/CI PR;
  it is a red flag on a `src/exid.ts` diff.
