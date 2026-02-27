# Multi-Agent Worktree Workflow with Radicle COBs

## Context

You've built two custom Radicle COBs — Plan (`me.hdh.plan`) and Context (`me.hdh.context`) — alongside the built-in Issues and Patches. The rad-skill plugin already has agents (`plan-manager`, `context-loader`), commands (`/rad-import`, `/rad-plan`, `/rad-context`, `/rad-sync`), and hooks. The missing piece is orchestrating multiple agents working in parallel git worktrees, using COBs as the shared coordination and observation layer.

**Key architectural fact:** COBs live in `~/.radicle/storage/`, accessed via the `rad` node daemon. All git worktrees share the same COB state instantly — no sync needed. Code is isolated per worktree; metadata flows freely through COBs.

## COB Access Model

The core design decision, per your guidance:

| COB Type | Write | Read |
|----------|-------|------|
| **Plan** (`me.hdh.plan`) | Coordinator only (structure + status). Reviewer can comment. | All agents |
| **Context** (`me.hdh.context`) | The worker that did the work. One context per session. Immutable observations. | All agents |
| **Issue** (`xyz.radicle.issue`) | Coordinator + any agent (comment, state change) | All agents |
| **Patch** (`xyz.radicle.patch`) | The worker that produced the code. One patch per task. | All agents (reviewer reads patch diffs) |

This maps to the COB designs: Context is immutable-at-creation (one writer), Plan has mutable status/tasks/links (central writer) with a discussion thread for reviewer comments, Issues are collaborative (multiple writers), Patches are proposals (one author).

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
  - Implements the change → one commit → one patch
  - Creates one Context COB capturing session observations
  - Links its commit to the plan task via `task link-commit` (marks done)
  - Links patch to Plan COB

### Reviewer (new agent)
- **File:** New `agents/reviewer.md`
- **Tools:** Bash, Read, Glob, Grep (read-only code access + rad CLI)
- **Runs in:** Main worktree (or any worktree — it doesn't modify code)
- **Triggered by:** Coordinator, after a worker completes and before proceeding
- **Responsibilities:**
  - Reads the worker's patch (`rad patch show`, `rad patch diff`)
  - Reads the Plan COB task (the original intent/spec)
  - Reads the worker's Context COB (approach, constraints, friction)
  - Reads the issue (original request)
  - Evaluates: Does the patch implement the task? Are conventions followed? Are Context constraints sound? Any issues the worker missed?
  - Writes: A comment on the Plan COB with assessment (pass / flag / fail + reasoning)
  - Does NOT modify code, create patches, or link commits

### Context Loader (existing, unchanged)
- **File:** Existing `agents/context-loader.md`
- **Role:** Used by both coordinator and workers to load prior Context COBs, issue details, patch context

## Feature Lifecycle

### Phase 1: Plan Decomposition
**Trigger:** `/rad-import <issue-id> --save-plan` or `/rad-dispatch create <issue-id>`

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
**Trigger:** `/rad-dispatch <plan-id>` (new command)

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
     b. Dispatch reviewer: assess patch against task intent + context
     c. Reviewer writes assessment comment on Plan COB (pass/flag/fail)
     d. If PASS: evaluate context feedback, adjust plan if needed, dispatch next
     e. If FLAG: surface concerns to human, proceed with caution
     f. If FAIL: task needs rework, escalate to human for rework decision
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
2. Radicle patch: `git push rad HEAD:refs/patches`
3. Context COB: `rad-context create --json` with approach, constraints, learnings, friction, open_items, files_touched
4. Links: `rad-context link <ctx-id> --plan <plan-id> --issue <issue-id> --patch <patch-id>`
5. Task completion: `rad-plan task link-commit <plan-id> <task-id> --commit <oid>`
6. Plan link: `rad-plan link <plan-id> --patch <patch-id>`

### Phase 4: Review

After a worker completes, the coordinator dispatches the reviewer before proceeding.

**What the reviewer reads:**
```bash
rad patch show <patch-id>          # The worker's code change
rad patch diff <patch-id>          # The actual diff
rad-plan show <plan-id> --json     # The task spec (intent)
rad-context show <context-id> --json  # The worker's observations
rad issue show <issue-id>          # The original request
```

**What the reviewer evaluates:**
1. **Intent match:** Does the patch implement what the task describes?
2. **Constraint soundness:** Are the Context COB's constraints reasonable? Do they break assumptions elsewhere?
3. **Convention compliance:** Does the code follow codebase patterns and conventions?
4. **Missed issues:** Anything the worker didn't catch (error handling, edge cases, test gaps)?
5. **Scope creep:** Did the worker do more or less than the task specified?

**What the reviewer writes:**
- A comment on the Plan COB: `rad-plan comment <plan-id> "REVIEW [pass|flag|fail]: <reasoning>"`
- If flagging concerns: a comment on the Issue for human visibility

**Coordinator's response to review:**
- **Pass:** Proceed to context feedback evaluation (Phase 5)
- **Flag:** Surface the reviewer's concerns to the human alongside the context feedback. Human decides whether to proceed or rework.
- **Fail:** Task remains incomplete. Coordinator adds a plan comment explaining the failure. Human decides: rework in a new worktree session, or adjust the plan.

### Phase 5: Context Feedback

After review passes (or the human accepts a flagged result), the coordinator reads the Context COB and evaluates:

| Context Field | Signal | Coordinator Action |
|---|---|---|
| `open_items` with new scope | "Circuit breaker needed" | Create new issue or add task to plan |
| `constraints` conflicting with later tasks | "Assumes tower 0.4" but task N upgrades to 0.5 | Block task N, modify description |
| `friction` suggesting different approach | "Borrow checker issues with X" | Add warning to related task descriptions |
| `filesTouched ⊄ affectedFiles` | Worker modified unexpected files | Update task's `affectedFiles` via `task edit --files`, re-check in-progress conflicts |
| `learnings.code` revealing architecture issue | "Incompatible with planned approach" | Pause plan, escalate to human |

### Phase 6: Completion

1. All leaf tasks have `linkedCommit` and are reviewed
2. Coordinator: `rad-plan status <plan-id> completed`
3. Coordinator closes issue with summary comment
4. Patches ready for delegate merge (with reviewer assessments as attestations)
5. Context COBs form complete observational record of how the feature was built

## Information Flow Diagram

```
Issue (input)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  COORDINATOR (main worktree)                     │
│  Reads: issue, prior contexts, codebase          │
│  Writes: Plan COB, issue comments                │
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
│  1 patch     ││  1 patch     ││  1 patch     │
│  1 context   ││  1 context   ││  1 context   │
│  link-commit ││  link-commit ││  link-commit │
└──────┬───────┘└──────┬───────┘└──────┬───────┘
       │               │               │
       ▼               ▼               ▼
┌─────────────────────────────────────────────────┐
│  REVIEWER (main worktree, per completed task)    │
│  Reads: patch diff, plan task, context COB       │
│  Writes: assessment comment on Plan COB          │
│  Output: pass / flag / fail                      │
└───────────────────────┬─────────────────────────┘
                        │
                        ▼
              Coordinator evaluates:
              - Review assessment
              - Context COB feedback
              - Plan adjustments
              - Next dispatch batch
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
- Produce one commit, push one patch: `git push rad HEAD:refs/patches`
- Create one Context COB via `rad-context create --json` with all observational fields
- Link context to plan, issue, patch, commit
- Mark own task complete: `rad-plan task link-commit <plan-id> <task-id> --commit <oid>`
- Do NOT modify Plan COB structure (no adding/removing tasks, no changing descriptions or dependencies)
- **Tools:** Bash, Read, Write, Edit, Glob, Grep

### Step 2: `agents/coordinator.md` (new, separate from plan-manager)
The coordinator runs in the main worktree. It does NOT write code. Its instructions:
- Create and manage Plan COB (full write access)
- `/rad-dispatch <plan-id>`: Read plan state, identify dispatchable tasks (unblocked + no file conflicts with in-progress), output dispatch instructions for the human
- After workers complete: read their Context COBs, evaluate for plan adjustments (see Phase 4 table), update plan accordingly
- Manage issue lifecycle (comments, state changes, closure)
- **Tools:** Bash, Read, Glob, Grep, TaskList, TaskGet, TaskCreate, TaskUpdate

### Step 3: `agents/reviewer.md` (new)
The reviewer agent is dispatched by the coordinator after a worker completes. Its instructions:
- Read the worker's patch diff (`rad patch diff`)
- Read the Plan COB task that was assigned (the intent)
- Read the worker's Context COB (the observation)
- Read the issue for original context
- Evaluate: intent match, constraint soundness, convention compliance, missed issues, scope
- Write a single assessment comment on the Plan COB: `rad-plan comment <plan-id> "REVIEW [pass|flag|fail]: <reasoning>"`
- Do NOT modify code, create patches, change task status, or modify plan structure
- **Tools:** Bash, Read, Glob, Grep

### Step 4: `commands/rad-dispatch.md` (new)
New `/rad-dispatch <plan-id>` slash command. When invoked:
1. Reads the Plan COB
2. Calculates which tasks are dispatchable (unblocked + no file overlap with in-progress)
3. For each dispatchable task, outputs: task details, suggested worktree name, files to modify
4. After workers finish, re-run to see next batch + context feedback summary
5. When all tasks complete, offers to close the plan and issue

### Step 5: `rad-plan task edit --files` ~~(CLI enhancement)~~ ✓ Done in v0.2.0
The `--files` flag was added to `rad-plan task edit` in v0.2.0. Workers can now update their file scope mid-execution:
```bash
rad-plan task edit <plan-id> <task-id> --files "src/client.rs,src/config.rs,src/types.rs"
```

### Step 6: Modify existing files
- **`commands/rad-import.md`** — Add `--dispatch` flag: after creating the plan, immediately show dispatch instructions
- **`.claude-plugin/plugin.json`** — Register `agents/coordinator.md`, `agents/worker.md`, `agents/reviewer.md`, `commands/rad-dispatch.md`

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
> /rad-dispatch plan-7f3a         # Shows dispatchable tasks:
                                  #   task-a1b2: "retry middleware" (READY)
                                  #   task-c3d4: "config validation" (READY)
                                  #   task-e5f6: "retry tests" (blocked by task-a1b2, WAIT)

# Worker sessions (Terminals 2+3, any harness)
# Each worker needs: plan-id + task-id
# Step 1: Claim task (convention-based via comment)
rad-plan comment plan-7f3a "CLAIM task:a1b2"
# Step 2: Read assignment
rad-plan show plan-7f3a --json     # Full task details, affectedFiles
# Step 3: Work, commit, push patch, write Context COB
# Step 4: Mark complete (link commit to task)
rad-plan task link-commit plan-7f3a a1b2 --commit 9a1b2c3

# Back in coordinator (Terminal 1), after workers complete:
> /rad-dispatch plan-7f3a         # Reads new Context COBs, shows:
                                  #   task-a1b2: COMPLETED (context: ctx-4d5f)
                                  #   task-c3d4: COMPLETED (context: ctx-8a2b)
                                  #   task-e5f6: "retry tests" (a1b2 done, READY)
                                  #   ⚠ ctx-4d5f constraint: "assumes 30s timeout"
                                  #     — no conflict with task-e5f6
                                  #   REVIEW pass: task-a1b2 implements retry correctly
                                  #   REVIEW flag: task-c3d4 added validation but missed edge case
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

**Cost of the gap when signaling is missed:** If two parallel workers touch the same file without signaling, the worst case is a merge conflict when their patches are applied. This is caught at patch merge time and creates a resolution task. It's not catastrophic, just inefficient.

**Practical recommendation:** Workers should use both channels — `task edit --files` for the structured update and a SIGNAL comment for immediate visibility.

### Gap 3: Rework Lifecycle (after review failure)

**Problem:** When a reviewer flags or fails a worker's output, what happens? The plan didn't specify whether to rework in the same worktree, create a new one, or how the patch evolves.

**Solution: Use Radicle's native patch revision model.**

Radicle patches support revisions. When a worker force-pushes to `refs/patches`, it creates a new immutable revision of the same patch. Every prior revision is preserved and diffable. This is a core Radicle primitive (from `agents-with-radicle-exploration.md`): "Force-push doesn't destroy; it appends. Every state is diffable."

**Rework workflow:**

1. **Reviewer writes assessment** on Plan COB: `rad-plan comment <plan-id> "REVIEW fail task:<task-id> patch:<patch-id>: <reason>"`
2. **Coordinator reads review**, task has no `linkedCommit` yet (worker should not link commit until review passes)
3. **Rework options** (coordinator/human decides):
   - **Same worktree, new session:** Launch a new agent session in the existing worktree. The code changes are still there. The agent reads the review feedback from the Plan COB comment, makes corrections, amends or creates a new commit, force-pushes → new patch revision.
   - **New worktree from patch:** If the worktree was cleaned up, checkout the patch with `rad patch checkout <patch-id>`, which creates a branch at the patch head. Make corrections, push revised patch.
   - **Abandon and retry:** Close the patch (`rad patch archive <patch-id>`), create a fresh worktree, re-run the task from scratch with the review feedback added to the task description.

4. **After rework:** Worker pushes revised patch (same patch ID, new revision). Reviewer re-evaluates. The Plan COB accumulates the full history in its discussion thread.

**Key insight:** The rework lifecycle is just another iteration through the same loop: worker → reviewer → coordinator. The patch revision model means nothing is lost. The Plan COB thread captures why rework was needed. The task has no `linkedCommit` throughout rework — the worker only runs `task link-commit` after the reviewer passes the final revision.

**No harness-specific mechanisms needed.** `rad patch checkout`, `git push rad`, and `rad-plan comment` work from any tool.

## Verification

1. **Task claim test:** Create a Plan COB with 2 tasks. From a separate worktree, post a CLAIM comment for one task. Verify the plan thread shows the claim from any worktree. Check that the coordinator can parse CLAIM comments to determine which tasks are in progress.
2. **Worker end-to-end:** Manually run the worker workflow: CLAIM comment → implement → commit → push patch → create Context COB → link → `task link-commit`. Verify all COBs are consistent from the coordinator's perspective.
3. **Conflict detection:** Create two tasks with overlapping `affectedFiles`, verify the coordinator defers the second until the first has `linkedCommit`.
4. **In-flight signal:** Have a worker add a SIGNAL comment and run `rad-plan task edit --files` to update scope. Verify the coordinator can parse both signals.
5. **Review loop:** Worker completes → reviewer writes REVIEW comment → coordinator reads assessment. Test both pass and fail paths.
6. **Rework via patch revision:** After a review failure, launch a new session in the same worktree, make corrections, force-push. Verify the patch now has 2 revisions and the reviewer can re-evaluate.
7. **Context feedback:** Have a worker produce a Context COB with a constraint that conflicts with a later task. Verify the coordinator detects and adjusts the plan.
8. **Harness independence:** Run the worker workflow using only `rad-plan`, `rad-context`, `rad`, and `git` CLI commands (no Claude Code-specific features) to verify the design works from any harness.
