---
name: rad-plan
description: Manage Plan COBs (me.hdh.plan) for implementation planning
arguments:
  - name: action
    description: Action to perform (list, show, create, sync, export)
    required: true
  - name: id
    description: Plan ID (for show, sync, export actions)
    required: false
user_invocable: true
---

# Radicle Plan COB Management

Manage implementation plans stored as Plan COBs (`me.hdh.plan`) in the Radicle repository.

## Actions

### /rad-plan list

List all plans in the repository.

```bash
rad-plan list
rad-plan list --status in-progress
```

Display output:
```
Plans in rad:z3gqcJUoA1n9HaHKufZs5FCSGazv5
============================================

abc123  [in-progress]  Implement user authentication
        Tasks: 2/4 complete | Links: Issue #def456

ghi789  [draft]        Add caching layer
        Tasks: 0/3 complete | Links: none

Total: 2 plans (1 in-progress, 1 draft)
```

### /rad-plan show <id>

Show detailed information about a plan.

```bash
rad-plan show abc123
```

Display output:
```
Plan: abc123 - Implement user authentication
Status: in-progress
Author: did:key:z6Mk...
Created: 2024-01-15 10:30:00

Description:
Design and implement JWT-based authentication for the API.

Tasks:
  [x] 1. Create auth middleware (4h) - completed
  [x] 2. Add login endpoint (2h) - completed
  [ ] 3. Write tests (3h) - pending
  [ ] 4. Update documentation (1h) - pending (blocked by #3)

Progress: 50% (2/4 tasks complete)

Linked Issues: #def456
Linked Patches: none
Critical Files: src/middleware/auth.ts, src/routes/login.ts

Discussion: 3 comments
```

### /rad-plan create

Create a new Plan COB interactively.

1. **Gather plan details**:
   - Use `AskUserQuestion` to get:
     - Plan title
     - Description
     - Initial tasks (optional)
     - Link to existing issue (optional)

2. **Create the Plan COB**:
```bash
rad-plan open "<title>" --description "<description>"
```

3. **Add tasks if provided**:
```bash
rad-plan task add <plan-id> "<task-subject>"
```

4. **Link to issue if specified**:
```bash
rad-plan link <plan-id> --issue <issue-id>
```

5. **Announce to network**:
```bash
rad sync --announce
```

### /rad-plan sync [id]

Synchronize Claude Code task status to Plan COBs.

If `id` is provided, sync only that plan. Otherwise, sync all plans with linked tasks.

1. **Get all tasks** using TaskList

2. **Find tasks with Plan metadata**:
   - Filter for tasks with `radicle_plan_id` in metadata

3. **For each plan**:
   - Mark completed tasks as complete in the Plan COB
   - Mark in-progress tasks as in-progress
   - Update plan status if all tasks done

4. **Report sync results**:
```
Plan Sync Results
=================

Plan abc123: "Implement user authentication"
  Synced 2 tasks:
    - "Create auth middleware" -> completed
    - "Add login endpoint" -> completed
  Plan status: in-progress (2/4 tasks done)

Plan ghi789: "Add caching layer"
  No tasks to sync (all pending)

Summary: 2 tasks synced across 1 plan
```

### /rad-plan export <id>

Export a plan as markdown or JSON.

```bash
rad-plan export abc123 --format md
rad-plan export abc123 --format json
```

Markdown output:
```markdown
# Implement user authentication

**Status:** in-progress
**Author:** did:key:z6Mk...
**Created:** 2024-01-15

## Description

Design and implement JWT-based authentication for the API.

## Tasks

- [x] Create auth middleware (estimate: 4h)
- [x] Add login endpoint (estimate: 2h)
- [ ] Write tests (estimate: 3h)
- [ ] Update documentation (estimate: 1h)

## Progress

50% complete (2/4 tasks)

## Links

- Issue: #def456

## Critical Files

- src/middleware/auth.ts
- src/routes/login.ts
```

## Integration with Claude Code Tasks

When showing or syncing plans, map Plan COB tasks to Claude Code tasks:

1. Match by `radicle_plan_task_id` metadata
2. Show completion status from both systems
3. Highlight any discrepancies

## Examples

### Create a plan from plan mode

After using plan mode to design an implementation:

```
/rad-plan create

Creating Plan COB...
Title: "Implement user authentication"
Description: (from plan mode exploration)
Tasks: 4 tasks from plan mode
Linked Issue: #def456 (from /rad-import)

Plan created: abc123
Use '/rad-plan show abc123' to view details.
```

### Quick sync after completing tasks

```
/rad-plan sync

Syncing Plan COBs...

Plan abc123: 2 tasks synced (completed)
Plan status updated: in-progress -> in-progress (50% done)

Announced changes to network.
```

## Notes

- Plan COBs require the `rad-plan` CLI tool to be installed
- Plans are stored as `me.hdh.plan` COBs under `refs/cobs/me.hdh.plan/<id>`
- Plans replicate to other nodes when announced
- Use `/rad-plan export` to share plans outside of Radicle
