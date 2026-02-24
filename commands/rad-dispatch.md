---
name: rad-dispatch
description: Analyze a Plan COB and identify tasks ready for dispatch to workers in parallel worktrees
arguments:
  - name: plan-id
    description: The Plan COB ID to dispatch from (short form like 'abc123' or full ID)
    required: true
user_invocable: true
---

# Dispatch Tasks from Plan COB

Analyze a Plan COB to identify which tasks are ready for parallel execution in worktrees, surface context feedback from completed workers, and provide dispatch instructions.

## Instructions

1. **Verify prerequisites**:

```bash
command -v rad-plan >/dev/null 2>&1
```

If `rad-plan` is not installed, report and suggest installation.

2. **Load the plan**:

```bash
rad-plan show <plan-id> --json
```

Parse the full JSON to get:
- Plan title, status, description
- All tasks with: id, subject, description, status, blocked_by, affected_files, linked_issue
- Related issues and patches
- Discussion thread (for SIGNAL comments)

3. **Categorize all tasks**:

For each task, determine its category:

- **Completed**: status = "completed"
- **In Progress**: status = "inProgress"
- **Ready**: status = "pending" AND all `blocked_by` tasks are "completed" AND no `affected_files` overlap with any in-progress task's files
- **Blocked (dependency)**: status = "pending" AND at least one `blocked_by` task is not "completed"
- **Blocked (file conflict)**: status = "pending" AND all dependencies met BUT `affected_files` overlap with an in-progress task's files

4. **Check for SIGNAL comments** in the plan's discussion thread:

Look for comments matching the pattern:
```
SIGNAL task:<task-id> files-added:<paths>
```

If found, expand the in-progress task's effective file scope when checking conflicts. This catches cases where a worker discovered it needed to modify additional files.

5. **Load context feedback** from completed workers (if `rad-context` is available):

```bash
command -v rad-context >/dev/null 2>&1
```

If available:
```bash
rad-context list
```

For each context, check if it links to this plan:
```bash
rad-context show <context-id> --json
```

For relevant contexts (linked to this plan via `related_plans`), extract:
- **constraints** that may affect upcoming tasks
- **friction** that upcoming workers should avoid
- **open_items** that suggest new work
- **learnings** that inform remaining tasks

Cross-reference context fields against remaining tasks:
- Flag constraint conflicts (e.g., context says "assumes X" but a later task plans to change X)
- Flag friction relevant to upcoming tasks' affected files
- Surface open items that aren't covered by existing tasks

6. **Present the dispatch report**:

```
Dispatch: <plan-title> (<plan-id>)
====================================

Status: 2/5 completed | 1 in progress | 1 ready | 1 blocked

── Completed ──────────────────────────────
  ✓ task-a1b2: "Add retry middleware"
  ✓ task-g7h8: "Update config schema"

── In Progress ────────────────────────────
  ◉ task-c3d4: "Add config validation"
    Files: src/config.rs, src/types.rs

── Ready for Dispatch ─────────────────────
  ○ task-e5f6: "Add retry tests"
    Files: tests/retry.rs, tests/helpers.rs
    Worktree: worktree-e5f6-retry-tests
    Start: rad-plan task start <plan-id> task-e5f6

── Blocked ────────────────────────────────
  ✕ task-i9j0: "Integration tests"
    Waiting on: task-c3d4 (in progress), task-e5f6 (pending)

── Context Feedback ───────────────────────
  From ctx-d5e6 (task-a1b2 session):
    ⚠ Constraint: "Assumes tower 0.4 service trait"
      → May affect task-e5f6 which tests retry behavior
    ℹ Friction: "tower::retry requires Clone on Request"
      → Relevant to task-e5f6
    ℹ Learning: src/client.rs:45 — "HTTP client wraps tower::ServiceBuilder"
```

7. **For each ready task**, include worker launch guidance:

```
To dispatch task-e5f6:
  1. Open a new terminal
  2. Launch: claude --worktree worktree-e5f6
  3. Tell the worker: "Execute plan-id task-e5f6 from plan <plan-id>"
```

8. **When all tasks are complete**, offer to close the plan:

```
All tasks complete!

Actions:
  - Close plan: rad-plan status <plan-id> completed
  - Close issue: rad issue state <issue-id> --closed
  - Linked patches: patch-b3c4, patch-f5g6, patch-h7i8

Close the plan and issue now?
```

Use `AskUserQuestion` to confirm before closing.

## Notes

- Run `/rad-dispatch` iteratively between batches — it reads fresh plan state each time
- File conflict detection uses `affected_files` from the Plan COB plus any SIGNAL comments from workers
- Context feedback is loaded from `rad-context` if available; gracefully skipped if not installed
- Task claiming is convention-based — the coordinator (this command) is the sole dispatcher
