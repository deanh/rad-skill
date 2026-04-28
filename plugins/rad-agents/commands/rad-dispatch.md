---
name: rad-dispatch
description: Analyze a Plan COB and identify tasks ready for dispatch to workers in parallel worktrees
arguments:
  - name: plan-id
    description: The Plan COB ID to analyze for dispatch readiness
    required: true
user_invocable: true
---

# Radicle Dispatch

Analyze a Plan COB and produce a dispatch report showing which tasks are ready for parallel execution in worktrees.

## Instructions

### 1. Read plan state

```bash
rad-plan show <plan-id> --json
```

Parse all tasks with their `linkedCommit`, `blocked_by`, and `affectedFiles`.

### 2. Categorize tasks

| Category | Criteria |
|----------|----------|
| **Completed** | `linkedCommit` is present |
| **In Progress** | CLAIM comment in plan discussion, no `linkedCommit` |
| **Ready** | No `linkedCommit`, no CLAIM, all `blocked_by` have `linkedCommit`, no file conflict |
| **Blocked (dependency)** | A `blocked_by` task lacks `linkedCommit` |
| **Blocked (file conflict)** | Dependencies met but `affectedFiles` overlap with in-progress task |

### 3. Check SIGNAL comments

Parse the plan discussion for `SIGNAL task:<id> files-added:<paths>`. Use expanded file lists for conflict detection.

### 4. Load context feedback

If `rad-context` is available, find Context COBs from recently completed workers:

```bash
rad-context list
rad-context show <context-id> --json
```

Check `related_plans` for this plan. Evaluate:
- **constraints** conflicting with remaining tasks
- **friction** relevant to upcoming tasks' files
- **openItems** suggesting new scope
- **verification** failures that may block dependents

### 5. Output dispatch report

```
Dispatch Report: Plan <plan-id>
================================

## Status
  Completed: 2/5  |  In Progress: 1/5  |  Ready: 1/5  |  Blocked: 1/5

## Recently Completed
  task-a1b2: "Add retry middleware" (linked to 6d6e328)
    Context: ctx-d5e6
    - Constraint: "Assumes tower 0.4 service trait"

## Ready for Dispatch
  task-c3d4: "Add config validation"
    Files: src/config.rs, src/types.rs
    Launch: claude --worktree -- "Execute plan <plan-id> task c3d4"

## Blocked
  task-e5f6: "Add retry tests" — waiting on task-a1b2

## Context Warnings
  ⚠ ctx-d5e6 constraint may affect task-e5f6

## All Complete?
  No — 3 tasks remaining
```

### 6. Plan completion

When all tasks have `linkedCommit`:

```
All tasks complete!
  - Close plan: rad-plan status <plan-id> completed
  - Close issue: rad issue state <issue-id> --closed
  - Or run /rad-sync to handle automatically
```

## Notes

- This command is read-only — it analyzes the plan but does not modify it
- Use the dispatch report to decide which workers to launch
- Workers should be launched with `claude --worktree` for isolation
- Re-run `/rad-dispatch` after each batch completes to see the next wave of ready tasks
