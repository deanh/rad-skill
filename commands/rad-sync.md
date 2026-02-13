---
name: rad-sync
description: Sync completed tasks back to Radicle issues with rollup logic
arguments:
  - name: options
    description: Optional flags like --dry-run to preview without making changes
    required: false
user_invocable: true
---

# Radicle Sync

Synchronize Claude Code task completions back to Radicle issues. Uses rollup logic - an issue is only marked "solved" when ALL linked tasks are completed.

## Instructions

1. **Get all tasks** using the TaskList tool

2. **Group tasks by Radicle issue**:
   - Filter tasks that have `radicle_issue_id` in their metadata
   - Group tasks by their `radicle_issue_id`

3. **For each issue, calculate completion status**:
   - Count total tasks linked to this issue
   - Count completed tasks (status: "completed")
   - Determine if ALL tasks are complete

4. **Handle dry-run mode** if `--dry-run` is in the arguments:
   - Show what would be synced without making changes
   - Display completion percentages per issue

5. **For fully completed issues** (all tasks done):
   - Mark the Radicle issue as solved:
   ```bash
   rad issue state <issue-id> --closed
   ```
   - Add a completion comment:
   ```bash
   rad issue comment <issue-id> --message "Completed via Claude Code session. Tasks completed: [list task subjects]"
   ```

6. **For partially completed issues**:
   - Report progress but do not close the issue
   - Show which tasks remain

7. **Announce changes to the network**:
   ```bash
   rad sync --announce
   ```

8. **Offer context creation** for fully closed issues:

   If any issues were closed in step 5 and `rad-context` is installed:

   ```bash
   command -v rad-context >/dev/null 2>&1
   ```

   Use `AskUserQuestion` to offer creating a Context COB:

   ```
   Issue <id> has been closed. Would you like to create a Context COB
   to preserve session observations (approach, constraints, learnings, friction)?
   ```

   Options:
   - "Create context" — Run `/rad-context create` (which gathers data and asks Claude to reflect)
   - "Skip" — Continue without creating context

   This is a natural workflow boundary — the issue is done, making it an ideal moment to capture observations. Advisory only; context creation requires user opt-in.

9. **Report sync summary**:
   - Issues fully synced (marked solved)
   - Issues with partial progress
   - Any errors encountered

## Example Output

### Dry Run
```
$ /rad-sync --dry-run

Radicle Sync Preview (dry run)
==============================

Issue abc123: "Implement authentication"
  Status: READY TO CLOSE (4/4 tasks complete)
  Tasks:
    [x] Create auth middleware
    [x] Add login endpoint
    [x] Write auth tests
    [x] Update documentation

Issue def456: "Add user profiles"
  Status: IN PROGRESS (2/5 tasks complete)
  Tasks:
    [x] Create profile model
    [x] Add GET /profile endpoint
    [ ] Add profile update endpoint
    [ ] Write profile tests
    [ ] Add profile to nav

Summary: 1 issue ready to close, 1 issue in progress
Run without --dry-run to apply changes.
```

### Actual Sync
```
$ /rad-sync

Radicle Sync
============

Closing issue abc123: "Implement authentication"
  - Added completion comment
  - Marked as solved

Skipping issue def456: "Add user profiles" (2/5 tasks complete)

Announcing to network... done

Summary:
  - 1 issue closed
  - 1 issue in progress (not synced)
```

## Rollup Logic

The key principle is **conservative completion**:

- Issue is marked "solved" ONLY when ALL linked tasks are "completed"
- Partial completion is tracked but not synced to Radicle
- This prevents premature closure of issues with ongoing work

```
Tasks for issue abc123:
  Task 1: completed  ✓
  Task 2: completed  ✓
  Task 3: in_progress  ←  Issue stays OPEN
  Task 4: pending

Result: Issue NOT closed (2/4 complete)
```

## Plan COB Synchronization

When tasks have `radicle_plan_id` and `radicle_plan_task_id` metadata, also sync to Plan COBs:

1. **Group tasks by Plan** using `radicle_plan_id` metadata

2. **Update Plan COB task statuses**:
   - For completed Claude Code tasks, mark corresponding Plan COB tasks as completed:
   ```bash
   rad-plan task complete <plan-id> <plan-task-id>
   ```
   - For in-progress Claude Code tasks, mark as in-progress:
   ```bash
   rad-plan task start <plan-id> <plan-task-id>
   ```

3. **Update Plan status** when all tasks complete:
   ```bash
   rad-plan status <plan-id> completed
   ```

4. **Report Plan sync status** in the summary:
   ```
   Plan Sync Summary:
     Plan abc123: 4/4 tasks synced (marked completed)
     Plan def456: 2/5 tasks synced (in progress)
   ```

## Notes

- Always run with `--dry-run` first to preview changes
- Only tasks with `source: "radicle"` metadata are considered
- If no Radicle-linked tasks exist, the command will report "No tasks to sync"
- Network announcement requires the Radicle node to be running
- Plan COB sync only runs for tasks with `radicle_plan_id` metadata
