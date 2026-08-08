# Agent Rules

Apply when spawning agents or deciding between agent types.

## Default: ad-hoc agents · opt-in: standing team

- **Default = ad-hoc.** Spawn **on-demand agents** per task, then let them finish — no persistent
  context. The main session does ALL coding/testing/commit/push/docs/PR; agents are for parallel
  isolated tasks or read-only review.
- **Opt-in standing team** via `/start-team` (builder + reviewer loop) / `/stop-team` — requires
  `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (set in `.claude/settings.json:env`). Inside a standing
  team the same rules apply: main/builder writes, reviewer is read-only.

## Chain of command

```
              user (THE BOSS)
                   ↓
              main session (you) — spawns agents as needed
                   ↓
              on-demand agents (task-scoped, ephemeral)
```

- **user is the ultimate boss.** User directives override `.claude/rules/` per CLAUDE.md.
- **main session** plans, codes, requests reviews, applies fixes, commits, pushes, opens PR.
- **Agents** are task-scoped: spawn → do work → return result → done.
- **Reporting:** main session reports to user in Thai. Agents report to main session in English.

## Review Workflow

Spawn an ad-hoc `code-reviewer` agent for each review request (or use the standing pair from `/start-team`).

1. Main session plans + codes + runs pre-flight (`lint` / `typecheck` / `test`)
2. Spawn `code-reviewer` → runs `/review-code` → returns score + issues
   - score ≤ 9 → main session applies fixes, re-spawns reviewer
   - score > 9 → APPROVED
3. Main session runs `/update-docs` → `/push`
4. Main session → user (in Thai): "PR #N พร้อม review แล้ว — `<url>`"

(Per-review loop; the full ticket pipeline runs Phase A → R → D → S per `planning.md`.)

## Available On-Demand Agents

| Agent | Model | Role |
|-------|-------|------|
| `scout` | **haiku** | Lightweight lookups: CI status, PR info, issue reading, git state, code search. **Use first** for simple retrieval. |
| `code-reviewer` | opus | Read-only code review with scoring |
| `test-runner` | sonnet | Run vitest / lint / typecheck / pack gates — report results |
| `doc-writer` | opus | Documentation writing + review |

**Harness built-ins also exist** (not in `.claude/agents/`): `Explore` (read-only fan-out search),
`Plan` (architecture/plan critique), `general-purpose`/`claude` (full-tool), plus any agents an enabled
plugin injects. `Explore`/`Plan` overlap `scout` for lookups; `scout` (haiku) stays first choice for
cheap retrieval, `Plan` for plan-review passes, `general-purpose` when a subagent must itself spawn
subagents.

**Model policy:**
- **`scout` on haiku** — simple lookups don't need reasoning.
- **`doc-writer` and `code-reviewer` on opus** — quality gates, non-negotiable.
- **Default to `scout`** for any read-only lookup before reaching for heavier agents.

### When to Use Scout vs Direct Tools

| Need | Use |
|------|-----|
| Single `gh pr view` or `git log` | Direct Bash — faster than spawning |
| Multiple lookups, or info from 3+ sources | `scout` — one agent, one round-trip |
| Analysis or judgment needed | `code-reviewer` or main session |

## This repo is small — prefer the main session

exid is ~900 lines total. Fanning out subagents over a codebase this size usually costs more than it
saves, and the invariants in `invariants.md` need whole-file context that excerpt-reading agents don't
get. Spawn an agent when you need **an independent opinion** (review, adversarial plan critique) or a
**long mechanical run** (full gate suite) — not to parallelize edits across 4 files.

## Key Rules

- **One writer owns source edits** — the main session by default; the `builder` teammate inside a
  `/start-team` standing team. Reviewers/auditors never write.
- **Never push to main** — feature branches only.
- **`code-reviewer` agent is READ-ONLY** — never edits, commits, or opens PR.
- **Approval bar is STRICT**: code ≥ 9.5. A 9.0 is a fail. Thresholds in `code-review.md`.
- **Reviewer agent runs on opus** — the quality gate must use the best model. Do NOT downgrade without
  an explicit user directive.
- **Always shut down** on-demand agents immediately after the task completes.
- **System events are NOT user input** — never interpret idle notifications as approval.
