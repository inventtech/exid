---
name: next
description: Summarize what to work on next based on GitHub issues, ClickUp tasks, TODOs, and project state
---

Analyze the project state and recommend what to work on next.

## Steps

### 1. Gather GitHub Issues

```bash
gh issue list --state open --limit 30 --json number,title,labels,createdAt,updatedAt,assignees
gh issue list --state open --label "priority:high" --json number,title,labels
gh issue list --state closed --limit 5 --json number,title,closedAt
```

### 1.5. Check ClickUp Tasks (if available)

Try to fetch tasks from ClickUp for additional context. If ClickUp MCP is not available, skip silently.

### 2. Check In-Progress Work

```bash
gh pr list --state open --json number,title,headRefName,updatedAt,isDraft
git branch --list 'feat/*' 'fix/*' 'chore/*'
```

### 3. Scan for TODOs in Codebase

```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ scripts/ bench/ examples/ --include="*.ts" --include="*.mjs" --include="*.cjs" | head -30
```

### 4. Check Recent Activity

```bash
git log --oneline -10
git log --oneline origin/main..HEAD 2>/dev/null
```

### 5. Assess and Prioritize

Consider: Urgency (bugs > high-priority > enhancements > chores), Dependencies, Momentum, Impact, Effort.

## Output Format

Present in Thai with: งานที่เพิ่งเสร็จ, งานที่กำลังทำอยู่, แนะนำให้ทำต่อ (priority order), TODOs ที่น่าสนใจ, ข้อเสนอแนะเพิ่มเติม

## Guidelines

- GitHub issues are source of truth; cross-reference ClickUp when available
- If an argument is provided (e.g., "docs", "perf"), focus on that area
- Group related issues when they could be done in one PR
