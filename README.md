# Radicle Skill

A skill package for working with [Radicle](https://radicle.xyz) — a peer-to-peer code collaboration protocol. Supports both [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) and [pi](https://github.com/badlogic/pi-mono).

## Features

- **Radicle Knowledge**: Guidance for all `rad` CLI commands (init, clone, patch, issue, sync, etc.)
- **Issues to Plans and Tasks**: Break down Radicle issues into actionable work items with optional plan mode
- **Plan COBs**: Save implementation plans as Radicle Collaborative Objects (`me.hdh.plan`)
- **Context COBs**: Capture session observations as durable records (`me.hdh.context`) for future sessions and collaborators
- **Bidirectional Sync**: Import issues as tasks with automatic rollup on sync (Claude Code)
- **Context Loading**: Load full issue/patch context including discussion history and prior session observations
- **Session Awareness**: Detect Radicle repos and surface relevant information at session start

## Platform Support

| Feature | Claude Code | pi |
|---------|------------|-----|
| Skills (radicle, rad-tasks, rad-plans, rad-contexts) | ✓ | ✓ |
| `/rad-context` command | ✓ (markdown) | ✓ (extension) |
| `/rad-import`, `/rad-sync`, `/rad-status` commands | ✓ | — |
| `/rad-plan`, `/rad-issue` commands | ✓ | — |
| Session start detection | ✓ (hook) | ✓ (extension) |
| Compaction-triggered context creation | — | ✓ (extension) |
| Shutdown reminder | ✓ (hook) | ✓ (extension) |
| Context loader agent | ✓ | — |
| Plan manager agent | ✓ | — |

Skills follow the [Agent Skills standard](https://agentskills.io) and work on both platforms without modification.

## Requirements

- [Radicle](https://radicle.xyz/install) installed and configured (`rad auth`)
- Radicle node running for network operations (`rad node start`)
- Optional: `rad-plan` CLI for Plan COB support
- Optional: `rad-context` CLI for Context COB support

All COB features gracefully degrade when their CLIs are not installed.

## Installation

### Claude Code

Add to your settings file (`~/.claude/settings.json` for global, `.claude/settings.json` for project):

```json
{
  "extraKnownMarketplaces": {
    "rad-skill": {
      "source": {
        "source": "git",
        "url": "https://seed.radicle.garden/zvBj4kByGeQSrSy2c4H7fyK42cS8.git"
      }
    }
  },
  "enabledPlugins": {
    "radicle@rad-skill": true
  }
}
```

### pi

The skills auto-discover from the `skills/` directory. The pi extension auto-discovers from `.pi/extensions/`.

To use in another project, add to `.pi/settings.json`:

```json
{
  "skills": ["/path/to/rad-skill/skills"],
  "extensions": ["/path/to/rad-skill/.pi/extensions/rad-context.ts"]
}
```

Or test directly:

```bash
pi -e /path/to/rad-skill/.pi/extensions/rad-context.ts --skill /path/to/rad-skill/skills
```


## Skills

Four knowledge skills, all following the Agent Skills standard:

| Skill | Description |
|-------|-------------|
| **radicle** | Core `rad` CLI operations — init, clone, patch, issue, sync, node management |
| **rad-tasks** | Task-issue integration workflow and `/rad-*` commands |
| **rad-plans** | Plan COBs (`me.hdh.plan`) and `rad-plan` CLI |
| **rad-contexts** | Context COBs (`me.hdh.context`) and `rad-context` CLI |

## Tasks (Claude Code)

### `/rad-import <issue-id> [--no-plan] [--save-plan]`

Import a Radicle issue and break it down into tasks. Enters plan mode by default to explore the codebase before creating tasks.

```
/rad-import abc123              # Enter plan mode first (default)
/rad-import abc123 --no-plan    # Skip planning, create tasks directly
/rad-import abc123 --save-plan  # Also save plan as a Plan COB
```

### `/rad-sync [--dry-run]`

Sync completed tasks back to Radicle issues. Uses rollup logic — an issue is marked "solved" only when ALL linked tasks are completed. Offers context creation when closing issues.

### `/rad-status [issue-id]`

View progress dashboard for imported issues.

### `/rad-issue <description> [flags]`

Create Radicle issues from descriptions, tasks, or plan files. Dispatches specialist research roles for non-trivial issues.

### `/rad-plan <action> [id]`

Manage Plan COBs: list, show, create, sync, export.

### `/rad-context <action> [id]`

Manage Context COBs: list, show, create, link.

## Task-Issue Mapping (Claude Code)

Issues are feature-level ("Implement auth"), tasks are work items ("Create middleware", "Write tests"). One issue becomes multiple tasks, each sized for a single session or context window.

Sync uses conservative completion — an issue closes only when 100% of linked tasks are done:

| Tasks Completed | Sync Behavior |
|-----------------|---------------|
| 4/4 (100%) | Issue closed, completion comment added |
| 3/4 (75%) | Issue stays open, progress noted |
| 0/4 (0%) | No action taken |

## Context COBs

Context COBs (`me.hdh.context`) capture what an agent learned during a coding session — approach, constraints, friction, learnings, and open items. They're durable records stored in Radicle that replicate across the network, designed for future agents and collaborators rather than the current session.

### How It Works

**Claude Code:** Use `/rad-context create` to trigger the agent to reflect on the session and create a Context COB interactively.

**pi:** The extension hooks into pi's compaction lifecycle:

1. When the context window fills and compaction triggers, the extension stashes the serialized conversation
2. After compaction completes, a side-channel LLM call extracts context fields (approach, friction, learnings, etc.)
3. The Context COB is created automatically via `rad-context create --json`
4. Commits from the session are linked, and the COB is announced to the network

This piggybacks on a natural session boundary — compaction fires when the agent has accumulated the most knowledge, and the messages being compacted are exactly the session knowledge worth preserving.

The `/rad-context` command is also available for manual creation:

```
/rad-context list           # List existing contexts
/rad-context show <id>      # View context details
/rad-context create         # Trigger LLM reflection and create a context
```

### Install rad-context CLI

```bash
rad clone rad:z2qBBbhVCfMiFEWN55oXKTPmKkrwY
cd radicle-context-cob
cargo install --path .
rad-context --version
```

## Plan COBs

Plan COBs (`me.hdh.plan`) store implementation plans as first-class Radicle objects. They track tasks with status, estimates, and dependencies, and link bidirectionally to issues and patches.

### Install rad-plan CLI

```bash
rad clone rad:z4L8L9ctRYn2bcPuUT4GRz7sggG1v
cd radicle-plan-cob
cargo install --path .
rad-plan --version
```
