---
name: rad-status
description: Display a unified overview of Radicle repo state — open issues, active plans, and session tasks
arguments:
  - name: issue-id
    description: Optional issue ID to show details for a specific issue
    required: false
user_invocable: true
---

# Radicle Status Dashboard

Query the repository's actual state and display a unified overview of open issues, active plans, and session tasks.

## Instructions

### 1. Query repository state

Run these commands to gather the full picture:

```bash
# Open issues
rad issue list --state open
```

```bash
# Active plans (if rad-plan is installed)
command -v rad-plan >/dev/null 2>&1 && rad-plan list
```

### 2. Query session tasks

Use the `TaskList` tool to get any Claude Code tasks in the current session. Filter for tasks with `radicle_issue_id` metadata.

### 3. Cross-reference and display

Build a unified dashboard that connects issues, plans, and session tasks:

```
Radicle Status
==============
Repository: rad:z3GhWjk...

Open Issues (3)
───────────────
  abc1234  P0: Implement authentication
           Plan: def5678 [in-progress] 2/4 tasks done
           Session: 3 tasks (1 completed, 1 in-progress, 1 pending)

  ghi7890  P1: Fix search performance
           Plan: none
           Session: not imported

  jkl3456  P2: Update API documentation
           Plan: none
           Session: not imported

Active Plans (1)
────────────────
  def5678  Implement authentication [in-progress]
           Tasks: 2/4 complete | Linked to issue abc1234

Session Tasks (3)
─────────────────
  Issue abc1234: "Implement authentication"
    [##########----------] 1/3 tasks (33%)
    [x] Create auth middleware (completed)
    [>] Add login endpoint (in_progress)
    [ ] Write auth tests (pending)

Suggestions
───────────
  • Issue abc1234 has session tasks in progress — keep working or /rad-sync when done
  • Issues ghi7890, jkl3456 are not imported — use /rad-import <id> to start
```

### 4. Single issue detail view

If a specific issue ID is provided in arguments, show a detailed view for just that issue:

```bash
rad issue show <issue-id>
```

Include:
- Full issue description
- Discussion summary
- Linked plan details (if any)
- Session task status with descriptions
- Suggested next action

### 5. Handle edge cases

- **No open issues**: "No open issues. Use `rad issue open` or `/rad-issue` to create one."
- **No session tasks but open issues exist**: Show the issues and suggest `/rad-import`
- **No rad-plan installed**: Skip plan section silently
- **Session tasks but no open issues**: Show session tasks with a note that the issues may have been closed

### 6. Status indicators for session tasks

- `[x]` = completed
- `[>]` = in_progress
- `[ ]` = pending
- `[!]` = blocked (if task has unresolved blockedBy)

### 7. Progress bar

Use characters for visual progress:
- `#` for completed portion
- `-` for remaining portion
- 20 characters total width

### 8. Actionable suggestions

Always end with context-aware suggestions:
- Issues at 100% session tasks → "Ready to sync — run `/rad-sync`"
- Issues with in-progress tasks → "Keep working or `/rad-sync --dry-run` to check progress"
- Unimported issues → "Use `/rad-import <id>` to start working"
- Issues with plans → "Run `rad-plan show <id>` for plan details"
