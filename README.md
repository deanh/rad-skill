# Radicle Plugin for Claude Code

A Claude Code plugin for working with [Radicle](https://radicle.xyz) - a peer-to-peer code collaboration protocol.

## Features

- **Issues to plans and task**: Enter plan mode to explore the codebase and design implementation before creating tasks
- **Radicle Knowledge**: Guidance for all `rad` CLI commands (init, clone, patch, issue, sync, etc.)
- **Bidirectional Sync**: Import Radicle issues as Claude Code tasks with automatic rollup on sync
- **Context Loading**: Agents to load full issue/patch context including discussion history
- **Session Awareness**: Hooks that detect Radicle repos and remind you to sync completed work

## Installation

Add to your settings file:

```json
{
  "extraKnownMarketplaces": {
    "rad-skill": {
      "source": {
        "source": "git",
        "url": "rad://zvBj4kByGeQSrSy2c4H7fyK42cS8"
      }
    }
  },
  "enabledPlugins": {
    "radicle@rad-skill": true
  }
}
```

**Global install:** Add to `~/.claude/settings.json` to make available in all projects.

**Project install:** Add to `.claude/settings.json` in your project root.

## Commands

### `/rad-import <issue-id> [--no-plan]`

Import a Radicle issue and break it down into actionable tasks:

```
/rad-import abc123           # Enter plan mode first (default)
/rad-import abc123 --no-plan # Skip plan mode for faster import
```

By default, `/rad-import` enters **plan mode** where Claude explores your codebase, designs an implementation approach, and gets your approval before creating tasks. Use `--no-plan` to skip this step for straightforward issues.

Creates multiple Claude Code tasks linked to the parent issue via metadata. 

### `/rad-status [issue-id]`

View progress dashboard for imported issues:

```
/rad-status

Issue abc123: "Implement authentication"
  [##########----------] 2/4 tasks (50%)
  [x] Create auth middleware (completed)
  [x] Add login endpoint (completed)
  [>] Write auth tests (in_progress)
  [ ] Update documentation (pending)
```

### `/rad-sync [--dry-run]`

Sync completed tasks back to Radicle:

```
/rad-sync --dry-run   # Preview what would sync
/rad-sync             # Sync to Radicle
```

Uses rollup logic: an issue is marked "solved" only when ALL linked tasks are completed.

### `/rad-create`

Create Radicle issues from Claude Code artifacts:

```
/rad-create --from-task 5         # Create issue from existing task
/rad-create --from-plan plan.md   # Create issues from plan sections
```

## Agents

### `issue-planner`

Converts plans into well-structured Radicle issues:

- Analyzes plan structure to identify issue boundaries
- Applies appropriate labels (feature, bug, docs, test, security)
- Creates issues with clear acceptance criteria
- Visualizes dependency graph between issues
- Suggests parallelizable work and implementation order

**Trigger phrases:** "create radicle issues from my plan", "convert this plan to issues"

**Example output:**
```
Implementation Graph:
  abc123 (middleware)
    ├── def456 (login)
    │   └── jkl012 (tests)
    └── ghi789 (logout)
        └── jkl012 (tests)

Parallelizable: def456 and ghi789 can work simultaneously
```

### `context-loader`

Loads comprehensive context for implementation:

- Fetches full issue details and discussion history
- Extracts key decisions made in comments (with attribution)
- Identifies open questions still unresolved
- Lists relevant code files mentioned in discussions
- Provides implementation hints from the discussion

For patches:
- Retrieves diffs and revision history
- Summarizes review comments across all revisions
- Shows approval status and target branch

**Trigger phrases:** "load context for issue X", "what's the background on this patch", "get me up to speed on issue Y"

## Workflow

The plugin creates a complete bridge between Radicle's peer-to-peer issue tracking and Claude Code's session-based task management.

### Complete Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  SESSION START                                                   │
│  Hook detects Radicle repo → shows open issue count              │
│  "Radicle repository detected. 5 open issues."                   │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  IMPORT: /rad-import <issue-id>                                  │
│                                                                  │
│  ┌─ Plan Mode (default) ─────────────────────────────────────┐  │
│  │  • Explores codebase architecture                         │  │
│  │  • Analyzes issue requirements                            │  │
│  │  • Designs implementation approach                        │  │
│  │  • Presents plan for your approval                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌─ Task Creation ───────────────────────────────────────────┐  │
│  │  • Breaks issue into 1-4 hour work items                  │  │
│  │  • Links tasks via metadata (radicle_issue_id)            │  │
│  │  • Sets up task dependencies (blockedBy/blocks)           │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  CONTEXT: "Load context for issue X"                             │
│  context-loader agent fetches:                                   │
│  • Full discussion history                                       │
│  • Key decisions made in comments                                │
│  • Relevant code files mentioned                                 │
│  • Implementation hints                                          │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  WORK: Complete tasks as you implement                           │
│  /rad-status shows live progress per issue                       │
│                                                                  │
│    Issue abc123: "Implement authentication"                      │
│      [##########----------] 2/4 tasks (50%)                      │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  SESSION END                                                     │
│  Hook checks for completed Radicle-linked tasks                  │
│  "Consider running /rad-sync to update Radicle."                 │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  SYNC: /rad-sync                                                 │
│  • Groups tasks by parent issue                                  │
│  • Issues with ALL tasks complete → marked "solved"              │
│  • Partial progress → issue stays open                           │
│  • Announces changes to network                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Alternative: Create Issues from Plans

You can also work in the opposite direction—create Radicle issues from Claude Code plans:

```
/rad-create --from-plan plan.md
```

The `issue-planner` agent parses your plan, identifies logical issue boundaries, applies labels, and creates linked Radicle issues with dependency relationships.

## Task-Issue Mapping

This plugin assumes that your Radicle issues are feature-level ("Implement auth"), while Claude Code tasks are work items ("Create middleware", "Write tests"). 

This is probably incorrect in some ways, but we want to make sure that all issues are broken down to tasks that are small enough to progress inside a single session or context window.

With this assumption, pne issue becomes multiple tasks:

```
Radicle Issue (feature)
    ├── Task 1 (completed) ✓
    ├── Task 2 (completed) ✓
    ├── Task 3 (in_progress)
    └── Task 4 (pending)
         │
         ▼
    Issue stays OPEN until all tasks complete
```

### Rollup Sync Logic

The sync uses **conservative completion**—an issue is only marked "solved" when 100% of linked tasks are completed. This prevents premature closure of partially-done work:

| Tasks Completed | Sync Behavior |
|-----------------|---------------|
| 4/4 (100%) | Issue closed, completion comment added |
| 3/4 (75%) | Issue stays open, progress noted |
| 0/4 (0%) | No action taken |

### Task Metadata

Tasks link to their parent issue via metadata, enabling bidirectional tracking:

```json
{
  "radicle_issue_id": "abc123...",
  "radicle_repo": "rad:z3GhWjk...",
  "radicle_issue_title": "Implement authentication",
  "source": "radicle"
}
```

This metadata is set automatically during import and preserved through task updates.

## Plan Mode Integration

When you run `/rad-import`, Claude enters **plan mode** by default. This is a structured exploration phase where Claude:

1. **Explores the codebase** - Understands architecture, patterns, and relevant files
2. **Analyzes the issue** - Parses requirements, discussion history, and acceptance criteria
3. **Designs an approach** - Proposes implementation strategy with specific files to modify
4. **Awaits approval** - Presents the plan for your review before creating tasks

### Why Plan First?

Plan mode ensures Claude understands your codebase before committing to a task breakdown. This is valuable for:

- **Complex features** that touch multiple systems
- **Unfamiliar codebases** where architecture discovery is needed
- **Issues with discussion** that may contain important context
- **Architectural decisions** that should be validated before implementation

### Skipping Plan Mode

For straightforward issues where you already know the implementation approach:

```
/rad-import abc123 --no-plan
```

This immediately creates tasks without the exploration phase.

### Plan-to-Issue Flow

You can also convert existing plans into Radicle issues:

```
/rad-create --from-plan implementation-plan.md
```

The `issue-planner` agent:
- Parses plan structure (## headers become issue candidates)
- Detects appropriate labels (feature, bug, docs, test, security)
- Creates issues with descriptions and acceptance criteria
- Visualizes dependency relationships between issues

## Hooks

The plugin includes automatic hooks that integrate with your session lifecycle:

### SessionStart

When you open Claude Code in a Radicle repository:
- Detects the repository via `rad .`
- Shows the repository ID and open issue count
- Suggests `/rad-import` to get started

```
Radicle repository detected: rad:z3GhWjk...
Open issues: 5

Use /rad-import <issue-id> to import an issue as tasks.
Use 'rad issue list' to see all open issues.
```

### Stop

When you end your session:
- Checks for completed tasks linked to Radicle issues
- Reminds you to run `/rad-sync` if unsynced work exists
- Advisory only—does not block session end

## Skills

The plugin provides two knowledge skills:

- **Radicle**: Core knowledge for all `rad` CLI operations (init, clone, patch, issue, sync, node management)
- **Radicle Tasks**: Documentation for the task-issue integration workflow and all `/rad-*` commands

## Requirements

- [Radicle](https://radicle.xyz/install) installed and configured (`rad auth`)
- Radicle node running for network operations (`rad node start`)
