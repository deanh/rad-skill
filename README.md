# Radicle Skill

A skill package for working with [Radicle](https://radicle.xyz) — a peer-to-peer code collaboration protocol. Supports both [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) and [pi](https://github.com/badlogic/pi-mono).

## Features

- **Radicle Knowledge**: Guidance for all `rad` CLI commands (init, clone, patch, issue, sync, etc.)
- **Issues to Plans and Tasks**: Break down Radicle issues into actionable work items with optional plan mode
- **Plan COBs**: Save implementation plans as Radicle Collaborative Objects (`me.hdh.plan`)
- **Context COBs**: Capture session observations as durable records (`me.hdh.context`) for future sessions and collaborators
- **Multi-Agent Orchestration**: Coordinate parallel task execution across git worktrees using COBs as shared state, with automated orchestration on pi
- **Bidirectional Sync**: Import issues as tasks with automatic rollup on sync (Claude Code)
- **Session Awareness**: Detect Radicle repos and surface relevant information at session start

## Platform Support

| Feature | Claude Code | pi |
|---------|------------|-----|
| Skills (radicle, rad-plans, rad-contexts) | ✓ | ✓ |
| `/rad-context` command | ✓ (markdown) | ✓ (extension) |
| `/rad-import`, `/rad-sync`, `/rad-status` commands | ✓ | — |
| `/rad-issue` command | ✓ | — |
| `/rad-orchestrate` (multi-agent worktree orchestration) | — | ✓ (extension) |
| Session start detection | ✓ (hook) | ✓ (extension) |
| Compaction-triggered context creation | — | ✓ (extension) |
| Shutdown reminder | ✓ (hook) | ✓ (extension) |
| Plan manager agent (with dispatch) | ✓ | — |
| Worker agent (worktree execution) | ✓ | ✓ (agent) |

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

The skills auto-discover from the `skills/` directory. Extensions and agents auto-discover from `.pi/extensions/` and `.pi/agents/`.

To use in another project, add to `.pi/settings.json`:

```json
{
  "skills": ["/path/to/rad-skill/skills"],
  "extensions": [
    "/path/to/rad-skill/.pi/extensions/rad-context.ts",
    "/path/to/rad-skill/.pi/extensions/rad-orchestrator.ts"
  ],
  "agents": ["/path/to/rad-skill/.pi/agents"]
}
```

Or test directly:

```bash
pi -e /path/to/rad-skill/.pi/extensions/rad-context.ts \
   -e /path/to/rad-skill/.pi/extensions/rad-orchestrator.ts \
   --skill /path/to/rad-skill/skills
```


## Skills

Three knowledge skills, all following the Agent Skills standard:

| Skill | Description |
|-------|-------------|
| **radicle** | Core `rad` CLI operations — init, clone, patch, issue, sync, node management |
| **rad-plans** | Plan COBs (`me.hdh.plan`), `rad-plan` CLI, and interactive plan management |
| **rad-contexts** | Context COBs (`me.hdh.context`) and `rad-context` CLI |

## Commands (Claude Code)

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

## Multi-Agent Worktree Orchestration

Multiple agents work in parallel git worktrees, using COBs as the shared coordination layer. COBs live in `~/.radicle/storage/` and are visible from all worktrees instantly — code is isolated per worktree, metadata flows freely.

### pi: `/rad-orchestrate <plan-id>`

The pi orchestrator extension automates the full multi-agent lifecycle:

```
/rad-orchestrate abc123         # Run plan to completion
```

1. Analyzes the Plan COB and identifies ready tasks (unblocked, no file conflicts)
2. Spawns worker agents in isolated worktrees (up to 4 concurrent)
3. Workers claim tasks, implement, commit, create Context COBs, and post `DONE task:<id> commit:<sha>`
4. Orchestrator cherry-picks completed commits into a plan branch
5. Links commits to plan tasks via `rad-plan task link-commit`
6. Repeats until all tasks are complete, then creates a single Radicle patch

The orchestrator retries failed workers, logs failures to `/tmp/`, and tracks context feedback from completed workers to inform subsequent batches.

### Claude Code: Manual Dispatch

On Claude Code, the plan-manager agent handles dispatch interactively:

1. **Import and plan**: `/rad-import <issue-id>` creates tasks, optionally saves as a Plan COB
2. **Dispatch**: Plan-manager identifies ready tasks and provides worker launch instructions
3. **Workers**: Launch `claude --worktree` sessions per task — each worker claims a task, implements, produces a commit + Context COB
4. **Iterate**: Re-run dispatch to see context feedback and the next batch of ready tasks
5. **Complete**: When all tasks pass, `/rad-sync` closes the plan and issue

### Agents

| Agent | Role | Platform | Runs In |
|-------|------|----------|---------|
| **plan-manager** | Creates plans, dispatches tasks, evaluates context feedback | Claude Code | Main worktree |
| **rad-worker** | Executes one task: code, commit, Context COB, DONE signal | pi | Isolated worktree |
| **worker** | Executes one task: code, commit, Context COB | Claude Code | Isolated worktree |

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
