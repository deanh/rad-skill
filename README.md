# Radicle Skill

A [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) plugin for working with [Radicle](https://radicle.xyz) — a peer-to-peer code collaboration protocol.

> **Looking for pi?** See [rad-pi](https://github.com/deanh/rad-pi) for the pi package.

## Features

- **Radicle Knowledge**: Guidance for all `rad` CLI commands (init, clone, patch, issue, sync, etc.)
- **Issues to Plans and Tasks**: Break down Radicle issues into actionable work items with optional plan mode
- **Plan COBs**: Save implementation plans as Radicle Collaborative Objects (`me.hdh.plan`)
- **Context COBs**: Capture session observations as durable records (`me.hdh.context`) for future sessions and collaborators
- **Multi-Agent Dispatch**: Coordinate parallel task execution across git worktrees using COBs as shared state
- **Bidirectional Sync**: Import issues as tasks with automatic rollup on sync
- **Session Awareness**: Detect Radicle repos and surface relevant information at session start

## Requirements

- [Radicle](https://radicle.xyz/install) installed and configured (`rad auth`)
- Radicle node running for network operations (`rad node start`)
- Optional: `rad-plan` CLI for Plan COB support
- Optional: `rad-context` CLI for Context COB support

All COB features gracefully degrade when their CLIs are not installed.

## Installation

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

## Skills

Three knowledge skills following the [Agent Skills](https://agentskills.io) standard:

| Skill | Description |
|-------|-------------|
| **radicle** | Core `rad` CLI operations — init, clone, patch, issue, sync, node management |
| **rad-plans** | Plan COBs (`me.hdh.plan`), `rad-plan` CLI, and interactive plan management |
| **rad-contexts** | Context COBs (`me.hdh.context`) and `rad-context` CLI |

## Commands

### `/rad-import <issue-id>`

Import a Radicle issue and break it down into tasks. Enters plan mode by default to explore the codebase before creating tasks. After task creation, interactively offers to save as a Plan COB.

```
/rad-import abc123
```

### `/rad-sync [--dry-run]`

Sync completed tasks back to Radicle issues and Plan COBs. Uses rollup logic — an issue is marked "solved" only when ALL linked tasks are completed. Offers context creation when closing issues.

### `/rad-status [issue-id]`

Query the repository's actual state and display a unified overview of open issues, active plans, and session tasks with actionable suggestions.

### `/rad-issue <description> [flags]`

Create Radicle issues from descriptions, tasks, or plan files. Dispatches specialist research roles for non-trivial issues.

### `/rad-context <action> [id]`

Manage Context COBs: list, show, create, link.

## Multi-Agent Worktree Dispatch

Multiple agents work in parallel git worktrees, using COBs as the shared coordination layer. COBs live in `~/.radicle/storage/` and are visible from all worktrees instantly — code is isolated per worktree, metadata flows freely.

The plan-manager agent handles dispatch interactively:

1. **Import and plan**: `/rad-import <issue-id>` creates tasks, optionally saves as a Plan COB
2. **Dispatch**: Plan-manager identifies ready tasks and provides worker launch instructions
3. **Workers**: Launch `claude --worktree` sessions per task — each worker claims a task, implements, produces a commit + Context COB
4. **Iterate**: Re-run dispatch to see context feedback and the next batch of ready tasks
5. **Complete**: When all tasks pass, `/rad-sync` closes the plan and issue

### Agents

| Agent | Role | Runs In |
|-------|------|---------|
| **plan-manager** | Creates plans, dispatches tasks, evaluates context feedback | Main worktree |
| **worker** | Executes one task: code, commit, Context COB | Isolated worktree |

## Task-Issue Mapping

Issues are feature-level ("Implement auth"), tasks are work items ("Create middleware", "Write tests"). One issue becomes multiple tasks, each sized for a single session or context window.

Sync uses conservative completion — an issue closes only when 100% of linked tasks are done:

| Tasks Completed | Sync Behavior |
|-----------------|---------------|
| 4/4 (100%) | Issue closed, completion comment added |
| 3/4 (75%) | Issue stays open, progress noted |
| 0/4 (0%) | No action taken |

## Context COBs

Context COBs (`me.hdh.context`) capture what an agent learned during a coding session — approach, constraints, friction, learnings, and open items. They're durable records stored in Radicle that replicate across the network, designed for future agents and collaborators rather than the current session.

Use `/rad-context create` to trigger the agent to reflect on the session and create a Context COB interactively.

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
