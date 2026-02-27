# Multi-Agent Worktree Workflow with Radicle COBs

## Context

You've built two custom Radicle COBs — Plan (`me.hdh.plan`) and Context (`me.hdh.context`) — alongside the built-in Issues and Patches. The rad-skill plugin already has agents (`plan-manager`, `context-loader`), commands (`/rad-import`, `/rad-plan`, `/rad-context`, `/rad-sync`), and hooks. The missing piece is orchestrating multiple agents working in parallel git worktrees, using COBs as the shared coordination and observation layer.

**Key architectural fact:** COBs live in `~/.radicle/storage/`, accessed via the `rad` node daemon. All git worktrees share the same COB state instantly — no sync needed. Code is isolated per worktree; metadata flows freely through COBs.

## COB Access Model

The core design decision, per your guidance:

| COB Type | Write | Read |
|----------|-------|------|
| **Plan** (`me.hdh.plan`) | Coordinator only (structure + status). Workers comment (CLAIM, SIGNAL). | All agents |
| **Context** (`me.hdh.context`) | The worker that did the work. One context per session. Immutable observations. | All agents |
| **Issue** (`xyz.radicle.issue`) | Coordinator + any agent (comment, state change) | All agents |
| **Patch** (`xyz.radicle.patch`) | Coordinator only. One patch per plan (created at completion). | All agents |

This maps to the COB designs: Context is immutable-at-creation (one writer), Plan has mutable status/tasks/links (central writer) with a discussion thread for worker coordination, Issues are collaborative (multiple writers), Patches are proposals (one author — the coordinator merges all task branches and pushes the final patch).

## Agent Roles

### Coordinator (evolution of `plan-manager`)
- **File:** New `agents/coordinator.md` (based on existing `agents/plan-manager.md`)
- **Tools:** Bash, Read, Glob, Grep, TaskList, TaskGet, TaskCreate, TaskUpdate
- **Runs in:** Main worktree
- **Responsibilities:**
  - Creates and manages the Plan COB
  - Dispatches tasks to sub-agents in worktrees
  - Reads completed sub-agents' Context COBs for feedback
  - Adjusts plan when constraints/learnings/open_items warrant it
  - Manages issue lifecycle (comments, state changes)

### Worker (new agent)
- **File:** New `agents/worker.md`
- **Tools:** Bash, Read, Write, Edit, Glob, Grep (standard code-writing tools + rad CLI via Bash)
- **Runs in:** Dedicated worktree per task (via `isolation: "worktree"` on Task tool)
- **Responsibilities:**
  - Reads its task from the Plan COB
  - Reads prior Context COBs (sibling tasks, same files)
  - Implements the change → one commit
  - Creates one Context COB capturing session observations
  - Links its commit to the plan task via `task link-commit` (marks done)

### Context Loader (existing, unchanged)
- **File:** Existing `agents/context-loader.md`
- **Role:** Used by both coordinator and workers to load prior Context COBs, issue details, patch context

## Feature Lifecycle

### Phase 1: Plan Decomposition
**Trigger:** `/rad-import <issue-id> --save-plan` or `/rad-orchestrate <plan-id>` (after plan creation)

1. Coordinator reads issue via `rad issue show`
2. Coordinator loads prior Context COBs via context-loader (for same issue or overlapping files)
3. Coordinator explores codebase
4. Coordinator creates Plan COB with tasks, each specifying:
   - subject, description, estimate
   - `affectedFiles` (predicted files to modify — critical for conflict detection, via `--files` flag)
   - `blocked_by` (dependency ordering)
5. Links plan to issue
6. Human approves plan (plan status: Draft → Approved)

### Phase 2: Dispatch Loop
**Trigger:** `/rad-orchestrate <plan-id>`

```
WHILE plan has unfinished tasks:
  1. Read Plan COB state
  2. Find tasks: no linkedCommit AND all blocked_by tasks have linkedCommit
  3. For each candidate:
     a. Conflict check: candidate.affectedFiles ∩ in_progress_tasks.affectedFiles
     b. If overlap → defer (log reason in plan comment)
     c. If clear → dispatch worker in worktree (worker claims via CLAIM comment)
  4. When worker completes (linkedCommit appears on task):
     a. Read its Context COB
     b. Evaluate context feedback (constraints, friction, open items)
     c. Adjust plan if needed (update descriptions, add tasks, modify dependencies)
     d. Dispatch next batch
```

### Phase 3: Sub-Agent Execution (per task)

**What the worker reads at start:**
```bash
rad-plan show <plan-id> --json    # Its task assignment
rad-context list                   # Prior Context COBs for:
                                   #   - same plan (sibling sessions)
                                   #   - overlapping files_touched
rad issue show <issue-id>          # Background context
```

Context fields surfaced in priority order (per existing context-loader design):
1. **constraints** — guard rails affecting correctness
2. **friction** — avoid repeating past mistakes
3. **learnings** — accelerate codebase understanding
4. **approach** — reasoning and rejected alternatives
5. **open_items** — know what's incomplete

**What the worker writes at end:**
1. Git commit (one, in worktree)
2. Context COB: `rad-context create --json` with approach, constraints, learnings, friction, open_items, files_touched
3. Links: `rad-context link <ctx-id> --plan <plan-id> --issue <issue-id> --commit <oid>`
4. Task completion: `rad-plan task link-commit <plan-id> <task-id> --commit <oid>`

### Phase 4: Context Feedback

After a worker completes, the coordinator reads the Context COB and evaluates:

| Context Field | Signal | Coordinator Action |
|---|---|---|
| `open_items` with new scope | "Circuit breaker needed" | Create new issue or add task to plan |
| `constraints` conflicting with later tasks | "Assumes tower 0.4" but task N upgrades to 0.5 | Block task N, modify description |
| `friction` suggesting different approach | "Borrow checker issues with X" | Add warning to related task descriptions |
| `filesTouched ⊄ affectedFiles` | Worker modified unexpected files | Update task's `affectedFiles` via `task edit --files`, re-check in-progress conflicts |
| `learnings.code` revealing architecture issue | "Incompatible with planned approach" | Pause plan, escalate to human |

### Phase 5: Completion

1. All leaf tasks have `linkedCommit`
2. Coordinator merges task branches into a plan branch with `--no-ff` (merge commits include task IDs)
3. Coordinator creates one Radicle patch: `git push rad HEAD:refs/patches`
4. Coordinator links patch to plan: `rad-plan link <plan-id> --patch <patch-id>`
5. Coordinator: `rad-plan status <plan-id> completed`
6. Coordinator closes issue with summary comment
7. Patch ready for delegate merge (one per plan)
8. Context COBs form complete observational record of how the feature was built

## Information Flow Diagram

```
Issue (input)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  COORDINATOR (main worktree)                     │
│  Reads: issue, prior contexts, codebase          │
│  Writes: Plan COB, issue comments, patch         │
└───────┬──────────────┬──────────────┬───────────┘
        │              │              │
   dispatch       dispatch       dispatch
        │              │              │
        ▼              ▼              ▼
┌──────────────┐┌──────────────┐┌──────────────┐
│ Worker A     ││ Worker B     ││ Worker C     │
│ (worktree-a) ││ (worktree-b) ││ (worktree-c) │
│              ││              ││              │
│ Reads:       ││ Reads:       ││ Reads:       │
│  plan task   ││  plan task   ││  plan task   │
│  A's context ││  A+B context ││  prior ctxs  │
│              ││              ││              │
│ Writes:      ││ Writes:      ││ Writes:      │
│  1 commit    ││  1 commit    ││  1 commit    │
│  1 context   ││  1 context   ││  1 context   │
│  link-commit ││  link-commit ││  link-commit │
└──────┬───────┘└──────┬───────┘└──────┬───────┘
       │               │               │
       ▼               ▼               ▼
              Coordinator evaluates:
              - Context COB feedback
              - Plan adjustments
              - Next dispatch batch
              ─────────────────────────
              When all tasks complete:
              - Merge branches (--no-ff)
              - Push one patch
              - Close plan + issue
```

## Implementation Steps

All new files go in the rad-skill plugin at `/Users/harryhudson/Devel/rad-skill/`.

### Step 1: `agents/worker.md` (new)
The worker agent definition. Harness-agnostic — relies only on `rad-plan`, `rad-context`, `rad`, and `git`. Its instructions:
- Receive `plan-id` and `task-id` as inputs (how these arrive is harness-dependent)
- Claim task: `rad-plan comment <plan-id> "CLAIM task:<task-id>"` (convention-based, no atomic status)
- Read full assignment: `rad-plan show <plan-id> --json` (parse for task details, `affectedFiles`, linked issues)
- Load prior Context COBs for the same plan and overlapping files (reuse context-loader patterns from `agents/context-loader.md` lines 153-228)
- If files change beyond `affectedFiles`: signal via `rad-plan comment <plan-id> "SIGNAL task:<task-id> files-added:<paths>"` and `rad-plan task edit <plan-id> <task-id> --files "<updated-list>"`
- Implement the change
- Produce one commit (no patch — patches are plan-level, created by coordinator at completion)
- Create one Context COB via `rad-context create --json` with all observational fields
- Link context to plan, issue, commit
- Mark own task complete: `rad-plan task link-commit <plan-id> <task-id> --commit <oid>`
- Do NOT modify Plan COB structure (no adding/removing tasks, no changing descriptions or dependencies)
- **Tools:** Bash, Read, Write, Edit, Glob, Grep

### Step 2: `agents/coordinator.md` (new, separate from plan-manager)
The coordinator runs in the main worktree. It does NOT write code. Its instructions:
- Create and manage Plan COB (full write access)
- `/rad-orchestrate <plan-id>`: Orchestrate multi-agent execution — analyze plan state, create worktrees, spawn workers, evaluate context feedback, merge and create patch at completion
- After workers complete: read their Context COBs, evaluate for plan adjustments (see Phase 4 table), update plan accordingly
- Manage issue lifecycle (comments, state changes, closure)
- **Tools:** Bash, Read, Glob, Grep, TaskList, TaskGet, TaskCreate, TaskUpdate

### Step 3: `commands/rad-orchestrate` (via pi extension)
The `/rad-orchestrate <plan-id>` command is implemented as a pi extension (`.pi/extensions/rad-orchestrator.ts`). It:
1. Reads the Plan COB and categorizes tasks (completed/in-progress/ready/blocked)
2. Creates worktrees and spawns worker subagents in parallel (up to 4 concurrent)
3. Evaluates Context COB feedback between batches
4. When all tasks complete, merges branches (`--no-ff`), creates one Radicle patch, closes plan and issues

### Step 4: `rad-plan task edit --files` ~~(CLI enhancement)~~ ✓ Done in v0.2.0
The `--files` flag was added to `rad-plan task edit` in v0.2.0. Workers can now update their file scope mid-execution:
```bash
rad-plan task edit <plan-id> <task-id> --files "src/client.rs,src/config.rs,src/types.rs"
```

### Step 5: Modify existing files
- **`commands/rad-import.md`** — Add `--dispatch` flag: after creating the plan, immediately show dispatch instructions
- **`.claude-plugin/plugin.json`** — Register `agents/coordinator.md`, `agents/worker.md`

## Execution Model: Parallel Multi-Session

The target model is parallel execution across multiple terminal sessions, with COBs as the coordination layer.

### How it works

1. **Coordinator session** (main worktree): Creates the Plan COB, identifies unblocked tasks, outputs dispatch instructions
2. **Worker sessions** (one per task): Human launches `claude --worktree <task-name>` per unblocked task
3. **Each worker session**: Reads its task from the Plan COB, executes, writes Context COB + patch
4. **Coordinator session**: Monitors Plan COB state, reads new Context COBs, adjusts plan, identifies next dispatch batch
5. **Repeat** until all tasks complete

### Session startup for workers

Each worker session needs two values: `plan-id` and `task-id`. These come from the coordinator's dispatch output (see Phase 2). How the worker receives them is harness-dependent:

- **Claude Code:** Passed as part of the agent prompt when the coordinator dispatches
- **CLI / pi:** Passed as arguments or environment variables by the human/script
- **Any other harness:** The worker posts a CLAIM comment (`rad-plan comment <plan-id> "CLAIM task:<task-id>"`) and reads its assignment

The Plan COB is the single source of truth. The worker reads its full assignment from `rad-plan show <plan-id> --json` after claiming.

### Conflict detection across parallel sessions

Since workers can run simultaneously, the coordinator must pre-check `affectedFiles` overlap before dispatching:
- Tasks with non-overlapping files → safe to run in parallel
- Tasks with overlapping files → must run sequentially (coordinator notes this in the plan)
- Workers that discover they need to modify unexpected files → write this to Context COB, coordinator detects and adjusts

### Session lifecycle example

```bash
# Coordinator session (Terminal 1)
> /rad-orchestrate plan-7f3a      # Shows dispatchable tasks:
                                  #   task-a1b2: "retry middleware" (READY)
                                  #   task-c3d4: "config validation" (READY)
                                  #   task-e5f6: "retry tests" (blocked by task-a1b2, WAIT)

# Worker sessions (spawned automatically by /rad-orchestrate)
# Each worker runs in its own worktree with plan-id + task-id
# Step 1: Claim task (convention-based via comment)
rad-plan comment plan-7f3a "CLAIM task:a1b2"
# Step 2: Read assignment
rad-plan show plan-7f3a --json     # Full task details, affectedFiles
# Step 3: Work, commit, write Context COB
# Step 4: Mark complete (link commit to task)
rad-plan task link-commit plan-7f3a a1b2 --commit 9a1b2c3

# Orchestrator loop continues — after workers complete:
# Re-analyzes plan, shows:
#   task-a1b2: COMPLETED (context: ctx-4d5f)
#   task-c3d4: COMPLETED (context: ctx-8a2b)
#   task-e5f6: "retry tests" (a1b2 done, READY)
#   ⚠ ctx-4d5f constraint: "assumes 30s timeout"
#     — no conflict with task-e5f6
```

## Addressing Key Gaps

### Gap 1: Task Assignment (harness-agnostic)

**Problem:** The original plan relied on Claude Code worktree naming conventions to match workers to tasks. This is fragile and harness-specific.

**Solution: Plan COB as task board with convention-based claim.**

> **v0.2.0 note:** The `TaskStatus` enum and `task start`/`task complete` subcommands were removed in v0.2.0. Tasks are now "done" when they have a `linkedCommit`. Claiming is done via plan comments instead of status changes.

The Plan COB provides these primitives:
- `rad-plan show <plan-id> --json` to read available tasks (tasks without `linkedCommit` are incomplete)
- `rad-plan comment <plan-id> "CLAIM task:<task-id>"` to signal claiming (convention)
- `rad-plan task link-commit <plan-id> <task-id> --commit <oid>` to mark done

The workflow becomes:

1. Coordinator creates plan, adds tasks, sets plan to Approved
2. Coordinator runs `rad-plan show <plan-id> --json` to list dispatchable tasks (unblocked + no `linkedCommit`)
3. Coordinator outputs task IDs and descriptions (these are the dispatch instructions)
4. Worker (in any harness, any worktree) receives a `plan-id` and `task-id` — these two values are the entire assignment
5. Worker claims by posting: `rad-plan comment <plan-id> "CLAIM task:<task-id>"`
6. Other workers/coordinator can check the plan thread for CLAIM comments to see which tasks are in progress

**Why this works:** The assignment is a Radicle COB operation (plan comment), not a file or environment variable or hook. Any tool that can run `rad-plan` can participate. The Plan COB is the single source of truth. Claiming is convention-based — the coordinator is the sole dispatcher and controls which tasks go to which workers.

**No harness-specific mechanisms needed.** The worker just needs two strings: plan-id and task-id.

### Gap 2: In-Flight Signaling (file scope changes)

**Problem:** Workers discover they need to modify files not in their `affectedFiles`. In the parallel model, another worker running simultaneously won't know until both are done.

**Solution: Plan COB comments + `task edit --files` for dual signaling.**

Workers use two channels when file scope changes:

1. **Immediate signal** via plan comment (human-readable, available to anyone polling the thread):
```bash
rad-plan comment <plan-id> "SIGNAL task:<task-id> files-added:src/config.rs,src/types.rs"
```

2. **Structured update** via `task edit --files` (machine-parseable, updates the task's `affectedFiles` field):
```bash
rad-plan task edit <plan-id> <task-id> --files "src/client.rs,src/config.rs,src/types.rs"
```

> **v0.2.0 note:** The `--files` flag on `task edit` was added in v0.2.0, so both channels are now available.

The coordinator (or other workers) can poll `rad-plan show <plan-id> --json` and check both the thread for SIGNAL comments and the task's `affectedFiles` field.

**Cost of the gap when signaling is missed:** If two parallel workers touch the same file without signaling, the worst case is a merge conflict when task branches are merged by the orchestrator at completion. This is caught at merge time and creates a resolution task. It's not catastrophic, just inefficient.

**Practical recommendation:** Workers should use both channels — `task edit --files` for the structured update and a SIGNAL comment for immediate visibility.

### Gap 3: Rework Lifecycle (after worker failure)

**Problem:** When a worker fails or produces incorrect output, what happens? The plan didn't specify whether to rework in the same worktree, create a new one, or how the commit evolves.

**Solution: Commit-based rework in existing worktrees.**

Workers produce commits, not patches. Rework happens at the commit level. The worktree is retained until the plan's patch is created, so rework can happen in-place.

**Rework workflow:**

1. **Orchestrator detects failure** — worker subprocess exits non-zero, or Context COB indicates problems (failing verification checks, constraint conflicts)
2. **Human decides** — the orchestrator surfaces the failure and offers options
3. **Rework options:**
   - **Same worktree, new session:** Launch a new worker session in the existing worktree. The code changes are still there. The worker reads Context COB feedback, makes corrections, amends the commit or creates a new one, then links the final commit to the task.
   - **Fresh worktree:** Create a new worktree from the main branch. Re-run the task from scratch, possibly with an updated task description.
   - **Skip:** Mark the task as blocked and continue with other tasks. Human addresses it later.

4. **After rework:** Worker links the corrected commit to the task via `task link-commit`. The Plan COB thread captures why rework was needed.

**Key insight:** Git history is the audit trail. No rebasing — if a task needed two attempts, both commits are preserved. The `linkedCommit` on the task points to the final correct commit. Merge commits at completion (with `--no-ff`) reference the task ID, so the full history is traceable.

**No harness-specific mechanisms needed.** `git`, `rad-plan`, and `rad-context` work from any tool.

## Verification

1. **Task claim test:** Create a Plan COB with 2 tasks. From a separate worktree, post a CLAIM comment for one task. Verify the plan thread shows the claim from any worktree. Check that the coordinator can parse CLAIM comments to determine which tasks are in progress.
2. **Worker end-to-end:** Manually run the worker workflow: CLAIM comment → implement → commit → create Context COB → link → `task link-commit`. Verify all COBs are consistent from the coordinator's perspective.
3. **Conflict detection:** Create two tasks with overlapping `affectedFiles`, verify the coordinator defers the second until the first has `linkedCommit`.
4. **In-flight signal:** Have a worker add a SIGNAL comment and run `rad-plan task edit --files` to update scope. Verify the coordinator can parse both signals.
5. **Rework in existing worktree:** After a worker failure, launch a new session in the same worktree, make corrections. Verify the corrected commit can be linked to the task.
6. **Context feedback:** Have a worker produce a Context COB with a constraint that conflicts with a later task. Verify the coordinator detects and adjusts the plan.
7. **Completion merge:** After all tasks complete, verify `--no-ff` merge of task branches produces merge commits with task IDs, and `git push rad HEAD:refs/patches` creates one patch for the whole plan.
8. **Harness independence:** Run the worker workflow using only `rad-plan`, `rad-context`, `rad`, and `git` CLI commands (no Claude Code-specific features) to verify the design works from any harness.
