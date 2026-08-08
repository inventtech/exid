---
name: visualize
description: Render a result as a visual (SVG / HTML widget) instead of a wall of text — comparisons, data breakdowns, flows, architecture maps, UI mockups, concepts. Use when the answer would be clearer shown than told, when the user asks for a diagram / chart / mockup / dashboard, or when explaining a comparison, layout, flow, or set of numbers you could draw.
---

# Visualize

The user **strongly prefers visual output**. When a result is clearer shown than told, render it
with the `visualize` tool (`mcp__visualize__show_widget`) inline — don't default to a wall of text.

> **Availability guard:** the `visualize` MCP server is a user-level setup, NOT in this repo's
> `.mcp.json.example` — it may be absent from a session. If `mcp__visualize__*` tools aren't
> available, fall back to an Artifact page or a `tmp-design/` HTML mockup instead; never call
> a tool that isn't in the session.

## Reach for it proactively

Render a widget (SVG / HTML) whenever the answer benefits from being *seen*, e.g.:

- **Comparisons / options** — before/after, variant A vs B, plan tiers, trade-off matrices
- **Data** — distributions, breakdowns, KPI snapshots, small dashboards (use real numbers from the codebase/DB)
- **Flows & architecture** — request flows, state machines, module/dependency maps, ER sketches
- **UI mockups** — proposed layouts / components *before* implementing in React (pairs with `tmp-design/`)
- **Concepts** — anything spatial, hierarchical, or step-wise that prose flattens

This is a standing preference, not a one-off. Bias toward showing — if you're explaining a comparison,
a layout, a flow, or numbers and you *could* draw it, draw it.

## How (so it lands well)

- **Call `mcp__visualize__read_me` once per session before the first `show_widget`** (silently — never narrate it). Re-call for a different module (`diagram` / `mockup` / `chart` / `data_viz` / `art` / `interactive`).
- **Text goes in the chat reply, visuals go in the tool.** No paragraphs/titles inside the widget — the response prose carries the explanation; the widget carries only the visual.
- **Dark-mode safe**: CSS variables for chrome/text; inline hex only for categorical data series (match the app's series colors when mocking our UI).
- Keep the project voice: Thai prose in the reply, English inside the widget.

## When NOT to

- A single fact or a yes/no — just say it.
- Throwaway intermediate steps the user won't revisit.
- When a real screenshot or actual command output is the honest answer — a mockup must
  never be passed off as the running app. Label mockups as mockups.

> Trivial overuse is worse than none. The bar: *would seeing this beat reading it?* If yes — show it.
