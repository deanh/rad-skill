# Radicle Plugin for Claude Code

A Claude Code plugin for working with [Radicle](https://radicle.xyz) - a peer-to-peer code collaboration protocol.

## Features

- **Issues to plans and tasks**: Enter plan mode to explore the codebase and design implementation before creating tasks
- **Plan COBs**: Save implementation plans as Radicle Collaborative Objects (`me.hdh.plan`) for network-wide sharing
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

### `/rad-import <issue-id> [--no-plan] [--save-plan]`

Import a Radicle issue and break it down into actionable tasks:

```
/rad-import abc123              # Enter plan mode first (default)
/rad-import abc123 --no-plan    # Skip plan mode for faster import
/rad-import abc123 --save-plan  # Save implementation plan as Plan COB
```

By default, `/rad-import` enters **plan mode** where Claude explores your codebase, designs an implementation approach, and gets your approval before creating tasks. Use `--no-plan` to skip this step for straightforward issues.

With `--save-plan`, the implementation plan is saved as a Plan COB (`me.hdh.plan`) that:
- Links bidirectionally to the source issue
- Tracks task status in Radicle (replicates to other nodes)
- Enables `/rad-plan sync` for bidirectional status updates

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

### `/rad-issue <description> [flags]`

Create Radicle issues from a high-level description, an existing task, or a plan file:

```
/rad-issue Add user profile page         # Agent-researched comprehensive issue
/rad-issue Fix typo in README --light    # Quick issue, no agents
/rad-issue --from-task 5                 # Convert existing task to issue
/rad-issue --from-plan plan.md           # Create issues from plan sections
```

For non-trivial descriptions, dispatches three specialist research roles in parallel (product analysis, UX design, technical planning) to generate business context, UX specifications, technical approach, and acceptance criteria. Automatically splits work into multiple issues if estimated effort exceeds 2 days.

**Depth flags:** `--light` (no agents), `--standard` (default), `--deep` (expanded investigation)
**Splitting flags:** `--single` (force one issue), `--multi` (force split)

### `/rad-plan <action> [id]`

Manage Plan COBs for implementation planning:

```
/rad-plan list              # List all plans in the repository
/rad-plan show abc123       # Show plan details with task status
/rad-plan create            # Create a new Plan COB interactively
/rad-plan sync              # Sync Claude Code task status to Plan COBs
/rad-plan export abc123     # Export plan as markdown or JSON
```

Plan COBs (`me.hdh.plan`) store implementation plans as first-class Radicle objects that replicate across the network.

## Agents

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

### `plan-manager`

Manages Plan COBs for implementation planning:

- Creates Plan COBs from plan mode exploration
- Syncs Claude Code task completion to Plan COB task statuses
- Converts Plan COB tasks to Radicle issues
- Tracks bidirectional relationships between plans, issues, and patches
- Exports plans for sharing and documentation

**Trigger phrases:** "save my plan as a Plan COB", "sync my tasks to Radicle", "convert task to issue"

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
/rad-issue --from-plan plan.md
```

This parses your plan, identifies logical issue boundaries, applies labels, and creates linked Radicle issues.

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
/rad-issue --from-plan implementation-plan.md
```

This will:
- Parse plan structure (## headers become issue candidates)
- Detect appropriate labels (feature, bug, docs, test, security)
- Create issues with descriptions and acceptance criteria

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

The plugin provides three knowledge skills:

- **Radicle**: Core knowledge for all `rad` CLI operations (init, clone, patch, issue, sync, node management)
- **Radicle Tasks**: Documentation for the task-issue integration workflow and all `/rad-*` commands
- **Radicle Plans**: Documentation for Plan COBs (`me.hdh.plan`) and the `rad-plan` CLI

## Requirements

- [Radicle](https://radicle.xyz/install) installed and configured (`rad auth`)
- Radicle node running for network operations (`rad node start`)
- (Optional) `rad-plan` CLI for Plan COB support (see below)

## Plan COB Support

Plan COBs are a custom Collaborative Object type (`me.hdh.plan`) for storing implementation plans. To use Plan COB features:

### Install rad-plan CLI

```bash
# Clone and install from Radicle
rad clone rad:z4L8L9ctRYn2bcPuUT4GRz7sggG1v
cd radicle-plan-cob
cargo install --path .

# Verify installation
rad-plan --version
```

The session-start hook automatically detects whether `rad-plan` is installed and shows install instructions if not.

### What are Plan COBs?

Plan COBs extend Radicle with implementation planning capabilities:

- **Persisted plans**: Save plan mode exploration as sharable, versioned plans
- **Task tracking**: Track tasks within plans with status, estimates, and dependencies
- **Bidirectional linking**: Link plans to Issues and Patches
- **Network sync**: Plans replicate across the Radicle network like Issues and Patches
- **CRDT semantics**: Conflict-free collaboration on plan updates

### Plan COB Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  IMPORT WITH PLAN: /rad-import abc123 --save-plan               │
│                                                                  │
│  Creates Plan COB linked to issue with:                          │
│  • Tasks derived from implementation breakdown                   │
│  • Critical files identified during exploration                  │
│  • Bidirectional link to source issue                            │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  WORK: Complete tasks, tracked in both systems                   │
│                                                                  │
│  Claude Code Tasks ←→ Plan COB Tasks                             │
│  (local session)       (replicated network-wide)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  SYNC: /rad-plan sync                                            │
│                                                                  │
│  Updates Plan COB task statuses to match Claude Code:            │
│  • Completed tasks → marked complete in Plan COB                 │
│  • All tasks done → Plan status set to "completed"               │
│  • Changes announced to Radicle network                          │
└─────────────────────────────────────────────────────────────────┘
```

### Type Name

Plans are stored as `me.hdh.plan` COBs under `refs/cobs/me.hdh.plan/<PLAN-ID>`.

This uses the reverse domain notation convention (`me.hdh.*`) for custom COB types, with potential for upstream inclusion as `xyz.radicle.plan` if the community finds it valuable.
