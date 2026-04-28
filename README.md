# Radicle Skill

A [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) plugin marketplace for working with [Radicle](https://radicle.xyz) — a peer-to-peer code collaboration protocol.

> **Looking for pi?** See [rad-pi](https://github.com/deanh/rad-pi) for the pi package.

## Plugins

Three composable plugins — install what you need:

| Plugin | Description | Always-loaded |
|--------|-------------|---------------|
| **radicle** | Radicle CLI support — patches, issues, node operations, sync | ~4 KB |
| **radicle-extras** | Plan and Context COBs — task workflows, import/sync, session observations | ~5 KB |
| **radicle-autonomy** | Multi-agent orchestration — dispatch tasks to parallel worktree workers | ~2 KB |

### radicle (core)

Core Radicle knowledge and CLI routing. Covers `rad init`, `rad clone`, patches, issues, node management, sync, and remotes. Includes a session-start hook that detects Radicle repos.

**Commands**: `/rad-issue`

### radicle-extras

Plan COBs (`me.hdh.plan`) and Context COBs (`me.hdh.context`) with full task integration. Import Radicle issues as Claude Code tasks, sync completions back, and capture session observations for future agents.

**Commands**: `/rad-import`, `/rad-sync`, `/rad-status`, `/rad-context`

**Requires**: `rad-plan` and/or `rad-context` CLIs (features gracefully degrade without them)

### radicle-autonomy

Multi-agent worktree dispatch. The plan-manager identifies ready tasks and the worker agent executes them in isolated git worktrees — one commit, one Context COB per task.

**Commands**: `/rad-dispatch`  
**Agents**: `plan-manager`, `worker`

## Requirements

- [Radicle](https://radicle.xyz/install) installed and configured (`rad auth`)
- Radicle node running for network operations (`rad node start`)
- Optional: `rad-plan` CLI for Plan COB support
- Optional: `rad-context` CLI for Context COB support

## Installation

Add the marketplace to your settings file (`~/.claude/settings.json` for global, `.claude/settings.json` for project):

```json
{
  "extraKnownMarketplaces": {
    "rad-skill": {
      "source": {
        "source": "git",
        "url": "https://seed.radicle.garden/zvBj4kByGeQSrSy2c4H7fyK42cS8.git"
      }
    }
  }
}
```

Then enable the plugins you need:

```json
{
  "enabledPlugins": {
    "radicle@rad-skill": true
  }
}
```

**Core only** — basic Radicle CLI support:
```json
"enabledPlugins": { "radicle@rad-skill": true }
```

**Core + extras** — task workflows and session observations:
```json
"enabledPlugins": { "radicle@rad-skill": true, "radicle-extras@rad-skill": true }
```

**Full stack** — add multi-agent orchestration:
```json
"enabledPlugins": { "radicle@rad-skill": true, "radicle-extras@rad-skill": true, "radicle-autonomy@rad-skill": true }
```

## Multi-Agent Worktree Dispatch

Multiple agents work in parallel git worktrees, using COBs as the shared coordination layer. COBs live in `~/.radicle/storage/` and are visible from all worktrees instantly — code is isolated per worktree, metadata flows freely.

1. **Import and plan**: `/rad-import <issue-id>` creates tasks, optionally saves as a Plan COB
2. **Dispatch**: `/rad-dispatch <plan-id>` identifies ready tasks and provides worker launch instructions
3. **Workers**: Launch `claude --worktree` sessions per task — each worker claims a task, implements, produces a commit + Context COB
4. **Iterate**: Re-run `/rad-dispatch` to see context feedback and the next batch of ready tasks
5. **Complete**: When all tasks pass, `/rad-sync` closes the plan and issue

## Task-Issue Mapping

Issues are feature-level ("Implement auth"), tasks are work items ("Create middleware", "Write tests"). One issue becomes multiple tasks, each sized for a single session.

Sync uses conservative completion — an issue closes only when 100% of linked tasks are done.

## Installing COB CLIs

### rad-plan

```bash
rad clone rad:z4L8L9ctRYn2bcPuUT4GRz7sggG1v
cd radicle-plan-cob
cargo install --path .
rad-plan --version
```

### rad-context

```bash
rad clone rad:z2qBBbhVCfMiFEWN55oXKTPmKkrwY
cd radicle-context-cob
cargo install --path .
rad-context --version
```
