---
name: rad-plan
description: Manage Plan COBs (me.hdh.plan) for implementation planning
arguments:
  - name: action
    description: Action to perform (list, show, create, edit, export)
    required: true
  - name: id
    description: Plan ID (for show, edit, export actions). Accepts short-form 7+ char hex prefixes.
    required: false
user_invocable: true
---

# Radicle Plan COB Management

Manage implementation plans stored as Plan COBs (`me.hdh.plan`) in the Radicle repository.

All commands accept **short-form IDs** (minimum 7 hex characters) for plans, tasks, issues, patches, and commits. Ambiguous prefixes produce a clear error.

## Actions

### /rad-plan list

List all plans in the repository.

```bash
rad-plan list
rad-plan list --status in-progress
rad-plan list --all  # include archived
```

Status filter values: `draft`, `approved`, `in-progress`, `completed`, `archived`.

Display output:
```
Plans in rad:z3gqcJUoA1n9HaHKufZs5FCSGazv5
============================================

abc1234  [in-progress]  Implement user authentication
         Tasks: 2/4 complete | Links: Issue #def5678

ghi7890  [draft]        Add caching layer
         Tasks: 0/3 complete | Links: none

Total: 2 plans (1 in-progress, 1 draft)
```

### /rad-plan show <id>

Show detailed information about a plan.

```bash
rad-plan show abc1234
rad-plan show abc1234 --json
```

Display output:
```
Plan: abc1234 - Implement user authentication
Status: in-progress
Author: did:key:z6Mk...
Created: 2024-01-15 10:30:00

Description:
Design and implement JWT-based authentication for the API.

Tasks:
  [x] 1. Create auth middleware (4h) — 6d6e328
  [x] 2. Add login endpoint (2h) — 9a1b2c3
  [ ] 3. Write tests (3h)
  [ ] 4. Update documentation (1h)

Progress: 50% (2/4 tasks complete)

Linked Issues: #def5678
Linked Patches: none
```

JSON output includes per-task fields: `id`, `subject`, `description`, `estimate`, `affectedFiles`, `linkedCommit`, `author`, `createdAt`.

A task is **done** when `linkedCommit` is present (non-null). There is no mutable status field.

### /rad-plan create

Create a new Plan COB interactively.

1. **Gather plan details**:
   - Use `AskUserQuestion` to get:
     - Plan title
     - Description
     - Labels (optional)
     - Initial tasks (optional)
     - Link to existing issue (optional)

2. **Create the Plan COB**:
```bash
rad-plan open "<title>" --description "<description>" --labels "<labels>"
```

3. **Add tasks if provided**:
```bash
rad-plan task add <plan-id> "<task-subject>" \
  --description "<description>" \
  --estimate "<time-estimate>" \
  --files "<file1>,<file2>"
```

4. **Link to issue if specified**:
```bash
rad-plan link <plan-id> --issue <issue-id>
```

5. **Announce to network**:
```bash
rad sync --announce
```

### /rad-plan edit <id>

Edit a plan's title or description.

```bash
rad-plan edit <plan-id> --title "New title"
rad-plan edit <plan-id> --description "Updated description"
rad-plan edit <plan-id> --title "New title" --description "Updated description"
```

### /rad-plan export <id>

Export a plan as markdown or JSON.

```bash
rad-plan export abc1234 --format md
rad-plan export abc1234 --format json
rad-plan export abc1234 --format md --output plan.md
```

## Task Management

### List tasks

```bash
rad-plan task list <plan-id>
```

### Add a task

```bash
rad-plan task add <plan-id> "<subject>" \
  --description "<description>" \
  --estimate "<time-estimate>" \
  --files "<file1>,<file2>"
```

### Edit a task

```bash
rad-plan task edit <plan-id> <task-id> --subject "Updated title"
rad-plan task edit <plan-id> <task-id> --description "Updated description"
rad-plan task edit <plan-id> <task-id> --estimate "3h"
rad-plan task edit <plan-id> <task-id> --files "src/client.rs,src/config.rs"
```

### Link task to commit (mark done)

A task is completed by linking it to the commit that implements it:

```bash
rad-plan task link-commit <plan-id> <task-id> --commit <commit-oid>
```

This sets `linkedCommit` on the task. The plan's `[x]`/`[ ]` display and completion percentage update automatically.

### Link task to issue

```bash
rad-plan task link <plan-id> <task-id> --issue <issue-id>
```

### Remove a task

```bash
rad-plan task remove <plan-id> <task-id>
```

## Plan Linking

```bash
rad-plan link <plan-id> --issue <issue-id>
rad-plan link <plan-id> --patch <patch-id>
rad-plan unlink <plan-id> --issue <issue-id>
rad-plan unlink <plan-id> --patch <patch-id>
```

## Comments

```bash
rad-plan comment <plan-id> "Implementation note"
rad-plan comment <plan-id> "Reply to comment" --reply-to <comment-id>
```

## Plan Status

```bash
rad-plan status <plan-id> draft
rad-plan status <plan-id> approved
rad-plan status <plan-id> in-progress
rad-plan status <plan-id> completed
rad-plan status <plan-id> archived
```

## Integration with Claude Code Tasks

When working with plans and Claude Code tasks:

1. Create Claude Code tasks with `radicle_plan_id` and `radicle_plan_task_id` metadata
2. When a Claude Code task completes, link the commit to the plan task via `task link-commit`
3. Use the plan's `linkedCommit` fields to track which tasks are done

## Examples

### Create a plan from plan mode

After using plan mode to design an implementation:

```
/rad-plan create

Creating Plan COB...
Title: "Implement user authentication"
Description: (from plan mode exploration)
Tasks: 4 tasks from plan mode
Linked Issue: #def5678 (from /rad-import)

Plan created: abc1234
Use '/rad-plan show abc1234' to view details.
```

### Mark tasks complete after implementation

```bash
# After committing implementation work:
git log --oneline -1
# 9a1b2c3 Add login endpoint

rad-plan task link-commit abc1234 def5678 --commit 9a1b2c3
# Task "Add login endpoint" marked as done (linked to 9a1b2c3)
```

## Notes

- Plan COBs require the `rad-plan` CLI tool (v0.2.0+) to be installed
- Plans are stored as `me.hdh.plan` COBs under `refs/cobs/me.hdh.plan/<id>`
- Plans replicate to other nodes when announced
- Short-form IDs (7+ hex chars) are accepted for all identifier types
- Task completion is tracked via linked commits, not mutable status
- Use `/rad-plan export` to share plans outside of Radicle
