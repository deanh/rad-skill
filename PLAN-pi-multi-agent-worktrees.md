# Implementation Plan: Issue → Plan → Commit → Context with Pi Multi-Agent Worktrees

## Executive Summary

This plan describes how to implement a fully automated multi-agent workflow using pi's SDK and extension system, where a coordinator agent decomposes Radicle issues into Plan COB tasks and dispatches worker agents into isolated git worktrees. Each worker produces one commit and one Context COB, linking the commit to its plan task (which marks it done). The coordinator owns the Radicle patch — a single patch per plan, created after all tasks complete. The coordinator evaluates context feedback and iterates until the plan is complete.

The existing `agents-cobs-worktrees.md` design doc and the v0.6.0 agent/command markdown files describe the *what* (roles, protocols, COB semantics). This plan describes the *how* — the pi-native implementation that makes it executable.

> **Note on reviewer agent**: The `agents-cobs-worktrees.md` design doc describes a reviewer agent role. This has been **deferred** — it adds complexity without clear value until the worker loop is proven. This plan omits it entirely. See [Stale Documentation](#stale-documentation-reviewer-references) for files that need updating to reflect this decision.

---

## Current State

### What exists (v0.6.0 + unreleased)

| Artifact | Status | Notes |
|----------|--------|-------|
| `agents/worker.md` | ✅ Written | Full protocol: claim → read → implement → commit → context → link-commit (needs update: remove patch push) |
| `agents/plan-manager.md` | ✅ Written | Dispatch analysis, context feedback evaluation, plan lifecycle |
| `commands/rad-dispatch.md` | ✅ Written | Snapshot-based dispatch report with categorization |
| `commands/rad-plan.md` | ✅ Written | Full Plan COB management |
| `skills/rad-plans/SKILL.md` | ✅ Updated for v0.2.0 | linkedCommit model, short-form IDs |
| `skills/rad-contexts/SKILL.md` | ✅ Updated | verification, taskId, JSON validation |
| `.pi/extensions/rad-context.ts` | ✅ Working | Auto-creates Context COBs on compaction |
| Pi extension for orchestration | ❌ Not created | No automation — dispatch is manual snapshot |
| Worktree creation/cleanup | ❌ Not created | Human creates worktrees manually |
| SDK-based subagent spawning | ❌ Not created | No programmatic agent launch |

### What the design doc assumes but pi doesn't natively support

1. **Worktree isolation per agent**: pi has no built-in `--worktree` flag. The subagent example spawns `pi` processes with `cwd` set to an arbitrary directory — git worktrees are just directories, so this works.

2. **Agent definitions as system prompts**: The subagent example loads `.md` files from `~/.pi/agent/agents/` and `--append-system-prompt` injects them. Our worker `.md` file can serve this role directly.

3. **Inter-agent communication**: The design doc uses COBs as the communication layer. This is correct — `rad-plan`, `rad-context`, and `rad issue` CLI commands work from any worktree because COBs live in `~/.radicle/storage/`, not in the working directory.

---

## Architecture

### Core Insight

Pi's subagent extension pattern (spawn `pi` as subprocess with `--mode json`, custom cwd, custom tools, injected system prompt) maps directly onto the worktree-per-worker model. The key addition is:

1. A **coordinator extension** that automates the dispatch loop instead of presenting a snapshot report
2. **Worktree lifecycle management** (create before dispatch, clean up after completion)
3. **COB polling** to detect worker completion and extract context feedback

### Component Map

```
.pi/extensions/
├── rad-context.ts          # Existing: auto-create Context COBs on compaction
└── rad-orchestrator.ts     # NEW: coordinator + dispatch + worktree + subagent spawning

.pi/agents/                 # NEW directory (pi subagent convention)
└── rad-worker.md           # Worker system prompt (derived from agents/worker.md)

agents/                     # Existing: skill-level agent docs (remain as reference)
├── plan-manager.md
├── worker.md
└── context-loader.md

commands/                   # Existing: slash command definitions (remain for manual use)
├── rad-dispatch.md
├── rad-plan.md
└── ...
```

### Why a single extension, not separate ones

The coordinator, dispatch loop, worktree management, and subagent spawning are tightly coupled — the coordinator needs to create worktrees, spawn workers into them, poll for completion, evaluate context, and iterate. Splitting these across extensions would require complex cross-extension state sharing via `pi.events`. A single extension with internal modules is cleaner.

---

## Implementation Steps

### Step 1: Create `.pi/agents/rad-worker.md`

**Purpose**: Pi subagent system prompt for workers, derived from the existing `agents/worker.md`.

**Key differences from the skill-level `agents/worker.md`**:
- Must be a valid pi agent definition with YAML frontmatter (`name`, `description`, `tools`, `model`)
- System prompt is self-contained — no references to slash commands or Claude Code tasks
- Receives `plan-id` and `task-id` via the task text (the subagent tool passes these as part of the prompt)
- Tools: `read`, `bash`, `write`, `edit` (standard coding tools — all `rad` CLI access goes through `bash`)

**Frontmatter**:
```yaml
---
name: rad-worker
description: Executes a single Plan COB task in an isolated worktree
tools: read, bash, write, edit
model: claude-sonnet-4-5
---
```

**System prompt content**: Adapted from `agents/worker.md` sections — startup protocol (claim, read assignment, load contexts, read issue, explore codebase), execution rules (stay scoped, follow patterns, signal file changes), completion protocol (commit, create context COB, link commit to task, announce).

**Key change from existing `agents/worker.md`**: Workers do **not** push Radicle patches. They produce commits on worktree branches. The orchestrator is responsible for creating a single Radicle patch per plan after all tasks are complete (or per batch, depending on the merge strategy). This simplifies the worker protocol and keeps patch lifecycle at the coordination layer.

**Estimated size**: ~130 lines of markdown.

### Step 2: Create `.pi/extensions/rad-orchestrator.ts`

This is the main implementation. It registers:
- A `/rad-orchestrate` command (the automated dispatch loop)
- A `rad_dispatch` custom tool (so the LLM can trigger dispatch analysis)
- Worktree lifecycle helpers
- Subagent spawning logic (adapted from pi's subagent example)

#### 2a: Worktree Lifecycle

```typescript
// Create a worktree for a task
async function createWorktree(taskId: string, slug: string): Promise<string> {
  const name = `worktree-${taskId.slice(0, 7)}-${slug}`;
  const worktreePath = path.join(process.cwd(), '..', name);
  await pi.exec('git', ['worktree', 'add', worktreePath, '-b', `task/${taskId.slice(0, 7)}`]);
  return worktreePath;
}

// Remove a worktree after merge
async function removeWorktree(worktreePath: string): Promise<void> {
  await pi.exec('git', ['worktree', 'remove', worktreePath]);
}
```

Worktrees are created as siblings of the main repo directory. Branch names include the task ID prefix for traceability.

#### 2b: Subagent Spawning

Adapted from the subagent extension's `runSingleAgent` function. The key insight is that pi's subagent pattern uses `spawn("pi", [...args], { cwd })` — we set `cwd` to the worktree path.

```typescript
async function spawnWorker(
  worktreePath: string,
  planId: string,
  taskId: string,
  signal: AbortSignal,
  onUpdate: (partial: any) => void,
): Promise<WorkerResult> {
  // Build the task prompt with plan-id and task-id
  const taskPrompt = `Execute task ${taskId} from plan ${planId}. ` +
    `Read the plan with: rad-plan show ${planId} --json`;

  const args = [
    '--mode', 'json',
    '-p',
    '--no-session',
    '--model', 'claude-sonnet-4-5',
    '--append-system-prompt', agentPath('rad-worker.md'),
    taskPrompt,
  ];

  // Spawn pi subprocess in the worktree directory
  const proc = spawn('pi', args, { cwd: worktreePath, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  // ... event parsing logic from subagent example ...
}
```

#### 2c: The `/rad-orchestrate` Command

This is the automated dispatch loop. It replaces the manual `/rad-dispatch` snapshot with an interactive orchestration session.

```typescript
pi.registerCommand('rad-orchestrate', {
  description: 'Orchestrate multi-agent execution of a Plan COB',
  handler: async (args, ctx) => {
    const planId = args.trim();
    if (!planId) {
      ctx.ui.notify('Usage: /rad-orchestrate <plan-id>', 'error');
      return;
    }

    // Phase 1: Load and validate plan
    const plan = await loadPlan(planId);
    if (plan.status !== 'approved' && plan.status !== 'in-progress') {
      const proceed = await ctx.ui.confirm(
        'Plan not approved',
        `Plan status is "${plan.status}". Approve and proceed?`
      );
      if (!proceed) return;
      await pi.exec('rad-plan', ['status', planId, 'approved']);
    }

    // Phase 2: Dispatch loop
    while (true) {
      const state = await analyzePlan(planId);

      if (state.allComplete) {
        // Phase 6: Completion
        await completePlan(planId, state, ctx);
        break;
      }

      if (state.ready.length === 0 && state.inProgress.length === 0) {
        ctx.ui.notify('No tasks ready and none in progress. Plan may be stuck.', 'warning');
        break;
      }

      // Show current state
      ctx.ui.notify(formatDispatchReport(state), 'info');

      // Confirm dispatch
      if (state.ready.length > 0) {
        const dispatchCount = await ctx.ui.select(
          `Dispatch ${state.ready.length} ready task(s)?`,
          ['Dispatch all', 'Dispatch one', 'Skip', 'Stop orchestration']
        );
        if (dispatchCount === 'Stop orchestration') break;
        if (dispatchCount === 'Skip') { /* wait for in-progress */ }
        else {
          const tasks = dispatchCount === 'Dispatch one'
            ? [state.ready[0]]
            : state.ready;

          // Create worktrees and spawn workers in parallel
          const workers = await Promise.all(tasks.map(async (task) => {
            const worktreePath = await createWorktree(task.id, slugify(task.subject));
            return spawnWorker(worktreePath, planId, task.id, signal, onUpdate);
          }));

          // Report worker results
          for (const worker of workers) {
            if (!worker.success) {
              ctx.ui.notify(`Worker FAILED for task ${worker.taskId}`, 'error');
              const action = await ctx.ui.select('Action?', ['Retry in same worktree', 'Skip', 'Stop']);
              // Handle failure...
            }
          }

          // Evaluate context feedback from completed workers
          await evaluateContextFeedback(planId, state, ctx);
        }
      } else {
        // Tasks in progress but none ready — poll
        ctx.ui.notify('Waiting for in-progress tasks to complete...', 'info');
        await pollForCompletion(planId, state.inProgress);
      }
    }
  }
});
```

#### 2d: Plan Analysis (replacing manual `/rad-dispatch`)

The `analyzePlan` function encapsulates the logic from `commands/rad-dispatch.md`:

```typescript
interface PlanState {
  completed: Task[];
  inProgress: Task[];    // Has CLAIM comment but no linkedCommit
  ready: Task[];         // Unblocked, no file conflicts
  blockedDep: Task[];    // Dependency not met
  blockedFile: Task[];   // File conflict with in-progress
  allComplete: boolean;
  contextFeedback: ContextFeedback[];
}

async function analyzePlan(planId: string): Promise<PlanState> {
  const result = await pi.exec('rad-plan', ['show', planId, '--json']);
  const plan = JSON.parse(result.stdout);
  // ... categorization logic from rad-dispatch.md ...
  // ... SIGNAL comment parsing ...
  // ... context feedback loading ...
}
```

#### 2e: Context Feedback Evaluation

After each batch, the coordinator reads Context COBs from completed workers and evaluates against remaining tasks (the logic from `plan-manager.md`'s "Evaluate Context Feedback" workflow):

```typescript
async function evaluateContextFeedback(planId: string, state: PlanState, ctx: ExtensionCommandContext) {
  for (const feedback of state.contextFeedback) {
    // Check constraints against remaining tasks
    for (const constraint of feedback.constraints) {
      const conflicting = state.remaining.filter(t =>
        t.description.toLowerCase().includes(constraintKeyword(constraint))
      );
      if (conflicting.length > 0) {
        ctx.ui.notify(
          `⚠ Constraint from ${feedback.contextId}: "${constraint}" may conflict with task ${conflicting[0].id}`,
          'warning'
        );
      }
    }

    // Check for file scope changes
    if (feedback.filesTouched && feedback.affectedFiles) {
      const unexpected = feedback.filesTouched.filter(f => !feedback.affectedFiles.includes(f));
      if (unexpected.length > 0) {
        ctx.ui.notify(
          `⚠ Worker modified unexpected files: ${unexpected.join(', ')}`,
          'warning'
        );
      }
    }

    // Surface open items
    for (const item of feedback.openItems) {
      ctx.ui.notify(`ℹ Open item from ${feedback.taskId}: ${item}`, 'info');
    }
  }
}
```

#### 2f: Completion and Patch Creation

When all tasks have linked commits, the orchestrator:
1. Merges worktree branches into a single branch (or cherry-picks commits)
2. Creates the Radicle patch — one patch representing the entire plan's work
3. Links the patch to the plan
4. Closes the plan and linked issues

```typescript
async function completePlan(planId: string, state: PlanState, ctx: ExtensionCommandContext) {
  const ok = await ctx.ui.confirm(
    'All tasks complete',
    'Merge branches, create patch, and close the plan?'
  );
  if (!ok) return;

  // Merge task branches into a plan branch (--no-ff always, task ID in message)
  const planBranch = `plan/${planId.slice(0, 7)}`;
  await pi.exec('git', ['checkout', '-b', planBranch]);
  for (const task of state.completed) {
    const taskBranch = `task/${task.id.slice(0, 7)}`;
    await pi.exec('git', ['merge', taskBranch, '--no-ff',
      '-m', `Merge task ${task.id.slice(0, 7)}: ${task.subject}`]);
  }

  // Push the Radicle patch (one patch for the whole plan)
  const pushResult = await pi.exec('git', ['push', 'rad', `HEAD:refs/patches`]);
  // Extract patch ID from push output
  const patchId = parsePatchId(pushResult.stdout + pushResult.stderr);

  if (patchId) {
    // Link patch to plan
    await pi.exec('rad-plan', ['link', planId, '--patch', patchId]);
    ctx.ui.notify(`Patch created: ${patchId.slice(0, 8)}`, 'info');
  }

  // Close plan and issues
  await pi.exec('rad-plan', ['status', planId, 'completed']);
  for (const issueId of plan.relatedIssues) {
    await pi.exec('rad', ['issue', 'state', issueId, '--closed']);
  }
  await pi.exec('rad', ['sync', '--announce']);
  ctx.ui.notify('Plan completed and announced.', 'success');
}
```

**Why one patch per plan**: Workers produce commits on task branches. The orchestrator merges these and pushes a single Radicle patch that represents the full implementation of the plan. This keeps patch semantics at the coordination level — a patch is a proposal for review by the project delegate, not an internal bookkeeping artifact per task. The task → commit linkage (via `linkedCommit`) provides the per-task traceability.

### Step 3: Update `.pi/settings.json`

Add the skills directory reference (already done) and ensure the new extension is discoverable:

```json
{
  "skills": ["./skills"]
}
```

The extension in `.pi/extensions/rad-orchestrator.ts` is auto-discovered by pi.

### Step 4: Integration with Existing `rad-context.ts` Extension

The existing `rad-context.ts` extension auto-creates Context COBs when compaction occurs in the *coordinator's* session. This is complementary — workers create their own Context COBs explicitly (part of the worker protocol), while the coordinator's session context is captured on compaction.

No changes needed to `rad-context.ts`. The two extensions coexist independently.

### Step 5: Update Existing Skill Files

The skill markdown files (`skills/rad-plans/SKILL.md`, `skills/rad-contexts/SKILL.md`) need a section on the orchestrated workflow:

- Add a "Multi-Agent Workflow" section to `rad-plans/SKILL.md` explaining how Plan COBs serve as the task board for parallel workers
- Add a "Worker Context Creation" section to `rad-contexts/SKILL.md` explaining the worker's explicit context creation protocol vs. the coordinator's auto-compaction context

---

## Concurrency Model

### Parallel Workers

Workers run as separate `pi` processes in separate worktrees. They are fully isolated:
- Each has its own git working directory
- Each has its own pi session (ephemeral, `--no-session`)
- COB access is shared (via `~/.radicle/storage/`)
- No shared mutable state in the extension

The coordinator spawns workers using `Promise.all` with a concurrency limit (default 4, matching the subagent example's `MAX_CONCURRENCY`).

### Polling vs. Event-Driven

Workers signal completion by committing and running `rad-plan task link-commit`. The coordinator detects this by re-reading the plan JSON. This is polling-based (same as the existing `/rad-dispatch` design). COBs don't support push notifications, but since the coordinator spawns the workers as subprocesses, it knows when they exit — worker process exit is the primary completion signal, with plan JSON confirming the `linkedCommit` was set.

---

## Risk Assessment

### Risk 1: Worker Fails Mid-Execution

**Scenario**: Worker crashes, hits rate limit, or produces broken code.

**Mitigation**: The subagent spawner captures exit codes and stderr. A non-zero exit means the task was not completed — no `linkedCommit` appears, no Context COB is created. The coordinator detects this and offers retry options to the human.

### Risk 2: File Conflicts Between Parallel Workers

**Scenario**: Two workers modify the same file despite `affectedFiles` being disjoint.

**Mitigation**: This is the SIGNAL comment + `task edit --files` mechanism from the design doc. Workers signal file scope changes, and the coordinator re-checks before dispatching the next batch. Worst case: merge conflict when the orchestrator merges task branches during plan completion, caught by git.

### Risk 3: COB CLI Not Installed

**Scenario**: `rad-plan` or `rad-context` not available.

**Mitigation**: The extension checks `command -v` at startup (same pattern as `rad-context.ts`). If missing, the orchestration command is disabled with an install message.

### Risk 4: Radicle Node Not Running

**Scenario**: `rad sync --announce` fails.

**Mitigation**: Non-fatal — sync is advisory. Workers and coordinator work entirely through local COB state. Sync can be retried later.

### Risk 5: Worker Context Window Overflow

**Scenario**: Large codebases or complex tasks cause the worker to hit context limits.

**Mitigation**: Workers run with `--no-session` and pi's auto-compaction. The worker's system prompt emphasizes staying scoped to the task's `affectedFiles`. If the task is too large, the coordinator should have decomposed it further.

---

## UX Flow (End-to-End Example)

```
# User has a Radicle issue they want to implement
$ pi

> /rad-import abc1234 --save-plan
  # Coordinator loads issue, explores codebase, creates Plan COB
  # Plan: 4 tasks, linked to issue abc1234
  # Plan ID: plan-7f3a

> /rad-orchestrate plan-7f3a

  Dispatch: "Implement retry middleware" (plan-7f3a)
  ════════════════════════════════════════════════
  Status: 0/4 completed | 0 in progress | 2 ready | 2 blocked

  Ready:
    ○ task-a1b2: "Add retry middleware" — src/client.rs, src/middleware.rs
    ○ task-c3d4: "Add config validation" — src/config.rs, src/types.rs

  Blocked:
    ✕ task-e5f6: "Add retry tests" — waiting on task-a1b2
    ✕ task-g7h8: "Update docs" — waiting on task-e5f6

  [Select] Dispatch 2 ready task(s)?
  > Dispatch all

  Creating worktree-a1b2-retry-middleware...
  Creating worktree-c3d4-config-validation...

  ⏳ rad-worker [task-a1b2] (running...)
     → $ rad-plan comment plan-7f3a "CLAIM task:a1b2"
     → read src/client.rs
     → edit src/middleware.rs
     → $ git commit -m "Add retry middleware with exponential backoff"
  ✓ rad-worker [task-a1b2] completed

  ⏳ rad-worker [task-c3d4] (running...)
     → $ rad-plan comment plan-7f3a "CLAIM task:c3d4"
     → read src/config.rs
     → edit src/types.rs
     → $ git commit -m "Add config validation for retry settings"
  ✓ rad-worker [task-c3d4] completed

  Context feedback:
    ℹ ctx-f7g8 constraint: "Assumes tower 0.4 service trait"
      → No conflicts with remaining tasks

  Next batch:
    ○ task-e5f6: "Add retry tests" — READY (task-a1b2 complete)

  [Select] Dispatch 1 ready task(s)?
  > Dispatch all

  ... (continues until all tasks complete) ...

  All tasks complete!
    Merging task branches into plan/7f3a...
    ✓ Patch created: patch-b3c4 (4 commits from 4 tasks)
    ✓ Plan plan-7f3a marked completed
    ✓ Issue abc1234 closed
    ✓ Announced to network
```

---

## Dependency Order

```
Step 1: .pi/agents/rad-worker.md          (no deps)
Step 2: .pi/extensions/rad-orchestrator.ts (depends on Step 1)
  2a: Worktree lifecycle helpers           (no deps)
  2b: Subagent spawning                    (depends on 2a, Step 1)
  2c: /rad-orchestrate command             (depends on 2b, 2d, 2e, 2f)
  2d: Plan analysis                        (no deps)
  2e: Context feedback evaluation          (no deps)
  2f: Completion handler                   (no deps)
Step 3: Settings update                    (no deps)
Step 4: Verify rad-context.ts coexistence  (depends on Step 2)
Step 5: Update skill docs                  (depends on all above)
```

Steps 1, 2a, 2d, 2e, 2f, and 3 can all be done in parallel. Step 2b requires the agent definition. Step 2c ties everything together. Step 5 is documentation.

---

## Design Decisions

1. **Worker model: Sonnet default, configurable later.** Sonnet is the right quality level for code-writing tasks that need to understand existing patterns, stay scoped, and produce genuine Context COB observations. The pi agent frontmatter already supports `model:` so per-task override is trivial to add later if cost becomes a concern.

2. **Worktree cleanup: retain until patch is created.** Worktrees are cheap (shared `.git` objects) and having them around enables rework without re-checkout. The completion handler cleans them up after the plan's patch is pushed.

3. **Parallel worker limit: 4 concurrent, configurable.** Matches the subagent example's `MAX_CONCURRENCY`. The bottleneck is API rate limits more than local resources. Exposed as a constant in the extension for easy adjustment.

4. **Drop `/rad-dispatch`.** Having both `/rad-dispatch` (read-only snapshot) and `/rad-orchestrate` (automated loop) creates "which one do I use?" confusion. `/rad-orchestrate` shows the full dispatch report as its first step before asking whether to proceed, which covers the diagnostic use case. Remove `commands/rad-dispatch.md`.

5. **One patch per plan.** A single Radicle patch represents the full implementation of the issue. This matches the mental model ("this patch implements issue X") and keeps things simple. Per-batch patches add partial review states and multiple-patches-per-plan complexity for unclear benefit. The patch is the human-facing artifact for delegate review; the git history underneath is the audit trail.

6. **`--no-ff` always, merge commit includes task ID.** No rebasing — rewriting SHAs breaks `linkedCommit` references and destroys evidence of changes. `--no-ff` preserves per-task boundaries in git history even when fast-forward is possible, which is valuable when tasks produce multiple commits. The merge commit message includes the task ID for cross-referencing back to the Plan COB (e.g., `Merge task a1b2: Add retry middleware`). The Radicle patch presents a clean diff regardless of merge commits underneath — the patch is the presentation layer, git history is the audit trail.

---

## Files to Create/Modify

| File | Action | Size Estimate |
|------|--------|---------------|
| `.pi/agents/rad-worker.md` | Create | ~130 lines |
| `.pi/extensions/rad-orchestrator.ts` | Create | ~550-700 lines (includes patch creation at completion) |
| `agents/worker.md` | Modify | Remove patch push, patch linking; simplify to commit + context |
| `agents-cobs-worktrees.md` | Modify | Remove reviewer role, move patches to coordinator level |
| `commands/rad-dispatch.md` | Delete | Replaced by `/rad-orchestrate` |
| `skills/rad-plans/SKILL.md` | Modify | +20 lines |
| `skills/rad-contexts/SKILL.md` | Modify | +15 lines |
| `CHANGELOG.md` | Modify | +15 lines |

---

## Stale Documentation: Worker Patch References

The original design had workers push individual Radicle patches per task. The updated model is: **workers produce commits, the orchestrator creates a single patch per plan**. The following files contain stale per-worker-patch references:

### `agents/worker.md` (major — core protocol change)

| Line(s) | Content | Action |
|---------|---------|--------|
| 3 | Description: "produces one commit, one patch, one Context COB" | Change to "produces one commit, one Context COB" |
| 147 | `git push rad HEAD:refs/patches` | Remove — workers don't push patches |
| 148-150 | "Capture the patch ID from the output" | Remove |
| 213-216 | Link patch to context: `rad-context link <context-id> --patch <patch-id>` | Remove |
| 219-221 | Link patch to plan: `rad-plan link <plan-id> --patch <patch-id>` | Remove |
| 257 | "create exactly one commit, one patch, and one Context COB" | Change to "create exactly one commit and one Context COB" |
| 263 | "If `git push rad` fails..." error handling | Remove |
| 291 | Example: `git push rad HEAD:refs/patches` | Remove from example |

### `agents-cobs-worktrees.md` (major — throughout)

| Line(s) | Content | Action |
|---------|---------|--------|
| 18 | COB Access Model: "One patch per task" | Change to: Patches are plan-level, created by coordinator |
| 42 | Worker responsibilities: "one commit → one patch" | Change to "one commit" |
| 120 | Worker completion: "Radicle patch: `git push rad HEAD:refs/patches`" | Remove |
| 122 | Links: `--patch <patch-id>` | Remove patch linking from worker protocol |
| 124 | Plan link: `rad-plan link <plan-id> --patch <patch-id>` | Move to coordinator/completion section |
| 172 | "Patches ready for delegate merge" | Change to: "Patch ready for delegate merge (one per plan)" |
| 233 | Worker step: "push one patch" | Remove |
| 285 | Worker session: "writes Context COB + patch" | Change to "writes Context COB + commit" |
| 321 | Example: "commit, push patch, write Context COB" | Change to "commit, write Context COB" |
| 386 | "merge conflict when their patches are applied" | Change to "merge conflict when task branches are merged" |
| 396-411 | Gap 3 rework: patch revision model | Rewrite — rework is commit-based (amend or new commit), not patch revision |

### `agents/plan-manager.md` (minor — references to `/rad-dispatch`)

| Line(s) | Content | Action |
|---------|---------|--------|
| 42 | "User wants to dispatch tasks to workers (`/rad-dispatch`)" | Change to `/rad-orchestrate` |
| 254 | "When the user runs `/rad-dispatch <plan-id>`" | Change to `/rad-orchestrate` |
| 409 | "Each `/rad-dispatch` invocation is a snapshot" | Remove — `/rad-orchestrate` is a loop, not a snapshot |

### No changes needed (clean):
- `commands/rad-plan.md` — `--patch` flag is correct for plan-level linking ✅
- `skills/rad-plans/SKILL.md` — `rad-plan link --patch` is correct for plan-level linking ✅

---

## Stale Documentation: Reviewer References

The reviewer agent concept was part of the original design but has been **deferred**. The following files contain reviewer references that should be updated:

### `agents-cobs-worktrees.md` (major — 20+ references)

This is the primary design doc and has the most stale content:

| Line(s) | Content | Action |
|---------|---------|--------|
| 15, 18, 20 | COB Access Model table: "Reviewer can comment", "reviewer reads patch diffs" | Remove reviewer column/references |
| 47-62 | **Entire "Reviewer (new agent)" section** | Remove |
| 93-96 | Dispatch loop steps b-f: "Dispatch reviewer", "Reviewer writes assessment", PASS/FLAG/FAIL flow | Simplify to: worker completes → coordinator evaluates context → dispatch next |
| 128-155 | **Entire "Phase 4: Review" section** | Remove |
| 157 | Phase 5 trigger: "After review passes" | Change to: "After worker completes" |
| 172 | "reviewed" in completion criteria | Remove "and are reviewed" |
| 207-209 | Information flow diagram: REVIEWER box | Remove reviewer from diagram |
| 248-256 | **Implementation Step 3: `agents/reviewer.md`** | Remove entirely |
| 275 | Plugin registration: `agents/reviewer.md` | Remove from list |
| 332-333 | Session lifecycle example: REVIEW comments | Remove review output lines |
| 390-420 | **Gap 3: "Rework Lifecycle (after review failure)"** | Rewrite as rework-after-worker-failure (human-initiated, not reviewer-gated) |

### `CHANGELOG.md` (minor — 1 reference)

| Line | Content | Action |
|------|---------|--------|
| 22 | "covering coordinator, worker, and reviewer roles" | Change to "covering coordinator and worker roles" |

### No reviewer references in these files (clean):
- `agents/plan-manager.md` ✅
- `agents/worker.md` ✅
- `commands/rad-plan.md` ✅
- `skills/rad-plans/SKILL.md` ✅
- `skills/rad-contexts/SKILL.md` ✅
- `.pi/extensions/rad-context.ts` ✅
