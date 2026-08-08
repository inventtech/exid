---
name: audit-code
description: Deep audit — code smells, dead code, magic values, Big-O analysis, simplification, file/function decomposition. Use when the user says "/audit-code" or asks to audit code quality, find dead code, or hunt performance issues.
---

# Audit Code Skill

Deep audit of production code for quality issues, refactoring opportunities, and simplification.

## Bundling note

**Batch mode** (invoked alongside other audit/review skills): suppress the auto-commit, leave changes staged — contract in [planning-pipeline.md §Skill-side contract](../audit-full/references/planning-pipeline.md#skill-side-contract). Standalone: commit as today.


## Execution

Spawn an Agent with `subagent_type: "code-reviewer"`. Deep scans read 50+ files — run as subagent to keep main context clean.

**Scope:** argument passed by user (default: all)
- `src` — `src/` (the published surface — algorithm, encoding, entropy)
- `tooling` — `scripts/`, `bench/`, `examples/`
- `all` — Both
- `path/to/file` — A specific file

## Phase 1: Deep Scan

Run ALL 7 checks from `references/audit-checks.md` on every file in scope.

**Read `src/exid.ts` and `src/siphash.ts` end-to-end before flagging anything in them.** This is
arithmetic with a proof obligation attached (`.claude/rules/invariants.md`) — a "redundant" `>>> 0`
or a "wasteful" preallocated buffer is almost always load-bearing. When in doubt, report it as a
question, not a finding.

## Phase 2: Enter Planning Mode

After scanning, `EnterPlanMode` and present findings as a prioritized action list.

**Priority levels:** P0 (Critical) → P1 (High) → P2 (Medium) → P3 (Low)

**Report format:**
```
Code Audit Report
━━━━━━━━━━━━━━━━━
Scope: [src|tooling|all]
Files scanned: XXX
Issues found: XXX

[P0] CRITICAL — <category>: <description>
  File: <path>:<line>
  Issue: <detail>
  Fix: <action>

[P1] HIGH — ...
...

Summary by Priority:
  P0: X | P1: X | P2: X | P3: X

Which issues would you like me to fix?
```

**WAIT for user input before fixing anything.**

## Phase 2b: Track as a Single Issue (on user request)

If the user asks to open a ticket / track the findings (e.g. "open ticket", "file an issue", "track this for later"), **open ONE consolidated issue with the full report inside as a checklist** — NEVER open one issue per finding. Multi-ticket spam is the #1 tracking nuisance for audits; a single tracker with nested checkboxes is the canonical pattern.

**Use `/open-ticket` once** with a body that packs all findings into grouped checklists:

```bash
gh issue create \
  --title "chore: audit-code findings — <scope> (<date>)" \
  --label "refactor,priority:<med|high>" \
  --body "$(cat <<'EOF'
## Summary

Consolidated audit findings from \`/audit-code\` run on <date>. Scope: <scope>. Total: X findings across P0–P3.

Each checkbox below is a self-contained fix; pick them off individually in follow-up PRs, or batch by priority.

## P0 — Critical
- [ ] **<category>**: <description> — \`<file>:<line>\`
- [ ] ...

## P1 — High
- [ ] ...

## P2 — Medium
- [ ] ...

## P3 — Low (optional)
- [ ] ...

## Notes
- All findings auto-generated from the 7 checks in \`.claude/skills/audit-code/references/audit-checks.md\`.
- Fix individual items with a dedicated \`fix:\` / \`refactor:\` commit; re-tick the box in this issue on PR merge.
- Re-run \`/audit-code\` after major refactors to surface newly introduced issues.

## References
- Audit run: <timestamp>
- Skill: \`.claude/skills/audit-code/\`
EOF
)"
```

**Do NOT:**
- Open one issue per P0 / P1 / P2 / P3 group.
- Open one issue per file or per finding — regardless of severity.
- Chain multiple `/open-ticket` calls to cover the audit output. The default MUST be a single consolidated tracker.

**OK to split into multiple issues only when:**
1. The user explicitly says "open separate tickets" / "one ticket per P0".
2. A single P0 finding is so large (e.g. whole-module rewrite) that it needs its own spec + sub-tasks — then file a standalone issue for THAT item, and leave the rest in the consolidated tracker with a cross-link.

## Phase 3: Apply Fixes (After User Selection)

Exit planning mode. For each selected issue:
1. Read affected file(s) completely
2. Apply minimal fix — do NOT refactor surrounding code
3. Verify with `bun run typecheck`
4. Report what changed

**Fix guidelines:**
- One issue = one logical change (atomic)
- Dead code: delete completely, no `// removed` comments
- Follow existing naming and import style
- **Never "simplify" the hot path** — the 32-bit coercions, the preallocated scratch buffers, and the
  index arithmetic in the mint path are the design, not debt (`.claude/rules/typescript.md` §Hot-path style)
- **Never touch an invariant to make a smell go away** — if the clean version breaks bijectivity,
  allocates per mint, or pulls in a `node:` import, the smell stays

## Phase 4: Verification

```bash
bun run lint && bun run typecheck && bun run test:coverage && bun run build \
  && bun run check:universal && bun run check:pack
```

The build + `check:universal` are not optional here: an "unused import" cleanup that removes the last
reference keeping a module tree-shaken, or a refactor that pulls in a Node built-in, only surfaces in
the bundle.

## References

See `references/audit-checks.md` for all 7 detailed check patterns (magic values, dead code, code
smells, security, Big-O, consistency, simplification).
