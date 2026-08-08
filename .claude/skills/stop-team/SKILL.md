---
name: stop-team
description: Tear down the active agent team (the `/start-team` team) cleanly — gracefully shut down every teammate, force-kill any that won't stop, verify the team is empty (TeamDelete where available), and clean up orphan tmux panes. Use when the user says "/stop-team", "ปิดทีม", "หยุดทีม", or asks to shut down / disband the standing team. Pairs with /start-team.
---

# /stop-team — tear down the agent team

Cleanly disband the active `dev-review` (or any) agent team spawned by `/start-team`.
You are the **lead** (`team-lead`) running in your own pane (`$TMUX_PANE`) — never kill your own pane.

> **Why a dedicated teardown:** a standing team accumulates context and a teammate
> can stop obeying `shutdown_request` (observed: a context-bloated teammate rejected
> shutdown and kept editing). Graceful-first, **force-kill fallback** is mandatory —
> orphan panes + stale `~/.claude/teams/` dirs otherwise pile up.

## Step 0 — Find the active team

```bash
ls ~/.claude/teams/ 2>/dev/null
```

**"No active team" check** — depends on the harness:
- **Implicit-team harness:** `~/.claude/teams/` is NEVER empty — the live session's own `session-<id>/`
  always exists with `team-lead` in it. No active team = that config.json has NO members besides
  `team-lead` **and** no other live team dir exists → report "no active team" and stop.
- **Legacy harness:** `~/.claude/teams/` is empty → report "no active team" and stop.

Otherwise read the config to enumerate members + their panes:

```bash
cat ~/.claude/teams/<team>/config.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(m['name'], m.get('isActive'), m.get('tmuxPaneId','')) for m in d['members']]"
```

Note your own name (`team-lead`) and every teammate name + `tmuxPaneId`.

## Step 0.5 — Fast path: standby-only team → skip graceful

If the team **never received an assignment** — no team tasks were created AND no teammate ever edited
files (their work surface is clean) — the graceful protocol buys nothing (there is no in-flight work
to let them flush). Skip Step 1–2 entirely and `TaskStop({ task_id: '<teammate name>' })` each teammate
directly (~5 s total), then continue from Step 3. `TaskStop` works for BOTH backends — for a pane teammate
the pane lingers and is swept in Step 4; `tmux kill-pane` (Step 2) is the pane-native alternative.

Graceful-first (`shutdown_request` + ~15 s poll) is reserved for teams with in-flight work — a teammate
mid-edit deserves the chance to finish/report before being killed. Note the cost either way: an idle
teammate must wake up and spend an LLM turn to approve its own shutdown, so graceful is never instant.

## Step 1 — Graceful shutdown (all teammates, in parallel)

Send a `shutdown_request` to each teammate (NOT yourself). Single message block, all at once:

```
SendMessage({ to: '<teammate>', message: { type: 'shutdown_request', reason: 'Team teardown via /stop-team.' } })
```

A teammate that approves terminates its own process. Idle teammates wake to process it.

## Step 2 — Poll for shutdown (~15 s), then FORCE-KILL stragglers

Re-read `config.json` and check `members`. Poll a few times over ~15 s. On approved shutdown a teammate
REMOVES ITSELF from `members` — so "gone from `members`" is the primary signal (`isActive` is the legacy field).

**If any member is still `isActive: true` / still in `members` after ~15 s** (or already gone but its pane lingers), force-kill it:

```bash
tmux kill-pane -t <tmuxPaneId>    # pane-based teammate — NEVER your own $TMUX_PANE
```

```
TaskStop({ task_id: '<teammate name>' })   # in-process teammate (pane = "in-process", nothing to kill in tmux)
```

Confirm the process is gone:

```bash
ps -p <pane_pid> -o pid= 2>/dev/null && echo "STILL ALIVE" || echo "dead"
```

Do not wait forever on a rejected/ignored shutdown — force-kill is the fallback.

## Step 3 — Delete the team

Once no teammate process remains:

```
TeamDelete()
```

Removes `~/.claude/teams/<team>/` + `~/.claude/tasks/<team>/` and clears team context.
(If `TeamDelete` errors "team still has active members", a pane survived — return to Step 2.)

> **Implicit-team harness (no `TeamDelete` — verified 2026-07-09):** teardown is complete when the
> `members` list holds only `team-lead`. Do NOT delete the live session's own `session-<id>/` dir
> (the harness manages it). DO `rm -rf` stale `session-*` dirs whose lead session is dead — verify
> first that no other `claude` process owns them (`pgrep -af claude` + `readlink /proc/<pid>/cwd`).

## Step 4 — Sweep orphan panes

List every pane and kill any that is **not** your own (`$TMUX_PANE`) and isn't a real user shell:

```bash
echo "MY_PANE=$TMUX_PANE"
tmux list-panes -a -F '#{pane_id} | #{pane_pid} | #{pane_current_command}'
# for each general-purpose / agent pane that is not $TMUX_PANE:
tmux kill-pane -t <pane_id>
```

## Step 5 — Report (Thai, to the user)

- Which teammates were shut down gracefully vs force-killed.
- Confirm `TeamDelete` done + no orphan panes remain.
- Note any in-flight work that was abandoned (uncommitted changes still on disk — remind the user to review `git status`).

## Gotchas

- **Never kill `$TMUX_PANE`** — that's you (the lead). Sweep only teammate panes.
- **Force-kill is expected, not exceptional** — don't loop indefinitely waiting for a graceful `shutdown_response`; ~15 s then `tmux kill-pane` by `tmuxPaneId`.
- **Stale queued messages** — a killed teammate's last message may still flush from the routing layer after its process is dead; verify liveness via `ps -p <pid>`, not by trusting the message.
- **Uncommitted work** — teardown does NOT commit. If a teammate (e.g. the builder) had pending edits, they remain in the working tree; surface this so the user can `git checkout`/commit deliberately.
