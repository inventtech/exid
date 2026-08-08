# Audit Config — Detailed Check Reference

## Quick Mode Checks (Checks 1–7)

### Check 1: Context Budget Analysis

```bash
# CLAUDE.md
wc -l CLAUDE.md

# All rules (always loaded)
wc -l .claude/rules/*.md | tail -1

# Memory file
wc -l ~/.claude/projects/*/memory/MEMORY.md 2>/dev/null | tail -1

# Total always-loaded lines
cat CLAUDE.md .claude/rules/*.md ~/.claude/projects/*/memory/MEMORY.md 2>/dev/null | wc -l
```

**Thresholds:**

| File | Target | Warning |
|------|--------|---------|
| CLAUDE.md | < 200 lines | Over 200 = wasted tokens every request |
| Each rule file | < 120 lines | Over 120 = consider moving to skill reference |
| Memory file | < 200 lines | Over 200 = prune stale entries |
| Total always-loaded | < 900 lines | This is a ~900-line library; its config must not out-weigh its source. Over 900 = context bloat |
| Any single line | < 200 chars | Over 200 = split or trim (long lines waste tokens same as many lines) |

**Line length rule:** line count alone is misleading — a file with 50 lines averaging 400 chars each is heavier than 100 lines at 80 chars. Audit must flag lines over 200 chars in always-loaded files (CLAUDE.md + rules). Common offenders: inline epic/ticket descriptions, comma-separated lists, verbose feature summaries.

**No ticket references in always-loaded files:** `CLAUDE.md` and `.claude/rules/*.md` must NOT contain `Epic #xxx`, `#1234`, or issue/PR references. These rot fast and add no value to always-loaded context. Durable rationale belongs in `CONTRIBUTING.md`; history belongs in git blame.

**Allowed exceptions:** `#NNN` in template placeholders (e.g. `Closes #123`) and external bug links (e.g. `anthropics/claude-code#44778`).

### Check 1b: Ticket References

```bash
# Always-loaded files — must be zero
grep -rn '#[0-9]\{3,\}' CLAUDE.md .claude/rules/*.md \
  | grep -v 'hex\|color\|Closes #\|claude-code#'

# Skills (on-demand but still wasteful)
grep -rn '#[0-9]\{3,\}' .claude/skills/ --include="*.md" \
  | grep -v 'hex\|color\|Closes #\|claude-code#' | head -20
```

### Check 1c: Line Length

```bash
# Lines over 200 chars in always-loaded files (FNR = per-file line numbers)
awk 'length > 200 { printf "%s L%d (%d chars)\n", FILENAME, FNR, length }' \
  CLAUDE.md .claude/rules/*.md | sort -t'(' -k2 -rn
```

---

### Check 2: Content Duplication & Conflicts

Read CLAUDE.md and identify each section's topic. Search for the same topic in `rules/`, `skills/`, `agents/`.

**Common duplicates to check:**
- Gate commands (CLAUDE.md vs `skills/test/SKILL.md` vs `agents/test-runner.md` vs CONTRIBUTING.md)
- Commit/release rules (CLAUDE.md vs `rules/git.md` vs `skills/push/references/conventions.md`)
- Code conventions (CLAUDE.md vs `rules/typescript.md`, `rules/naming.md`)
- Testing conventions (`rules/testing.md` vs `skills/audit-test/references/test-patterns.md`)

**The one DELIBERATE duplication — verify it's in sync, don't flag it as drift:**
- `CONTRIBUTING.md` §The rules that matter ↔ `.claude/rules/invariants.md`. Mirrored on purpose
  (one is for humans, one is always-loaded for agents). **Content drift between them IS a finding;
  their existence is not.**

**Rule conflicts to check:**
- `rules/typescript.md` §Hot-path style vs `skills/audit-code/references/audit-checks.md` §Check 7 —
  both must say the same thing about the `| 0` coercions and scratch buffers
- `rules/testing.md` vs `skills/update-tests/SKILL.md` — same determinism requirements

---

### Check 3: Inventory Sync

```bash
# Skills (this repo has no .claude/commands/ — skills only)
ls .claude/skills/*/SKILL.md 2>/dev/null | sed 's|.*/skills/||;s|/SKILL.md||' | sort

# Agents
ls .claude/agents/*.md 2>/dev/null | sed 's|.*/||;s|\.md||' | sort

# MCP servers (project-level) — this repo has none; flag if .mcp.json appears without a reason
[ -f .mcp.json ] && grep -o '"[a-zA-Z_-]*":' .mcp.json | tr -d '":' | sort
```

Flag: listed in CLAUDE.md but file missing, or file exists but not listed.

---

### Check 4: Agent Review

Read all `.claude/agents/*.md` and verify:

| Agent Role | Expected Model |
|------------|----------------|
| Writes code (Edit/Write tools) | `sonnet` or `opus` |
| Read-only analysis | `haiku` (cheaper) |
| Complex architecture | `opus` |

Also verify `disallowedTools` properly restricts non-code agents.

---

### Check 5: Settings & Hooks Review

Read `.claude/settings.json` and check:
- `permissions` holds ONLY `defaultMode: bypassPermissions` — an `allow` or `deny` list present is a finding to REMOVE (see 14b)
- `PostToolUse` hooks — correct file patterns? still needed?
- `SessionStart` hooks — `wsl` (matcher `*`) + `compact` snapshot both emit valid
  `hookSpecificOutput.additionalContext`? (PreCompact CANNOT inject context — never
  add a PreCompact hook for that purpose; use SessionStart matcher `compact`.)
- Enabled plugins — still needed and working?
- Also read `.claude/settings.local.json` if exists

---

### Check 6: README Badge Verification

```bash
grep -oE 'github\.com/[^/]+/[^/]+/actions/workflows/[^)]+' README.md

ls .github/workflows/*.yml | grep -v '^_'
```

Flag if badge URL references a workflow that doesn't exist.

---

### Check 7: Git hooks / CI parity

This repo has **no git hooks by design** — CI is the gate. What must be true instead:

```bash
ls .husky 2>/dev/null && echo "NOTE: hooks appeared — CLAUDE.md + skills/push say there are none"
grep -nE '^\s+- run: bun run' .github/workflows/ci.yml
```

Verify the gate chain documented in `CLAUDE.md`, `CONTRIBUTING.md`, `skills/test/SKILL.md`, and
`agents/test-runner.md` **matches `ci.yml` exactly, in the same order**. A gate that CI runs but the
docs omit is the one an agent will skip.

---

## Full Mode Checks (Checks 8–15)

### Check 8: Cross-Reference Integrity

```bash
grep -oE '\./[a-zA-Z0-9_./-]+\.md' CLAUDE.md | while read f; do
  [ ! -f "$f" ] && echo "MISSING: $f (referenced in CLAUDE.md)"
done
```

### Check 9: Skills Deep Check

```bash
# Check for empty or stub reference files
find .claude/skills -name "*.md" -size -50c
```

Verify: SKILL.md exists with trigger conditions, references/ files non-empty, no trigger overlap between skills.

### Check 10: Memory & claim accuracy

```bash
# Spot-check test counts against reality
grep -rcE "(it\(|test\()" --include="*.test.ts" src/__tests__/ | awk -F: '{s+=$NF}END{print "unit tests:", s}'

# Any command a config file promises must actually exist as a script
grep -rhoE 'bun run [a-z:0-9-]+' CLAUDE.md .claude/ | sort -u | sed 's/bun run //' \
  | while read k; do jq -e --arg k "$k" '.scripts[$k]' package.json >/dev/null 2>&1 || echo "MISSING script: $k"; done
```

Verify: test counts, file paths, script names, and config decisions are still valid. **The script
check above is the highest-value item here** — a config that tells an agent to run a script that
doesn't exist wastes a turn every time.

### Check 11: Stray plan files

`planning.md` forbids plan files — plans live in the GitHub issue comment (+ an invariant entry when
the decision is durable). Flag anything that reintroduces them:

```bash
ls .claude/plans/ 2>/dev/null && echo "⚠️  .claude/plans/ exists — plans belong in the issue comment"
```

### Check 12: Stale Documentation Detection

Compare each doc surface's last touch against the code it describes:

```bash
for pair in "README.md:src/index.ts" "CONTRIBUTING.md:src/exid.ts" \
            "SECURITY.md:src/random.ts" ".claude/rules/invariants.md:CONTRIBUTING.md"; do
  DOC=${pair%%:*}; CODE=${pair##*:}
  echo "$DOC: doc=$(git log -1 --format=%ci -- "$DOC") code=$(git log -1 --format=%ci -- "$CODE")"
done
```

Code newer than its doc is a lead, not a verdict — read both before flagging.

### Check 13: Published-package config audit

`exid` has **no `.env` files and takes no runtime configuration** — the ex-platform env-sample audit
does not apply. The equivalent risk here is `package.json` drift, because those fields ARE the
package's contract with every consumer.

**13a — the fields that reach consumers:**
```bash
jq '{name, version, type, sideEffects, main, module, types, exports, files, engines}' package.json
```

- `dependencies` must be absent or empty (`invariants.md`)
- `files` must be exactly what should ship (`["dist"]`) — a stray addition publishes source or secrets
- `exports` conditions must resolve for both ESM and CJS (`bun run check:pack` is the machine check)
- `engines.node` must match the CI matrix floor

**13b — declared vs. tested runtime support:**
```bash
grep -n '"engines"' -A3 package.json
grep -n "node:" .github/workflows/ci.yml
grep -in 'node 1[0-9]\|node 2[0-9]\|deno\|bun' README.md
```
All three must agree. The README claim is the one that reaches users; the matrix is the only one
that's actually verified.

**13c — release config:**
```bash
jq '.branches, [.plugins[] | if type=="array" then .[0] else . end]' .releaserc.json
```
Verify the branch list matches reality and that `@semantic-release/npm` is present — without it,
merges cut GitHub releases but publish nothing to npm.

**13d — `prepublishOnly` still builds:** the publish path runs `node scripts/build.mjs` under
whatever package manager publishes, so it must not require bun. Flag any bun-only syntax introduced
into `scripts/build.mjs`.

### Check 14: Claude Code config hygiene

Claude Code's canonical exclusion mechanism is `.gitignore` (auto-respected via `respectGitignore`, default `true`). Claude Code also offers `permissions.deny` in `.claude/settings.json` for hard blocks, but **this project deliberately declines that mechanism** — see 14b before flagging anything about it. There is **no** documented `.claudeignore` field in Claude Code's settings surface — if the project has a `.claudeignore` file, treat it as a project-internal defensive convention, NOT a Claude-canonical feature.

#### 14a. settings.json schema validity

```bash
jq -e . .claude/settings.json >/dev/null 2>&1 && echo "✓ valid JSON" || echo "✗ malformed"
jq -r '.["$schema"] // "MISSING"' .claude/settings.json
```

Flag if `$schema` field is missing (recommended: `https://json.schemastore.org/claude-code-settings.json`) — schema enables IDE autocomplete + catches typos in field names.

#### 14b. `permissions` contains ONLY `defaultMode` — no `allow`/`deny` list

```bash
jq -r '.permissions | keys[]' .claude/settings.json   # expect exactly: defaultMode
```

**Standing user directive: `.claude/settings.json` → `permissions` must contain ONLY
`"defaultMode": "bypassPermissions"` — no `allow` list, no `deny` list, ever.**
The user runs fully bypassed and treats both lists as pure friction.

- Any key other than `defaultMode` → **finding: REMOVE it.** Report it as a finding to
  delete, with the exact `jq` edit — never as a gap to fill.
- **Never propose adding a `deny` entry** — not for `.env`, not for `cert/**`, not for
  `tools/config.ts`. Those files stay protected by `.gitignore` + `respectGitignore` (14c),
  which is the project's chosen mechanism.
- This check previously read "deny covers known secret paths" and was itself the thing that
  kept re-adding the list after the user removed it. **Do not re-derive that version from
  Claude Code's generic best practices** — the project directive wins (CLAUDE.md §Harness settings).

#### 14c. respectGitignore not disabled

```bash
jq -r '.respectGitignore // "default(true)"' .claude/settings.json
```

`respectGitignore: false` is almost always a mistake (causes Claude to read `node_modules`, `dist`, `.env`, etc.). Flag unless explicitly justified by an inline comment.

#### 14d. Legacy `.claudeignore` detection

```bash
[ -f .claudeignore ] && echo "WARN: .claudeignore found — not a Claude Code canonical feature"
```

If `.claudeignore` exists, **do NOT auto-delete** — the project may use it as defensive belt-and-braces. Verify:
1. The file has a header comment explaining it's project-internal (not a Claude feature)
2. Patterns are NOT redundant with `.gitignore` (run `comm -23 <(grep -v '^#' .claudeignore | sort -u) <(grep -v '^#' .gitignore | sort -u)`)
3. Unique patterns target **committed** files only — `.gitignore` already handles untracked patterns. Common legitimate uses: generated artefacts that escape `.gitignore` mid-session.

If patterns are mostly redundant or no header is present, recommend cleanup (don't auto-delete — the user should review).

#### 14e. Build artefacts in `.gitignore`

```bash
for p in dist coverage node_modules '*.tgz'; do grep -qF "$p" .gitignore || echo "MISSING in .gitignore: $p"; done
```

`dist/`, `coverage/`, and `npm pack` tarballs regenerate on every build — they must never enter
Claude context or the repo. A tracked `dist/` also makes the stale-artefact failure in
`.claude/rules/troubleshooting.md` much harder to notice.

### Check 15: File Size Warnings

```bash
wc -l .claude/rules/*.md | sort -rn | head -5       # over 120
wc -l .claude/skills/*/SKILL.md | sort -rn | head -5 # over 500
wc -l .claude/agents/*.md | sort -rn | head -5       # over 200
wc -l CLAUDE.md                                      # over 200
```

---

## When to Run

- **Quick mode** — after adding commands/skills/agents, or monthly maintenance
- **Full mode** — quarterly deep review, after major refactors, when context feels slow
