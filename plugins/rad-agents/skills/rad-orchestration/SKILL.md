---
name: rad-orchestration
description: Multi-agent orchestration for Radicle plans — worktree isolation, task dispatch, CLAIM/SIGNAL conventions, and context feedback loops. Use when dispatching tasks to workers, launching worktree agents, or evaluating multi-agent progress.
---

# Radicle Orchestration

Orchestration conventions for multi-agent parallel execution using Plan COBs as the coordination layer and git worktrees for isolation.

## Model

One plan drives the work. Each task is executed by a worker agent in an isolated git worktree. Workers produce one commit and one Context COB per task. The plan-manager dispatches tasks and evaluates feedback between batches.

## Task Readiness

A task is **ready** when:
1. It has no `linkedCommit` (not done)
2. No CLAIM comment exists for it (not in progress)
3. All `blocked_by` tasks have `linkedCommit` (dependencies met)
4. Its `affectedFiles` don't overlap with any in-progress task's files (no conflict)

## CLAIM/SIGNAL Protocol

- **CLAIM**: Worker posts `CLAIM task:<task-id>` as a plan comment before starting work
- **SIGNAL**: Worker posts `SIGNAL task:<task-id> files-added:<paths>` if modifying files beyond the original `affectedFiles`, and updates the task via `rad-plan task edit <plan-id> <task-id> --files "<updated-list>"`

These are conventions, not locks. The plan-manager is the sole dispatcher — workers do not self-select tasks.

## Dispatch Flow

1. Read plan state: `rad-plan show <plan-id> --json`
2. Categorize tasks: Completed / In Progress / Ready / Blocked (dependency) / Blocked (file conflict)
3. Check SIGNAL comments for expanded file scopes
4. Load Context COBs from recently completed tasks for feedback
5. Output structured dispatch report with ready tasks and context warnings

## Worker Lifecycle

1. Claim task (plan comment)
2. Read assignment (plan JSON + linked issue)
3. Load prior Context COBs (by plan, task, or file overlap)
4. Implement the change (one logical commit)
5. Create Context COB (reflect on session, run verification)
6. Link Context COB to plan, issue, commit
7. Mark done: `rad-plan task link-commit <plan-id> <task-id> --commit <oid>`
8. Announce: `rad sync --announce`

## Context Feedback Evaluation

Between dispatch batches, evaluate completed workers' contexts:

| Context Field | Signal |
|---|---|
| `constraints` conflicting with later tasks | Assumption clash — flag it |
| `friction` relevant to upcoming tasks' files | Same pitfall ahead — warn |
| `openItems` suggesting new scope | Discovered work — suggest new task |
| `filesTouched` outside `affectedFiles` | Unexpected file changes — re-check conflicts |
| `verification` failures | Check didn't pass — consider blocking dependents |

## Plan Completion

When all tasks have `linkedCommit`:
- Set plan status: `rad-plan status <plan-id> completed`
- Close linked issue: `rad issue state <issue-id> --closed`
- Announce: `rad sync --announce`
