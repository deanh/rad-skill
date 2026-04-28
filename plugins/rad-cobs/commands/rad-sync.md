---
name: rad-sync
description: Sync completed tasks back to Radicle issues and Plan COBs with rollup logic
arguments:
  - name: options
    description: Optional flags like --dry-run to preview without making changes
    required: false
user_invocable: true
---

# Radicle Sync

Syncs session task completions to both Radicle issues and Plan COBs. Uses rollup logic — an issue is only marked "solved" when ALL linked tasks are completed.

## Instructions

### 1. Get all tasks

Use the `TaskList` tool.

### 2. Group tasks by Radicle issue

- Filter tasks that have `radicle_issue_id` in their metadata
- Group tasks by their `radicle_issue_id`

### 3. For each issue, calculate completion status

- Count total tasks linked to this issue
- Count completed tasks (status: "completed")
- Determine if ALL tasks are complete

### 4. Sync Plan COBs (if applicable)

When tasks have `radicle_plan_id` and `radicle_plan_task_id` metadata, sync to Plan COBs:

**Group tasks by Plan** using `radicle_plan_id` metadata.

**Link commits to Plan COB tasks** — for completed Claude Code tasks, link the implementing commit (marks it done):

```bash
rad-plan task link-commit <plan-id> <plan-task-id> --commit <commit-oid>
```

The commit OID should come from the task metadata or `git log`.

**Update Plan status** when all tasks complete:

```bash
rad-plan status <plan-id> completed
```

### 5. Handle dry-run mode

If `--dry-run` is in the arguments, show what would be synced without making changes. Include both issue and Plan COB sync status.

### 6. Sync fully completed issues

For issues where all tasks are done:

Mark the Radicle issue as solved:
```bash
rad issue state <issue-id> --closed
```

Add a completion comment:
```bash
rad issue comment <issue-id> --message "Completed via Claude Code session. Tasks completed: [list task subjects]"
```

### 7. Report partially completed issues

Report progress but do not close the issue. Show which tasks remain.

### 8. Announce changes to the network

```bash
rad sync --announce
```

### 9. Offer context creation

If any issues were closed and `rad-context` is installed:

```bash
command -v rad-context >/dev/null 2>&1
```

Use `AskUserQuestion` to offer creating a Context COB:

```
Issue <id> has been closed. Would you like to create a Context COB
to preserve session observations (approach, constraints, learnings, friction)?
```

Options:
- "Create context" — Run `/rad-context create`
- "Skip" — Continue without creating context

This is a natural workflow boundary — the issue is done, making it an ideal moment to capture observations.

### 10. Report sync summary

- Issues fully synced (marked solved)
- Plans synced with task completion
- Issues with partial progress
- Any errors encountered

## Example Output

### Dry Run
```
Radicle Sync Preview (dry run)
==============================

Issues:
  abc123: "Implement authentication"
    Status: READY TO CLOSE (4/4 tasks complete)
    [x] Create auth middleware
    [x] Add login endpoint
    [x] Write auth tests
    [x] Update documentation

  def456: "Add user profiles"
    Status: IN PROGRESS (2/5 tasks complete)
    [x] Create profile model
    [x] Add GET /profile endpoint
    [ ] Add profile update endpoint
    [ ] Write profile tests
    [ ] Add profile to nav

Plans:
  Plan ghi789: 4/4 tasks ready to link (abc123)
  Plan jkl012: 2/5 tasks ready to link (def456)

Summary: 1 issue ready to close, 1 plan ready to complete
Run without --dry-run to apply changes.
```

### Actual Sync
```
Radicle Sync
============

Plan ghi789: Linked 4 commits to plan tasks (marked completed)
Closing issue abc123: "Implement authentication"
  - Added completion comment
  - Marked as solved

Plan jkl012: Linked 2 commits to plan tasks (in progress)
Skipping issue def456: "Add user profiles" (2/5 tasks complete)

Announcing to network... done

Summary:
  - 1 issue closed, 1 plan completed
  - 1 issue in progress (not synced)
```

## Rollup Logic

The key principle is **conservative completion**:

- Issue is marked "solved" ONLY when ALL linked tasks are "completed"
- Partial completion is tracked but not synced to Radicle
- This prevents premature closure of issues with ongoing work

## Notes

- Always run with `--dry-run` first to preview changes
- Only tasks with `source: "radicle"` metadata are considered
- If no Radicle-linked tasks exist, the command will report "No tasks to sync"
- Network announcement requires the Radicle node to be running
- Plan COB sync only runs for tasks with `radicle_plan_id` metadata
