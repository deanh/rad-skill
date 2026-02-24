---
name: rad-plans
description: Knowledge about Radicle Plan COBs (me.hdh.plan) - a custom Collaborative Object type for storing implementation plans in Radicle repositories. Use when working with rad-plan, plan COBs, or implementation planning in Radicle.
---

# Radicle Plan COB Skill

This skill provides knowledge about Plan COBs (`me.hdh.plan`) - a custom Collaborative Object type for storing implementation plans in Radicle repositories.

## What are Plan COBs?

Plan COBs are first-class collaborative objects that store implementation plans within Radicle repositories. They enable:

- **Persisted planning**: Save plan mode exploration as sharable, versioned plans
- **Task tracking**: Track tasks within plans with status, estimates, and dependencies
- **Bidirectional linking**: Link plans to Issues and Patches
- **Network sync**: Plans replicate across the Radicle network like Issues and Patches
- **CRDT semantics**: Conflict-free collaboration on plan updates

## Type Name

```
me.hdh.plan
```

Plans are stored under `refs/cobs/me.hdh.plan/<PLAN-ID>` in the Git repository.

## Plan Structure

A Plan COB contains:

| Field | Description |
|-------|-------------|
| `title` | Plan title |
| `description` | Detailed plan description |
| `status` | Draft, Approved, InProgress, Completed, Archived |
| `tasks[]` | List of tasks with subject, description, estimate, status |
| `related_issues[]` | Linked Radicle issue IDs |
| `related_patches[]` | Linked Radicle patch IDs |
| `critical_files[]` | Files the plan will modify |
| `labels[]` | Plan labels |
| `assignees[]` | Assigned DIDs |
| `discussion` | Thread for comments |

## Task Structure

Each task within a plan:

| Field | Description |
|-------|-------------|
| `id` | Unique task identifier |
| `subject` | Task title |
| `description` | Optional detailed description |
| `estimate` | Time estimate (e.g., "2h", "1d") |
| `status` | Pending, InProgress, Completed, Skipped |
| `blocked_by[]` | IDs of blocking tasks |
| `affected_files[]` | Files this task modifies |
| `linked_issue` | If converted to a Radicle issue |

## CLI Commands

### rad-plan open

Create a new plan:

```bash
rad-plan open "Plan title" --description "Description"
```

### rad-plan list

List all plans:

```bash
rad-plan list
rad-plan list --status in-progress
rad-plan list --all  # Include archived
```

### rad-plan show

Show plan details:

```bash
rad-plan show <plan-id>
rad-plan show <plan-id> --json
```

### rad-plan task add

Add a task:

```bash
rad-plan task add <plan-id> "Task subject" \
  --description "Details" \
  --estimate "4h" \
  --files "src/auth.ts,src/middleware.ts"
```

### rad-plan task edit

Edit a task's details:

```bash
rad-plan task edit <plan-id> <task-id> --subject "Updated title"
rad-plan task edit <plan-id> <task-id> --description "New details"
rad-plan task edit <plan-id> <task-id> --estimate "6h"
rad-plan task edit <plan-id> <task-id> --files "src/client.rs,src/config.rs"
```

All flags are optional. Only provided fields are updated.

### rad-plan task start

Mark task as in-progress:

```bash
rad-plan task start <plan-id> <task-id>
```

### rad-plan task complete

Mark task complete:

```bash
rad-plan task complete <plan-id> <task-id>
```

### rad-plan comment

Add a comment to a plan's discussion thread:

```bash
rad-plan comment <plan-id> "Comment text"
rad-plan comment <plan-id> "Reply text" --reply-to <comment-id>
```

### rad-plan link

Link to issues/patches:

```bash
rad-plan link <plan-id> --issue <issue-id>
rad-plan link <plan-id> --patch <patch-id>
```

### rad-plan export

Export plan:

```bash
rad-plan export <plan-id> --format md
rad-plan export <plan-id> --format json
```

## Claude Code Integration

### Creating Plans from Plan Mode

After completing plan mode exploration, save as a Plan COB:

1. Use `/rad-plan create` command
2. Or use `--save-plan` flag with `/rad-import`

The plan-manager agent handles the creation process.

### Task Metadata

Claude Code tasks created from plans include:

```json
{
  "radicle_plan_id": "abc123...",
  "radicle_plan_task_id": "task-id...",
  "radicle_issue_id": "def456...",
  "source": "radicle"
}
```

### Syncing Status

Use `/rad-plan sync` or `/rad-sync` to synchronize:

- Claude Code task completion → Plan COB task status
- Plan status auto-updates when all tasks complete

## Workflow Example

### 1. Import Issue with Plan

```
/rad-import abc123 --save-plan
```

This:
- Fetches issue details
- Enters plan mode to design implementation
- Creates Plan COB with tasks
- Links plan to issue
- Creates Claude Code tasks with metadata

### 2. Work on Tasks

Complete tasks normally. Claude Code tracks progress locally.

### 3. Sync Progress

```
/rad-plan sync
```

This updates Plan COB task statuses to match Claude Code.

### 4. Close Issue

When all tasks complete:
- Plan status → Completed
- `/rad-sync` marks issue as solved

## Authorization

| Action | Who Can Do It |
|--------|--------------|
| Create plan | Any user |
| Edit plan | Author or delegate |
| Add/edit tasks | Author or delegate |
| Comment | Any user |
| Label/Assign | Delegates only |

## Related Commands

- `/rad-import` - Import issues, optionally create plans
- `/rad-sync` - Sync task completion to issues and plans
- `/rad-status` - View task status including plan links
- `/rad-plan` - Manage plans directly

## Installation

The Plan COB functionality requires:

1. **rad-plan CLI**: Install from the `radicle-plan-cob` repository
2. **Radicle**: Standard Radicle CLI (`rad`)
3. **rad-skill plugin**: This plugin

```bash
# Clone and install rad-plan from Radicle
rad clone rad:z4L8L9ctRYn2bcPuUT4GRz7sggG1v
cd radicle-plan-cob
cargo install --path .

# Verify
rad-plan --version
```

### Detection

The session-start hook automatically detects whether `rad-plan` is installed. If it is not found, the hook will display install instructions. All Plan COB features (`--save-plan`, `/rad-plan`, plan sync) gracefully degrade when `rad-plan` is not available.
