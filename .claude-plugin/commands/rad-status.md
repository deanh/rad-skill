---
name: rad-status
description: Display progress dashboard for Radicle issues and their linked tasks
arguments:
  - name: issue-id
    description: Optional issue ID to show details for a specific issue
    required: false
user_invocable: true
---

# Radicle Status Dashboard

Display progress for Radicle issues with task breakdown, showing completion status across your coding session.

## Instructions

1. **Get all tasks** using the TaskList tool

2. **Filter and group Radicle-linked tasks**:
   - Find tasks with `radicle_issue_id` in metadata
   - Group by issue ID
   - Include `radicle_issue_title` from metadata for display

3. **If a specific issue ID is provided** in arguments:
   - Show detailed view for just that issue
   - Include full task descriptions

4. **Calculate progress for each issue**:
   - Total tasks count
   - Completed tasks count
   - In-progress tasks count
   - Pending tasks count
   - Percentage complete

5. **Display progress dashboard** with visual indicators:

```
Radicle Issue Progress
======================

Issue abc123: "Implement authentication"
  [####################] 4/4 tasks (100%) - READY TO SYNC
  [x] Create auth middleware (completed)
  [x] Add login endpoint (completed)
  [x] Write auth tests (completed)
  [x] Update documentation (completed)

Issue def456: "Add user profiles"
  [########------------] 2/5 tasks (40%)
  [x] Create profile model (completed)
  [x] Add GET /profile endpoint (completed)
  [>] Add profile update endpoint (in_progress)
  [ ] Write profile tests (pending)
  [ ] Add profile to nav (pending)

Issue ghi789: "Fix search bug"
  [--------------------] 0/2 tasks (0%)
  [ ] Investigate search query (pending)
  [ ] Fix and add regression test (pending)

Summary: 3 issues tracked, 1 ready to sync
```

6. **Use status indicators**:
   - `[x]` = completed
   - `[>]` = in_progress
   - `[ ]` = pending
   - `[!]` = blocked (if task has unresolved blockedBy)

7. **Show progress bar** using characters:
   - `#` for completed portion
   - `-` for remaining portion
   - 20 characters total width

8. **Highlight actionable items**:
   - Issues at 100% are "READY TO SYNC"
   - Show blocked tasks if dependencies exist
   - Suggest next actions

## Example: Detailed Single Issue View

When called with an issue ID:

```
$ /rad-status abc123

Issue abc123: "Implement authentication"
==========================================
Repository: rad:z3GhWjk...
Status: READY TO SYNC (4/4 complete)

Tasks:
------
1. Create auth middleware [completed]
   - Set up JWT validation middleware for protected routes

2. Add login endpoint [completed]
   - Implement POST /api/login with credential validation
   - Blocked by: Task 1

3. Write auth tests [completed]
   - Unit tests for middleware, integration tests for login
   - Blocked by: Task 2

4. Update documentation [completed]
   - Document new auth endpoints and requirements
   - Blocked by: Task 2

Next: Run `/rad-sync` to mark this issue as solved in Radicle.
```

## Notes

- If no Radicle-linked tasks exist, display "No Radicle issues imported. Use /rad-import to get started."
- Progress bars are purely visual - actual completion is binary per task
- Use `/rad-sync --dry-run` to preview what would be synced
- Blocked tasks are shown but cannot be worked on until dependencies resolve
