---
name: rad-cobs
description: Knowledge about Radicle Plan COBs (me.hdh.plan) and Context COBs (me.hdh.context) for task workflows, implementation planning, and session observation capture. Use when working with rad-plan, rad-context, Plan COBs, Context COBs, importing issues as tasks, syncing tasks, or multi-agent orchestration.
---

# Radicle COBs — Plans and Contexts

Plan COBs and Context COBs are custom Radicle Collaborative Objects that extend Radicle with structured planning and session observation capabilities.

## Plan COBs (`me.hdh.plan`)

Implementation plans stored as first-class Radicle objects. They track tasks with estimates, dependencies, and commit-based completion, and link bidirectionally to issues and patches.

**Key fields**: title, description, status (Draft/Approved/InProgress/Completed/Archived), tasks[], related_issues[], related_patches[], critical_files[], labels[], discussion.

**Task fields**: id, subject, description, estimate, affectedFiles[], linkedCommit, blocked_by[], linked_issue.

**Task completion model**: Tasks have no mutable status field. A task is **done** when `linkedCommit` is present. Mark done via `rad-plan task link-commit <plan-id> <task-id> --commit <oid>`.

### Plan CLI Quick Reference

| Task | Command |
|------|---------|
| Create plan | `rad-plan open "title" --description "desc"` |
| List plans | `rad-plan list` |
| Show plan | `rad-plan show <plan-id>` (add `--json` for JSON) |
| Add task | `rad-plan task add <plan-id> "subject" --estimate "4h" --files "a.ts,b.ts"` |
| Edit task | `rad-plan task edit <plan-id> <task-id> --subject "new" --estimate "6h"` |
| Mark done | `rad-plan task link-commit <plan-id> <task-id> --commit <oid>` |
| Set status | `rad-plan status <plan-id> in-progress` |
| Link to issue | `rad-plan link <plan-id> --issue <issue-id>` |
| Comment | `rad-plan comment <plan-id> "text"` |
| Export | `rad-plan export <plan-id> --format md` |

All commands accept **short-form IDs** (minimum 7 hex characters). For full CLI reference, read `references/plan-commands.md`.

## Context COBs (`me.hdh.context`)

Immutable session observation records that capture what an agent learned during a coding session — approach, constraints, learnings, friction, and open items.

**Key fields**: title, description, approach, constraints[], learnings (repo[] + code[]), friction[], open_items[], files_touched[], verification[], task_id, related_commits[], related_issues[], related_patches[], related_plans[].

**JSON uses camelCase**: openItems, filesTouched, taskId.

### Agent-Utility Priority Order

When consuming contexts, surface fields in this order:
1. **constraints** — Guard rails that affect correctness
2. **friction** — Avoid repeating past mistakes
3. **learnings** — Accelerate codebase understanding
4. **approach** — Understand reasoning and rejected alternatives
5. **open_items** — Know what's incomplete

### Context CLI Quick Reference

| Task | Command |
|------|---------|
| Create (JSON) | `echo '<json>' \| rad-context create --json` |
| Create (flags) | `rad-context create "title" --approach "..." --constraint "..."` |
| List | `rad-context list` |
| Show | `rad-context show <id>` (add `--json` for JSON) |
| Link | `rad-context link <id> --issue <issue-id> --plan <plan-id> --commit <sha>` |

For full CLI reference and JSON schema, read `references/context-commands.md` and `references/context-json-schema.md`.

## Plan vs Context

| Aspect | Plan COB | Context COB |
|--------|----------|-------------|
| Purpose | Coordination — the "what" | Observation — the "how" |
| Content | Intent, tasks, status | Approach, learnings, friction |
| Lifecycle | Draft -> Completed -> Archived | Created once (immutable core) |
| Mutability | Most fields mutable | Core immutable, links mutable |

## Claude Code Task Metadata

Tasks created from Radicle issues/plans carry metadata for bidirectional sync:

```json
{
  "radicle_issue_id": "<issue-id>",
  "radicle_repo": "<rid>",
  "radicle_issue_title": "<title>",
  "radicle_plan_id": "<plan-id>",
  "radicle_plan_task_id": "<task-id>",
  "source": "radicle"
}
```

## Orchestration Conventions

For multi-agent worktree workflows:

- Workers **claim** tasks by posting `CLAIM task:<task-id>` as a plan comment
- Workers **signal** file scope changes via `SIGNAL task:<task-id> files-added:<paths>`
- **affectedFiles** on tasks enables file conflict detection between parallel workers
- **blocked_by** determines task ordering; a task is ready only when all blockers have `linkedCommit`
- Workers produce **one commit + one Context COB** per task
- COBs live in `~/.radicle/storage/` — visible from all worktrees without sync

## Installation

**rad-plan CLI**:
```bash
rad clone rad:z4L8L9ctRYn2bcPuUT4GRz7sggG1v
cd radicle-plan-cob && cargo install --path .
```

**rad-context CLI**:
```bash
rad clone rad:z2qBBbhVCfMiFEWN55oXKTPmKkrwY
cd radicle-context-cob && cargo install --path .
```

Both are optional — features gracefully degrade when their CLI is not installed.
