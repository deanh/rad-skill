---
name: rad-import
description: Import a Radicle issue and break it down into actionable Claude Code tasks
arguments:
  - name: issue-id
    description: The Radicle issue ID to import (short form like 'abc123' or full ID)
    required: true
  - name: --no-plan
    description: Skip entering plan mode and just create tasks without designing an implementation approach
    required: false
user_invocable: true
---

# Radicle Issue Import

Import a Radicle issue and break it down into actionable Claude Code tasks for your coding session.

## Instructions

1. **Ask about plan mode** (unless `--no-plan` flag was passed):
   - Use `AskUserQuestion` immediately with these options:
     - "Enter plan mode (Recommended)" - Will explore codebase and design implementation approach before creating tasks
     - "Skip planning" - Create tasks directly without planning phase
   - If user selects plan mode, use `EnterPlanMode` tool and wait for approval
   - If user selects skip, proceed directly to fetching the issue

2. **Fetch the issue details** using the Radicle CLI:

```bash
rad issue show <issue-id>
```

3. **Analyze the issue** to understand:
   - The overall goal/feature being requested
   - Any acceptance criteria mentioned
   - Technical requirements or constraints
   - Related code files or components mentioned

4. **Break down into discrete tasks** targeting 1-4 hour chunks of work:
   - Identify logical work units (e.g., "Create middleware", "Write tests", "Update docs")
   - Consider dependencies between tasks
   - Each task should be independently completable

5. **Create Claude Code tasks** using the TaskCreate tool for each work item:

For each task, include this metadata to link it to the parent issue:
```json
{
  "radicle_issue_id": "<the-issue-id>",
  "radicle_repo": "<output-of-rad-.>",
  "radicle_issue_title": "<issue-title>",
  "source": "radicle"
}
```

6. **Set up task dependencies** using TaskUpdate if tasks must be completed in order:
   - Use `addBlockedBy` to indicate prerequisites
   - Use `addBlocks` to indicate what a task enables

7. **Report the import summary**:
   - Number of tasks created
   - Brief description of each task
   - Any suggested implementation order
   - Note any ambiguities that might need clarification

8. **Design implementation approach** (if in plan mode):
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
- Multiple tasks can share the same `radicle_issue_id` - this enables rollup sync
- Use `/rad-status` to view progress across all imported issues
- Use `/rad-sync` when tasks are complete to update the Radicle issue
