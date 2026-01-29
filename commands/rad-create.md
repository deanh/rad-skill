---
name: rad-create
description: Create Radicle issues from Claude Code tasks or plan files
arguments:
  - name: options
    description: "--from-task <task-id> or --from-plan <plan-file> to specify source"
    required: true
user_invocable: true
---

# Create Radicle Issues

Create Radicle issues from Claude Code artifacts - either from existing tasks or from plan files.

## Usage

```
/rad-create --from-task <task-id>    # Create issue from a task
/rad-create --from-plan <plan-file>  # Create issues from plan sections
```

## Instructions

### Mode 1: From Task (`--from-task <task-id>`)

1. **Get the task details** using TaskGet with the provided task ID

2. **Create a Radicle issue** from the task:
   ```bash
   rad issue open --title "<task-subject>"
   ```

3. **Add the task description as issue body** via comment or description flag:
   ```bash
   rad issue open --title "<subject>" --description "<task-description>"
   ```

4. **Link the issue back to the task** by updating task metadata:
   - Get the new issue ID from the rad command output
   - Update the task with radicle metadata using TaskUpdate

5. **Report the created issue**:
   ```
   Created Radicle issue <id>: "<title>"
   Linked to Task #<task-id>
   ```

### Mode 2: From Plan (`--from-plan <plan-file>`)

1. **Read the plan file** using the Read tool

2. **Parse the plan structure**:
   - Identify major sections (## headers typically)
   - Each section with actionable work becomes an issue
   - Skip meta-sections like "Overview", "Summary"

3. **For each section that should become an issue**:
   - Extract the section title as issue title
   - Extract content as issue description
   - Identify any labels based on content (bug, feature, docs, etc.)

4. **Create Radicle issues**:
   ```bash
   rad issue open --title "<section-title>" --description "<section-content>"
   ```

5. **Optionally add labels**:
   ```bash
   rad issue label <id> --add <label>
   ```

6. **Report all created issues**:
   ```
   Created 3 Radicle issues from plan:

   1. Issue abc123: "Implement core API"
      Labels: feature

   2. Issue def456: "Add authentication"
      Labels: feature, security

   3. Issue ghi789: "Write documentation"
      Labels: docs
   ```

## Example Workflows

### Creating Issue from Untracked Task

If you've been working on something that should be tracked in Radicle:

```
# You have Task #5: "Refactor database layer"
/rad-create --from-task 5

# Output:
Created Radicle issue f7e8a9b: "Refactor database layer"
Description: Restructure the database access layer for better testability...
Linked to Task #5

The task now has radicle_issue_id metadata for sync.
```

### Creating Issues from Feature Plan

When you have a detailed plan that should become trackable issues:

```
# You have feature-plan.md with sections for each component
/rad-create --from-plan feature-plan.md

# Output:
Analyzing plan: feature-plan.md
Found 4 actionable sections:

Creating issues...
1. Issue a1b2c3: "Set up project structure"
2. Issue d4e5f6: "Implement data models"
3. Issue g7h8i9: "Create API endpoints"
4. Issue j0k1l2: "Add test coverage"

Created 4 Radicle issues. Use /rad-import to import them as tasks.
```

## Plan Parsing Guidelines

When parsing a plan file, consider:

**Good candidates for issues:**
- Sections describing features to build
- Sections with clear acceptance criteria
- Sections describing bugs to fix
- Sections with implementation details

**Skip these sections:**
- "Overview" / "Introduction" / "Background"
- "Summary" / "Conclusion"
- "Notes" / "References"
- Meta-discussion sections

**Label detection heuristics:**
- Contains "bug", "fix", "broken" → `bug` label
- Contains "test", "coverage" → `test` label
- Contains "doc", "readme", "guide" → `docs` label
- Contains "security", "auth", "permission" → `security` label
- Default to `feature` for new functionality

## Notes

- When creating from plan, use the `issue-planner` agent for more intelligent parsing
- Created issues are independent - use `/rad-import` to import them as linked tasks
- Issues are created in the current Radicle repository (run `rad .` to verify)
- Remember to run `rad sync --announce` to propagate new issues to the network
