---
name: rad-import
description: Import a Radicle issue and break it down into actionable Claude Code tasks
arguments:
  - name: issue-id
    description: The Radicle issue ID to import (short form like 'abc123' or full ID)
    required: true
user_invocable: true
---

# Radicle Issue Import

Import a Radicle issue and break it down into actionable Claude Code tasks for your coding session.

## Instructions

### 1. Ask about plan mode

Use `AskUserQuestion` immediately with these options:
- "Enter plan mode (Recommended)" — Will explore codebase and design implementation approach before creating tasks
- "Skip planning" — Create tasks directly without planning phase

If user selects plan mode, use `EnterPlanMode` tool and wait for approval.
If user selects skip, proceed directly to fetching the issue.

### 2. Fetch the issue details

```bash
rad issue show <issue-id>
```

### 3. Load related contexts

Query for Context COBs linked to this issue to surface prior session knowledge.

```bash
# Check if rad-context is available
command -v rad-context >/dev/null 2>&1
```

If available:

**Query by link (primary)** — Find contexts linked to this issue:

```bash
rad-context list
rad-context show <context-id> --json
```

Parse JSON output. Check `related_issues` for this issue ID.

**Query by files (secondary)** — If the issue mentions specific files, find contexts whose `filesTouched` overlap:

```bash
rad-context show <context-id> --json
```

Compare `filesTouched` against files referenced in the issue.

**Surface in priority order:**
1. **Constraints** — Guard rails that affect correctness
2. **Friction** — Avoid repeating past mistakes
3. **Learnings** — Accelerate codebase understanding
4. **Approach** — Understand reasoning and rejected alternatives
5. **Open items** — Know what's incomplete
6. **Verification** — What checks passed/failed

**Multiple contexts**: Present chronologically (oldest first). Flag conflicting constraints across contexts.

Include these in the planning phase so prior session knowledge informs task design.

### 4. Analyze the issue

Understand:
- The overall goal/feature being requested
- Any acceptance criteria mentioned
- Technical requirements or constraints
- Related code files or components mentioned

### 5. Break down into discrete tasks

Target 1–4 hour chunks of work:
- Identify logical work units (e.g., "Create middleware", "Write tests", "Update docs")
- Consider dependencies between tasks
- Each task should be independently completable

### 6. Create Claude Code tasks

Use the `TaskCreate` tool for each work item. Include this metadata to link to the parent issue:

```json
{
  "radicle_issue_id": "<the-issue-id>",
  "radicle_repo": "<output-of-rad-.>",
  "radicle_issue_title": "<issue-title>",
  "source": "radicle"
}
```

### 7. Set up task dependencies

Use `TaskUpdate` if tasks must be completed in order:
- Use `addBlockedBy` to indicate prerequisites
- Use `addBlocks` to indicate what a task enables

### 8. Report the import summary

- Number of tasks created
- Brief description of each task
- Any suggested implementation order
- Note any ambiguities that might need clarification

### 9. Offer to save as Plan COB

After tasks are created, if `rad-plan` is installed:

```bash
command -v rad-plan >/dev/null 2>&1
```

Use `AskUserQuestion` to offer:
- "Save as Plan COB" — Persist the plan for sharing and tracking
- "Skip" — Continue with session tasks only

If user chooses to save:

1. Create the Plan COB:
```bash
rad-plan open "<issue-title>" --description "<plan-description>"
```

2. Add tasks to the Plan COB:
```bash
rad-plan task add <plan-id> "<task-subject>" --description "<task-description>" --estimate "<estimate>"
```

3. Link the Plan to the Issue:
```bash
rad-plan link <plan-id> --issue <issue-id>
```

4. Store Plan metadata in each Claude Code task:
```json
{
  "radicle_issue_id": "<the-issue-id>",
  "radicle_plan_id": "<the-plan-id>",
  "radicle_plan_task_id": "<the-plan-task-id>",
  "radicle_repo": "<output-of-rad-.>",
  "source": "radicle"
}
```

5. Announce to network:
```bash
rad sync --announce
```

### 10. Design implementation approach (if in plan mode)

- Explore the codebase to understand existing patterns and architecture
- Identify key files that will need modification
- Draft an implementation plan for the first unblocked task
- Use `ExitPlanMode` when the plan is ready for user approval

## Example Output

After importing issue `abc123: "Implement user authentication"`:

```
Imported issue abc123: "Implement user authentication"
Created 4 tasks:

1. Create auth middleware (Task #1)
   - Set up JWT validation middleware
   - Blocked by: none

2. Add login endpoint (Task #2)
   - Implement POST /api/login with credential validation
   - Blocked by: Task #1

3. Write auth tests (Task #3)
   - Unit tests for middleware and integration tests for login
   - Blocked by: Task #2

4. Update API documentation (Task #4)
   - Document new auth endpoints and requirements
   - Blocked by: Task #2

Run `/rad-status` to see progress, or start working on Task #1.
```

## Notes

- If the issue is too vague to break down, create a single task and note that clarification may be needed
- Multiple tasks can share the same `radicle_issue_id` — this enables rollup sync
- Use `/rad-status` to view progress across all imported issues
- Use `/rad-sync` when tasks are complete to update the Radicle issue
