---
name: open-ticket
description: Create a GitHub issue with proper structure — draft, self-review + adversarial review, then create
argument-hint: <description or topic>
---

Create a well-structured GitHub issue from the given description.

> **Draft → Review → Create.** Never create the issue straight from the first draft.
> A ticket that ships with holes costs far more downstream than a 2-minute review pass.
> Step 5 (Review) is **mandatory** — for `size:L` / `size:XL` the adversarial agent pass is required, not optional.

## Steps

### 1. Understand the Request
- Parse the argument to understand what the ticket is about
- Determine the type: `bug`, `enhancement`, `testing`, `documentation`, `refactor`, `perf`

### 2. Research Context (if needed)
- Search codebase for related files and existing implementations
- Check for duplicate issues: `gh issue list --search "<keywords>" --state all`

### 3. Determine Labels
- `bug`, `enhancement`, `testing`, `refactor`, `documentation`, `perf`
- `priority:high`, `priority:medium`, `priority:low`
- `size:S` / `size:M` / `size:L` / `size:XL` — AI token-budget estimate (see `.claude/rules/planning.md` §Issue Sizing; the legacy `manday-*` labels are deprecated)

### 4. Draft the Issue Body (do NOT create yet)
Write the full body to a scratch file (`/tmp/<slug>.md`) — never inline-heredoc a long body (parens/backticks break under WSL; see `.claude/rules/git.md`). Structure:

```markdown
## Summary
<1-3 sentences>

## Context
<Why this is needed>

## Requirements
- [ ] Requirement 1

## Technical Notes
<Relevant files, endpoints, components>

## Acceptance Criteria
- [ ] Criteria 1

## Related
<Links to related issues, PRs, docs>
```

### 5. Review Pass (MANDATORY — before creating)

Two passes. Catch holes here, not after the team starts work.

**5a. Self-review checklist** — re-read the draft against:
- [ ] **No duplicate** — confirmed via the `gh issue list --search` in step 2.
- [ ] **Scope boundary explicit** — what's in vs out (and what's deferred / "future").
- [ ] **Acceptance criteria are testable** — each is verifiable, not vague.
- [ ] **Edge cases** named — null/empty/concurrent/failure/abuse paths.
- [ ] **Cross-cutting concerns** considered where relevant — **billing/cost-metering, auth/guards, PDPA/consent, rate-limit/abuse, i18n/language scope, migrations/back-compat, accessibility, testing strategy.** (Most overlooked: cost-metering on AI/LLM features, and back-compat when changing shared surfaces.)
- [ ] **Dependencies / sequencing** — does this block or depend on other work? Phased (P1…Pn) if multi-step.
- [ ] **Size label** matches real scope; **type + scope labels** present.
- [ ] **ADR candidates** flagged if a hard-to-reverse + surprising + real-trade-off decision is implied.

**5b. Adversarial agent review** — spawn an independent **`Plan`** (or `code-reviewer`) agent to critique the DRAFT against the codebase + `.claude/rules/`:
- Give it the draft body + the relevant code surfaces; ask for **OVERLOOKED items** (gaps, wrong assumptions, missing requirements/edge-cases), categorized **Critical / Major / Minor**, with file-path evidence. It reports findings — it does NOT rewrite the ticket.
- **Required for `size:L` / `size:XL`.** Optional (but encouraged) for `S` / `M`.

**Gate:** fold every **Critical** and **Major** finding back into the draft before creating; note deferred Minors. Surface the verdict + what changed to the user.

### 6. Create Issue
```bash
gh issue create --title "<type>: <concise title>" --label "<labels>" --body-file /tmp/<slug>.md
```
Then delete the scratch file. (`--body-file`, never inline `--body "$(cat <<EOF…)"` — avoids WSL shell-mangling, per `git.md`.)

### 7. Guidelines
- Title under 70 characters, conventional prefix (feat/fix/chore/docs)
- Always include at least one type label + one scope label

## Output

Report: Issue URL · Labels applied · one-line summary · **review verdict** (what the review caught + what was folded in / deferred).

> ClickUp task is created automatically via GitHub Action (`clickup-sync.yml`) when issue is opened.
