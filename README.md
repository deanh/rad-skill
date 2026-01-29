# Radicle Plugin for Claude Code

A Claude Code plugin for working with [Radicle](https://radicle.xyz) - a peer-to-peer code collaboration protocol.

## Features

- **Radicle Knowledge**: Guidance for all `rad` CLI commands (init, clone, patch, issue, sync, etc.)
- **Task Integration**: Import Radicle issues as Claude Code tasks with bidirectional sync
- **Context Loading**: Agents to load full issue/patch context for implementation
- **Session Awareness**: Hooks that detect Radicle repos and remind you to sync

## Installation

Add to your settings file:

```json
{
  "extraKnownMarketplaces": {
    "deanh-rad-skill": {
      "source": {
        "source": "git",
        "url": "git@github.com:deanh/rad-skill.git"
      }
    }
  },
  "enabledPlugins": {
    "radicle@deanh-rad-skill": true
  }
}
```

**Global install:** Add to `~/.claude/settings.json` to make available in all projects.

**Project install:** Add to `.claude/settings.json` in your project root.

## Commands

### `/rad-import <issue-id>`

Import a Radicle issue and break it down into actionable tasks:

```
/rad-import abc123
```

Creates multiple Claude Code tasks linked to the parent issue via metadata. Each task targets 1-4 hours of work.

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
- Applies appropriate labels (feature, bug, docs, etc.)
- Creates issues with clear acceptance criteria

Triggered by: "create radicle issues from my plan"

### `context-loader`

Loads comprehensive context for implementation:

- Fetches full issue details and discussion history
- For patches: diffs, revision history, review comments
- Identifies relevant code files mentioned in discussions

Triggered by: "load context for issue X", "what's the background on this patch"

## Workflow

```
Session Start
  │  Hook detects Radicle repo → shows open issue count
  ▼
/rad-import <issue-id>
  │  Breaks issue into linked tasks
  ▼
context-loader agent
  │  "Load context for issue X" → full discussion + code refs
  ▼
Work on Tasks
  │  /rad-status shows progress per issue
  ▼
Session End
  │  Hook reminds to sync if tasks completed
  ▼
/rad-sync
     Marks issues solved, announces to network
```

## Task-Issue Mapping

Radicle issues are feature-level ("Implement auth"), while Claude Code tasks are work items ("Create middleware", "Write tests"). One issue becomes multiple tasks:

```
Radicle Issue (feature)
    ├── Task 1 (completed)
    ├── Task 2 (completed)
    ├── Task 3 (in_progress)
    └── Task 4 (pending)
         │
         ▼
    Issue stays OPEN until all tasks complete
```

Tasks link to their parent issue via metadata:

```json
{
  "radicle_issue_id": "abc123...",
  "radicle_repo": "rad:z3GhWjk...",
  "radicle_issue_title": "Implement authentication",
  "source": "radicle"
}
```

## Skills

The plugin provides two skills:

- **Radicle**: Core knowledge for all `rad` CLI operations
- **Radicle Tasks**: Documentation for the task-issue integration workflow

## Requirements

- [Radicle](https://radicle.xyz/install) installed and configured (`rad auth`)
- Radicle node running for network operations (`rad node start`)
