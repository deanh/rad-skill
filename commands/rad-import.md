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
  - name: --save-plan
    description: Save the implementation plan as a Plan COB (me.hdh.plan) for sharing and tracking
    required: false
  - name: --dispatch
    description: After creating the plan, immediately show dispatch instructions for parallel worker execution
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

3. **Load related contexts** (if `rad-context` is installed):

   Query for Context COBs linked to this issue to surface prior session knowledge:

   ```bash
   # Check if rad-context is available
   command -v rad-context >/dev/null 2>&1
   ```

   If available, list contexts and check each for links to this issue:

   ```bash
   rad-context list
   rad-context show <context-id> --json
   ```

   For each context whose `related_issues` includes this issue ID, extract and present:
   - **Constraints** — Guard rails to follow (highest priority)
   - **Friction** — Past problems to avoid
   - **Learnings** — Codebase discoveries that accelerate understanding
   - **Open items** — Unfinished work from prior sessions

   Include these in the planning phase so prior session knowledge informs task design.

4. **Analyze the issue** to understand:
   - The overall goal/feature being requested
   - Any acceptance criteria mentioned
   - Technical requirements or constraints
   - Related code files or components mentioned

5. **Break down into discrete tasks** targeting 1-4 hour chunks of work:
   - Identify logical work units (e.g., "Create middleware", "Write tests", "Update docs")
   - Consider dependencies between tasks
   - Each task should be independently completable

6. **Create Claude Code tasks** using the TaskCreate tool for each work item:

For each task, include this metadata to link it to the parent issue:
```json
{
  "radicle_issue_id": "<the-issue-id>",
  "radicle_repo": "<output-of-rad-.>",
  "radicle_issue_title": "<issue-title>",
  "source": "radicle"
}
```

7. **Set up task dependencies** using TaskUpdate if tasks must be completed in order:
   - Use `addBlockedBy` to indicate prerequisites
   - Use `addBlocks` to indicate what a task enables

8. **Report the import summary**:
   - Number of tasks created
   - Brief description of each task
   - Any suggested implementation order
   - Note any ambiguities that might need clarification

9. **Design implementation approach** (if in plan mode):
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

## Saving as Plan COB (--save-plan)

When `--save-plan` is passed, create a Plan COB to persist the implementation plan:

1. **Create the Plan COB** using the rad-plan CLI:
```bash
rad-plan open "<issue-title>" --description "<plan-description>"
```

2. **Add tasks to the Plan COB**:
```bash
rad-plan task add <plan-id> "<task-subject>" --description "<task-description>" --estimate "<estimate>"
```

3. **Link the Plan to the Issue**:
```bash
rad-plan link <plan-id> --issue <issue-id>
```

4. **Store Plan metadata** in each Claude Code task:
```json
{
  "radicle_issue_id": "<the-issue-id>",
  "radicle_plan_id": "<the-plan-id>",
  "radicle_plan_task_id": "<the-plan-task-id>",
  "radicle_repo": "<output-of-rad-.>",
  "source": "radicle"
}
```

5. **Announce to network**:
```bash
rad sync --announce
```

This enables bidirectional sync between Claude Code tasks and the Plan COB tasks.

## Dispatch Mode (--dispatch)

When `--dispatch` is passed (implies `--save-plan`), after creating the Plan COB, immediately show dispatch instructions:

1. **Create the Plan COB** as in the `--save-plan` flow above
2. **Set plan status to approved**:
```bash
rad-plan status <plan-id> approved
```
3. **Run dispatch analysis** — categorize tasks as Ready, Blocked (dependency), or Blocked (file conflict) using the same logic as `/rad-dispatch`:
   - Ready: pending, all dependencies met, no file overlap with in-progress tasks
   - Blocked: pending, has unmet dependencies or file conflicts
4. **Present dispatch instructions** for each ready task, including:
   - Task ID, subject, affected files
   - Suggested worktree name
   - Worker launch guidance
5. **Inform the user** they can re-run `/rad-dispatch <plan-id>` after workers complete to see the next batch

## Notes

- If the issue is too vague to break down, create a single task and note that clarification may be needed
- Multiple tasks can share the same `radicle_issue_id` - this enables rollup sync
- Use `/rad-status` to view progress across all imported issues
- Use `/rad-sync` when tasks are complete to update the Radicle issue
- Use `/rad-plan sync` to sync task completion to Plan COBs
- Use `/rad-dispatch` to see which tasks are ready for parallel worker execution
