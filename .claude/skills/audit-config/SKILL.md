---
name: audit-config
description: Audit and optimize Claude Code configuration. Use when the user says "/audit-config" or asks to check context budget, inventory sync, or config health.
---

# Audit Config Skill

Audit the Claude Code configuration for this project and report optimization opportunities.

## Scope — health, not content-sync

This skill audits the **structure / health** of the config layer: budgets, inventory-vs-disk
drift (Check 3), dead cross-refs, duplication / rule conflicts, and settings + secret hygiene.
It is a **detector** — it flags issues (and in-ticket mode auto-fixes the mechanical ones); it
does not *author* config content.

**Propagating new work into the config is NOT this skill's job.** When a new skill / tool /
workflow lands and a rule's *content* should change — a checklist item to add, or a rule adjusted
to reference the new skill — that belongs to **`/update-docs` Tier 4 (Phase D)**, not
`/audit-config` (Phase A). audit-config will flag that an added skill isn't listed in CLAUDE.md
(inventory drift); it will not write the rule that should describe it.

## Bundling note

**Batch mode** (invoked alongside other audit/review skills): suppress the auto-commit, leave changes staged — contract in [planning-pipeline.md §Skill-side contract](../audit-full/references/planning-pipeline.md#skill-side-contract). Standalone: commit as today.


## Execution

Spawn an Agent with `subagent_type: "general-purpose"`. Reads 20+ files, queries Context7 — run as subagent to keep main context clean.

**Mode:** argument passed by user
- `quick` (default) — essentials only (Checks 1–7, incl. 1b/1c)
- `full` — deep analysis (all checks)

## Quick Mode Checks (always run)

1. **Context Budget** — line counts + line lengths vs targets (see config-checks.md for thresholds)
   - **1b Ticket Refs** — scan for `#NNN` / `Epic #NNN` in always-loaded files (forbidden in CLAUDE.md + rules)
   - **1c Line Length** — flag lines >200 chars in always-loaded files (CLAUDE.md, .claude/rules/*.md)
2. **Content Duplication** — cross-file topic overlap and rule conflicts
3. **Inventory Sync** — CLAUDE.md "Claude Tools" section vs actual files on disk
4. **Agent Review** — model appropriateness per agent role
5. **Settings & Hooks** — permissions (`defaultMode` ONLY — an `allow`/`deny` list present is a finding to REMOVE), hooks (SessionStart wsl/compact, PreToolUse guard, PostToolUse, SubagentStop)
6. **README Badges** — badge URLs vs actual workflow files
7. **Pre-Commit Hooks** — Husky + lint-staged coverage

## Full Mode Additional Checks (only with `full`)

8–15: Cross-reference integrity, skills deep check, memory accuracy, stale docs, env var audit, Claude Code config hygiene (settings schema, permissions shape, respectGitIgnore, legacy `.claudeignore`), file size warnings.

See `references/config-checks.md` for full check commands and thresholds.

## Step 0: Fetch Latest Best Practices (Context7)

Before auditing, use Context7 to pull latest Claude Code docs on: settings.json, CLAUDE.md best practices, hooks, MCP servers, agent config, memory system.

Cross-reference against current config and report new features or deprecated settings.

## Output Format

```
Claude Config Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━
Mode: quick / full

Context Budget:   CLAUDE.md: XXX lines | Rules: XXX | Memory: XXX | Total: XXX
Line Length:      X lines over 200 chars
Ticket Refs:      X found in always-loaded files
Duplications:     X found
Inventory Sync:   Skills XX | Agents XX | MCP XX
Agent Models:     <name>: model (optimal / suggest X)
Settings:         permissions / hooks / plugins
README Badges:    OK / stale URL
Pre-Commit:       lint + typecheck + test

[Full mode extras]
Cross-References: X broken | Memory: X stale | Plans: X cleanup
Stale Docs: X | Env Vars: X undocumented | File Sizes: X over threshold

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Health Score: X/10

All Recommendations:
1. [issue 1 with file:line]
2. [issue 2 with file:line]
3. [issue 3 with file:line]
... (list every finding — do not truncate)
```

List **every** issue surfaced by the audit, ordered most-impactful first. Do not collapse to "Top 3" / "Top 5" — the user wants full visibility so they can fix everything in one pass.

## References

See `references/config-checks.md` for full check commands, size thresholds, and shell commands for each check.
