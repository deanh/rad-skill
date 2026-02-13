---
name: rad-contexts
description: Knowledge about Radicle Context COBs (me.hdh.context) - a custom Collaborative Object type for storing AI session observations in Radicle repositories. Use when working with rad-context, context COBs, or preserving session learnings.
---

# Radicle Context COB Skill

This skill provides knowledge about Context COBs (`me.hdh.context`) - a custom Collaborative Object type for storing observations from AI-assisted development sessions in Radicle repositories.

## What are Context COBs?

Context COBs are first-class collaborative objects that capture what an AI agent learned and experienced during a coding session. They enable:

- **Session memory**: Preserve approach, constraints, learnings, and friction across sessions
- **Agent-first design**: Every field ranked by utility to future coding agents
- **Immutable observations**: Core fields set at creation, no CRDT conflicts
- **Radicle-native linking**: Bidirectional links to Issues, Patches, Plans, and commits
- **Network sync**: Replicate across the Radicle network like Issues and Patches

## Type Name

```
me.hdh.context
```

Stored under `refs/cobs/me.hdh.context/<CONTEXT-ID>` in the Git repository.

## Context Structure

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Brief session identifier |
| `description` | string | Free-form (for standalone contexts) |
| `approach` | string | Reasoning chain — what was tried, why the chosen path won, rejected alternatives |
| `constraints` | string[] | Forward-looking assumptions — "valid as long as X remains true" |
| `learnings` | LearningsSummary | Codebase discoveries (see below) |
| `friction` | string[] | Past-tense problems encountered — specific and actionable |
| `open_items` | string[] | Unfinished work, tech debt introduced, known gaps |
| `files_touched` | string set | Files actually modified during the session |
| `related_commits` | string set | Git commit SHAs (mutable via link/unlink) |
| `related_issues` | ObjectId set | Linked Radicle issues (mutable via link/unlink) |
| `related_patches` | ObjectId set | Linked Radicle patches (mutable via link/unlink) |
| `related_plans` | ObjectId set | Linked Radicle plans (mutable via link/unlink) |

### LearningsSummary

```json
{
  "repo": ["Uses conventional commits", "Error types follow thiserror pattern"],
  "code": [
    {
      "path": "src/auth.rs",
      "line": 42,
      "finding": "Auth middleware expects Request to carry session state"
    }
  ]
}
```

- `repo`: Repository-level patterns and conventions
- `code`: File-specific findings with optional line references (`line`, `endLine`)

## Agent-Utility Priority Order

When consuming contexts, surface fields in this order:

1. **constraints** — Guard rails that affect correctness
2. **friction** — Avoid repeating past mistakes
3. **learnings** — Accelerate understanding of the codebase
4. **approach** — Understand reasoning and rejected alternatives
5. **open_items** — Know what's incomplete

## Relationship to Plan COBs

| Aspect | Plan COB (`me.hdh.plan`) | Context COB (`me.hdh.context`) |
|--------|--------------------------|-------------------------------|
| Purpose | Coordination | Observation |
| Content | Intent, tasks, status | Approach, learnings, friction |
| Lifecycle | Draft → Completed → Archived | Created (no status transitions) |
| Mutability | Most fields mutable | Core fields immutable, links mutable |

When linked together: the **"what"** comes from the Plan, the **"how"** comes from the Context.

## CLI Commands

### rad-context create

Create from flags:

```bash
rad-context create "Session title" \
  --description "Free-form description" \
  --approach "What was tried and why" \
  --constraint "Assumes X remains true" \
  --friction "Type errors with async closures" \
  --open-item "Refresh token rotation not implemented" \
  --file src/auth.rs --file src/middleware.rs
```

Create from JSON (used by `/rad-context` command):

```bash
echo '<json>' | rad-context create --json
```

### rad-context list

```bash
rad-context list
```

Shows all contexts with IDs, titles, and link counts.

### rad-context show

```bash
rad-context show <context-id>
rad-context show <context-id> --json
```

### rad-context link

```bash
rad-context link <context-id> --commit <sha>
rad-context link <context-id> --issue <issue-id>
rad-context link <context-id> --patch <patch-id>
rad-context link <context-id> --plan <plan-id>
```

### rad-context unlink

```bash
rad-context unlink <context-id> --commit <sha>
rad-context unlink <context-id> --issue <issue-id>
```

## JSON Format for Creation

```json
{
  "title": "Implement auth flow",
  "description": "Session to add OAuth support",
  "approach": "Used passport.js for OAuth, rejected manual token handling",
  "constraints": ["Assumes Redis is available for session storage"],
  "learnings": {
    "repo": ["Uses conventional commits"],
    "code": [
      {
        "path": "src/auth.rs",
        "line": 42,
        "finding": "Auth middleware expects Request to carry session state"
      }
    ]
  },
  "friction": ["Type errors with async middleware closures"],
  "openItems": ["Refresh token rotation not implemented"],
  "filesTouched": ["src/auth.rs", "src/middleware.rs"]
}
```

Note: JSON uses camelCase (`openItems`, `filesTouched`).

## Claude Code Integration

- `/rad-context create` — Primary creation mechanism (Claude reflects on session)
- `/rad-context list` — View existing contexts
- `/rad-context show <id>` — View context details
- `/rad-context link <id>` — Add links to issues/patches/plans/commits
- context-loader agent queries contexts when loading background for issues/patches
- `/rad-import` surfaces linked contexts during planning
- `/rad-sync` offers context creation when closing issues

## Installation

```bash
# Clone and install from Radicle
rad clone rad:z2qBBbhVCfMiFEWN55oXKTPmKkrwY
cd radicle-context-cob
cargo install --path .

# Verify
rad-context --version
```

### Detection

The session-start hook automatically detects whether `rad-context` is installed. All Context COB features gracefully degrade when `rad-context` is not available.
