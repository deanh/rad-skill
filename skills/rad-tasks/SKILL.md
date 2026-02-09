---
name: Radicle Tasks
description: This skill should be used when the user asks about "radicle task integration", "import radicle issues", "sync tasks to radicle", "rad-import", "rad-sync", "rad-status", "track radicle issues", "link tasks to issues", "radicle workflow", or mentions connecting Claude Code tasks with Radicle issues.
version: 0.1.0
---

# Radicle Task Integration

This skill enables bidirectional sync between Radicle issues and Claude Code's task management system, allowing you to track development progress at the feature level while working at the task level.

## Core Concept: 1:Many Issue-to-Task Mapping

Radicle issues are **feature-level** ("Implement authentication"), while Claude Code tasks are **session-level work items** ("Create middleware", "Write tests"). One issue typically becomes multiple tasks.

```
Radicle Issue (feature-level)
    |
    +-- Claude Code Task 1 (work item)
    +-- Claude Code Task 2 (work item)
    +-- Claude Code Task 3 (work item)
    |
    v
All tasks complete → Issue marked "solved"
```

### Task Metadata Linking

Tasks are linked to their parent issue via metadata:

```json
{
  "radicle_issue_id": "abc123def456...",
  "radicle_repo": "rad:z3GhWjk...",
  "radicle_issue_title": "Implement authentication",
  "source": "radicle"
}
```

## Available Commands

### /rad-import <issue-id>

Import a Radicle issue and break it down into actionable tasks:

```
/rad-import abc123
```

This will:
1. Fetch the issue details from Radicle
2. Analyze the issue to identify work items
3. Create Claude Code tasks with appropriate metadata
4. Set up task dependencies where applicable

### /rad-status [issue-id]

View progress dashboard for imported issues:

```
/rad-status           # Show all issues
/rad-status abc123    # Show specific issue
```

Displays:
- Progress bars per issue
- Task completion status
- Which issues are ready to sync

### /rad-sync [--dry-run]

Sync completed work back to Radicle:

```
/rad-sync --dry-run   # Preview what would sync
/rad-sync             # Actually sync to Radicle
```

Uses **rollup logic**: an issue is only marked "solved" when ALL linked tasks are completed.

### /rad-issue

Create Radicle issues from a description, task, or plan file:

```
/rad-issue Add user profile page   # Create issue with agent research
/rad-issue --from-task 5           # Create issue from existing task
/rad-issue --from-plan plan.md     # Create issues from plan sections
```

For non-trivial descriptions, dispatches three specialist research roles in parallel (product analysis, UX design, technical planning) to generate comprehensive issue content. Supports `--light`, `--standard`, `--deep` depth flags and `--single`, `--multi` splitting flags.

## Rollup Sync Logic

The sync uses conservative completion to prevent premature issue closure:

```
Issue: "Implement authentication"
├── Task 1: completed  ✓
├── Task 2: completed  ✓
├── Task 3: in_progress  ←  Issue stays OPEN
└── Task 4: pending

Result: Issue NOT closed (only 2/4 complete)
```

**Issue is marked "solved" ONLY when:**
- ALL linked tasks have status "completed"
- No tasks are "in_progress" or "pending"

## Complete Workflow

### Starting a Session

1. **Session starts** in a Radicle repo
2. System detects open issues and suggests `/rad-import`
3. Import the issue you want to work on:
   ```
   /rad-import abc123
   ```

### Working on Tasks

4. View your tasks with `/rad-status`
5. Work on tasks, marking them complete as you go
6. Claude Code tracks completion via TaskUpdate

### Ending a Session

7. Check progress: `/rad-status`
8. Preview sync: `/rad-sync --dry-run`
9. Sync completed work: `/rad-sync`
10. Radicle announces changes to the network

## Best Practices

### Task Granularity

Aim for tasks that are:
- **Independently completable** - Can be finished in one sitting
- **Clearly scoped** - Has obvious "done" criteria
- **Appropriately sized** - 1-4 hours of work each

### Breaking Down Issues

Good task breakdown:
```
Issue: "Add user authentication"
├── Create auth middleware
├── Add login endpoint
├── Add logout endpoint
├── Write auth tests
└── Update API documentation
```

Avoid:
- Single tasks that replicate the whole issue
- Tasks too small to be meaningful ("Add import statement")
- Vague tasks ("Do auth stuff")

### Managing Dependencies

Use task blocking when order matters:
```
Task 2 (Add endpoints) blocked by Task 1 (Create middleware)
Task 3 (Write tests) blocked by Task 2
```

This ensures tasks are worked in the right order.

## Troubleshooting

### "No Radicle issues imported"

Run `/rad-import <issue-id>` to import an issue first.

### Issue not closing on sync

Check `/rad-status` - all tasks must be "completed" for the issue to close. Look for tasks still in_progress or pending.

### Sync fails

Ensure:
1. Radicle node is running: `rad node status`
2. You have permission to modify the issue
3. Network connectivity is available

## Related Commands

- `rad issue list` - List all Radicle issues
- `rad issue show <id>` - View issue details
- `rad sync status` - Check Radicle sync status
