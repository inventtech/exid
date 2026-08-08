---
name: start-team
description: Spawn a 2-agent build+review team (builder implements, reviewer reviews code + docs; both fan out to subagents) looping until the gate passes (code ≥ 9.5). Per-task mode (`/start-team <task>`) auto-tears-down; standing mode (no task) takes assignments until stopped. Use when the user says "/start-team [task]" or asks for a do+review team. Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1.
---

# /start-team — 2-agent "build + review" team (both fan out to subagents)

> **Experimental opt-in** — the standing-team mode documented in `.claude/rules/agents.md` §Default: ad-hoc agents · opt-in: standing team, gated by `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Outside this skill, the ad-hoc agent model still governs.

Spin up a 2-teammate team for one task, with you (the main session) as the **lead/coordinator**:

- **builder** (`general-purpose`, opus) — builds. Fans out to `test-runner` / `scout` **subagents** for gate runs and lookups.
- **reviewer** (`general-purpose`, opus) — reviews. Fans out to `code-reviewer` / `doc-writer` **subagents** and runs `/review-code` + `/review-docs`.

They loop (build → review → fix) until the gates pass, then the team is torn down.

## Two modes

| Mode | Trigger | Lifecycle |
|---|---|---|
| **Per-task** (default) | `/start-team <task>` | spin up → build/review the one task → **auto-teardown** when gates pass |
| **Standing** | `/start-team` (no task) | spin up **standby** → lead assigns tasks on demand (one after another) → **stays alive** until the user says to stop |

In **standing mode** the two teammates spawn idle and wait. The user hands tasks to the **lead** (you); the lead breaks each down and DMs `builder` to build + `reviewer` to gate — exactly like per-task, but the team is **not** torn down between tasks. Tear down only when the user explicitly asks ("ปิดทีม" / "/stop-team").

## Why both teammates are `general-purpose`

Only `general-purpose` / `claude` carry the `Agent` tool (verified empirically), so only they can spawn subagents. The 4 specialized project agents (`code-reviewer`, `doc-writer`, `test-runner`, `scout`) have restricted tool lists **without** `Agent` — so we use them **as subagents** under the two general-purpose teammates, never as the teammates themselves.

Key facts about teammate-spawned subagents:
- They run **inside the parent teammate's session/pane** (no new tmux pane) and report back to that teammate.
- They are **1 level deep** — a subagent cannot spawn another subagent.

## Roles & models

| Role | `subagent_type` | Model | Edits files? | Fans out to |
|---|---|---|---|---|
| **builder** | `general-purpose` | **`model: 'opus'`** | ✅ | `test-runner`, `scout` |
| **reviewer** | `general-purpose` | **`model: 'opus'`** | ❌ read-only | `code-reviewer`, `doc-writer` + `/review-*` skills |
| **lead** | — (you) | opus | coordinates | — |

> **Both teammates run opus** (user directive — sonnet wasn't enough for the builder's coordination + code judgment). Cost control comes from the fan-out layer, NOT from downgrading a teammate: the builder delegates gate runs and lookups to **sonnet/haiku** subagents (`test-runner` / `scout` — models come from each agent's frontmatter automatically), keeping opus for the arithmetic and the invariants. `general-purpose` inherits the lead's model, but **always pass `model: 'opus'` explicitly** so a lead-model change never silently downgrades a teammate.

## Builder — fan-out map

| Work | Subagent | Model |
|---|---|---|
| Algorithm / API (`src/**`) | **builder itself — do NOT delegate** | opus |
| Gate runs (lint / typecheck / test / pack) | `test-runner` | sonnet |
| CI status, PR / issue lookups | `scout` | haiku |

> **`src/` edits are not delegated.** ~400 lines with a proof obligation attached
> (`.claude/rules/invariants.md`) — an excerpt-reading subagent cannot hold the permutation in view.
> The builder edits `src/` itself and uses subagents for verification and lookups.
| run tests / lint / typecheck | `test-runner` | sonnet |

The builder edits directly for small changes and **fans out to parallel subagents when a task clearly splits into independent FE and BE chunks** (different files = no conflict). It applies every fix the reviewer reports — itself or via its subagents.

## Reviewer — review map (gates from `.claude/rules/code-review.md`)

| Lens | How | Gate |
|---|---|---|
| Code | `/review-code` (or a `code-reviewer` subagent, opus) | **≥ 9.5** |
| Docs (only when docs/config changed) | `/review-docs` (a `doc-writer` subagent, opus) | accurate, no drift |

The reviewer DMs `builder` with every issue as `[file:line]`, then re-reviews after fixes. It **never edits** — the builder applies all fixes.

## Workflow

### 0. Preflight
- **Agent teams enabled** — `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. If not, tell the user how to enable it and stop.
- **One team at a time** — check `~/.claude/teams/`; if a team is already active, finish + clean it up first (or abort and tell the user). The session's OWN implicit `session-<id>/` dir with only `team-lead` in `members` is NOT an active team — "active" means teammates besides `team-lead` are present in the members list.

### 1. Create the team
`TeamCreate({ team_name: 'dev-review', description: '<task> — builder + reviewer' })`

> **Newer harness (verified 2026-07-09): `TeamCreate`/`TeamDelete` no longer exist** — the session has ONE
> **implicit team** (`~/.claude/teams/session-<id>/`, you are already `team-lead` in it) and `Agent`'s
> `team_name` param is deprecated/ignored. If `TeamCreate` isn't available, SKIP this step — just spawn
> the named teammates; they join the implicit team automatically.

### 2. Spawn the two teammates
- **Builder** — `Agent({ subagent_type: 'general-purpose', name: 'builder', team_name: 'dev-review', model: 'opus', prompt: '<task> + which files are yours + "read .claude/rules/invariants.md first. Edit src/ yourself — do NOT delegate it. You may spawn test-runner / scout subagents for gate runs and lookups. Wait for reviewer feedback and apply every fix. Do NOT touch files outside the task scope." ' })`
- **Reviewer** — `Agent({ subagent_type: 'general-purpose', name: 'reviewer', team_name: 'dev-review', model: 'opus', prompt: 'Review the builder\'s changes. Run /review-code; run /review-docs if docs/config changed. You may spawn code-reviewer / doc-writer subagents. Enforce the gate: code ≥ 9.5, zero invariant violations. DM "builder" with every issue as [file:line]. When all gates pass, DM "team-lead" with the final scores." ' })`

> **Standing-mode prompts:** spawn both teammates with a **standby** prompt instead of a task — tell each: "this is a standing team; there is no task yet; reply with a one-line standby acknowledgement and do nothing else; wait for `team-lead` to DM you work, then loop build→review→fix per assignment and return to standby after each task." The lead supplies the real task later via `SendMessage`.

### 3. Create the shared tasks
- **Per-task:** `TaskCreate` → T1 "Build: \<task\>" → `owner: builder`; T2 "Review + gates" → `owner: reviewer`, **depends on T1**.
- **Standing:** create **no** tasks at spawn. The lead creates a fresh T1/T2 pair **per assignment** as the user hands over each new task, then DMs the teammates to start.

### 4. Loop: build → review → fix
- Builder builds T1 (fanning out to subagents as needed), marks it complete → T2 unblocks.
- Reviewer reviews (fanning out as needed). Issues → DM `builder` with `[file:line]`; builder fixes; reviewer re-reviews.
- Repeat until all gates pass (max 3 rounds). The reviewer never edits.

### 5. Done + cleanup

**Per-task — auto-teardown (MANDATORY).** When the reviewer reports all gates pass:
1. Report the result to the user **in Thai** — final scores + a one-line summary of what shipped.
2. Shut down both teammates: `SendMessage({ to: 'builder', message: { type: 'shutdown_request', reason: '…' } })`, then the same for `reviewer`.
3. Poll the team `config.json` (implicit team: `~/.claude/teams/session-<id>/config.json`) until the
   teammates leave the `members` list (~15 s). A teammate that approves shutdown removes itself.
4. `TeamDelete()` — **implicit-team harness: not available and not needed.** Do NOT delete the live
   session's own `session-<id>/` dir; only `rm -rf` stale `session-*` dirs from dead sessions
   (verify no other `claude` process owns them first).
5. Kill any straggler: tmux-pane teammates → `tmux kill-pane -t <id>` (never your own `$TMUX_PANE`);
   **in-process teammates (no pane) → `TaskStop({ task_id: '<teammate name>' })`**.

**Standing — stay alive.** After each task passes, report scores to the user in Thai and return both teammates to standby; do NOT tear down between tasks. Run the teardown steps above **only** when the user explicitly asks to stop the team ("ปิดทีม" / "/stop-team").

## Gotchas
- **File ownership** — the builder (and its subagents) own the implementation files; the reviewer is read-only, so no write conflict. The lead must NOT edit those files while the builder is active.
- **Both teammates are opus, non-negotiable** — the review gate (`.claude/rules/code-review.md`) requires opus-quality judgment, and the builder needs opus for multi-subagent coordination + integration decisions. Do NOT downgrade either without an explicit user directive; the sonnet layer is the subagents.
- **Subagents are invisible helpers** — they run inside the builder/reviewer pane (no extra pane), report back to their parent, and are 1 level deep (no nested subagents).
- **Pane width** — teammates open as tmux split panes at 35 % (`~/.tmux.conf`). Builder + reviewer + lead = 3 panes. **`teammateMode: auto` picks `in-process` even inside tmux** (observed 2026-07-09 — no panes, same mailbox behavior; force-stop is `TaskStop`, not `kill-pane`). We pin `"teammateMode": "tmux"` in `.claude/settings.json` to keep panes visible; check `backendType` in the team `config.json` to see which mode a teammate actually got.
- **Always clean up** — orphan panes and `~/.claude/teams/` dirs accumulate otherwise (a known tmux-mode limitation).
