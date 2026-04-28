---
name: rad-context
description: Create, list, show, and link Context COBs that capture AI session observations
arguments:
  - name: subcommand
    description: "Action to perform: create, list, show <id>, link <id>"
    required: true
user_invocable: true
---

# Radicle Context Management

Manage Context COBs (`me.hdh.context`) that preserve session observations — approach, constraints, learnings, friction — for future AI sessions.

## Subcommands

Parse the first argument to determine the subcommand:
- `create` — Create a new context from this session
- `list` — List existing contexts
- `show <id>` — Show context details
- `link <id>` — Add links to a context

## `/rad-context create`

The primary mechanism for creating Context COBs. This requires Claude's active participation — the valuable fields (approach, constraints, learnings, friction) come from Claude reflecting on the session.

### Instructions

1. **Check prerequisites**:
   ```bash
   command -v rad-context && rad . 2>/dev/null
   ```
   If `rad-context` is not installed, show install instructions and stop.

2. **Gather mechanical data automatically**:

   Collect data that doesn't require reflection:

   ```bash
   # Files changed in this session (from git)
   git diff --stat HEAD~5 --name-only 2>/dev/null || git diff --stat --name-only

   # Recent commits
   git log --oneline -10
   ```

   Also check `TaskList` for tasks with `radicle_issue_id`, `radicle_plan_id`, `radicle_plan_task_id`, or `radicle_patch_id` metadata — these provide auto-link targets and the task ID for the `taskId` field.

3. **Reflect on the session** to fill agent-first fields:

   Based on your understanding of the work done in this session, draft:

   - **title**: Brief session identifier (e.g., "Implement auth middleware", "Fix CRDT merge bug")
   - **approach**: What approaches were considered, what was tried, why the chosen path won, what alternatives were rejected. Include deliberate design decisions.
   - **constraints**: Forward-looking assumptions the work depends on. Phrase as "valid as long as X remains true." Only include constraints that would affect correctness if violated.
   - **learnings**: What was discovered about the codebase:
     - `repo`: Repository-level patterns and conventions
     - `code`: File-specific findings with path and optional line references
   - **friction**: What went wrong. Be specific, past-tense, actionable. "Type inference failed on nested generics in X" not "types were tricky."
   - **open_items**: Unfinished work, tech debt introduced, known gaps. Things the next session should know about.
   - **description**: Free-form summary (useful for standalone contexts without a plan)
   - **verification**: Run checks (build, test, lint) and record structured results. Each result has a `check` name, a `result` (pass/fail/skip), and an optional `note`.

4. **Present for review** using `AskUserQuestion`:

   Show the drafted context and ask the user to confirm or request changes. Display the key fields in a readable format:

   ```
   Context: <title>

   Approach: <approach summary>

   Constraints:
   - <constraint 1>
   - <constraint 2>

   Learnings:
   - repo: <repo learning 1>
   - code: <path>:<line> — <finding>

   Friction:
   - <friction 1>

   Open Items:
   - <open item 1>

   Verification:
   - [PASS] cargo test: all tests passed
   - [PASS] cargo clippy: no new warnings

   Task: <task-id> (if from a plan task)
   Files: <file list>
   Links: issue <id>, plan <id>, commits <sha1>, <sha2>
   ```

   Options:
   - "Create context" — Proceed with creation
   - "Edit first" — Let user provide corrections

5. **Create the context** by piping JSON to `rad-context create --json`:

   ```bash
   echo '{
     "title": "...",
     "description": "...",
     "approach": "...",
     "constraints": ["..."],
     "learnings": {
       "repo": ["..."],
       "code": [{"path": "...", "line": 42, "finding": "..."}]
     },
     "friction": ["..."],
     "openItems": ["..."],
     "filesTouched": ["..."],
     "verification": [
       {"check": "cargo test", "result": "pass", "note": "all tests passed"},
       {"check": "cargo clippy", "result": "pass"}
     ],
     "taskId": "<plan-task-id or omit>"
   }' | rad-context create --json
   ```

   Capture the context ID from the output.

   **Important**: JSON input is validated strictly:
   - Unknown fields are rejected (catches typos — the error lists all valid field names)
   - `title`, `description`, and `approach` must be non-empty
   - If validation fails, read the error message and fix the JSON

6. **Auto-link** from gathered metadata:

   ```bash
   # Link commits from this session
   rad-context link <context-id> --commit <sha>

   # Link issues from task metadata
   rad-context link <context-id> --issue <issue-id>

   # Link plans from task metadata
   rad-context link <context-id> --plan <plan-id>

   # Link patches if any were created
   rad-context link <context-id> --patch <patch-id>
   ```

7. **Announce to the network**:
   ```bash
   rad sync --announce
   ```

8. **Report** the created context ID and what was linked.

## `/rad-context list`

```bash
rad-context list
```

Display the output to the user. If no contexts exist, suggest using `/rad-context create` to create one.

## `/rad-context show <id>`

```bash
rad-context show <id>
```

Display the full context to the user. Highlight the agent-utility fields: constraints, friction, learnings, approach, open_items.

For machine-readable output:
```bash
rad-context show <id> --json
```

## `/rad-context link <id>`

Interactive linking flow:

1. Ask the user what to link using `AskUserQuestion`:
   - "Link to issue" — prompts for issue ID
   - "Link to patch" — prompts for patch ID
   - "Link to plan" — prompts for plan ID
   - "Link to commit" — prompts for commit SHA

2. Execute the link:
   ```bash
   rad-context link <context-id> --issue <issue-id>
   ```

3. Announce:
   ```bash
   rad sync --announce
   ```

## Notes

- Context creation is most valuable at session end, when Claude has full understanding of what happened
- The Stop hook will gently remind users about context creation at natural stopping points
- All core fields are immutable after creation — only links can be added/removed later
- JSON fields use camelCase: `openItems`, `filesTouched`, `taskId`
- If no tasks have Radicle metadata, the context is still valuable as a standalone observation
- All IDs accept short-form prefixes (minimum 7 hex chars) — no need to use full 40-char IDs
- `filesTouched` is auto-populated from the HEAD commit by default — use `--no-auto-files` to disable
- Use `--auto-link-commits <ref>` to automatically link all commits since a given ref (e.g. a branch point)
