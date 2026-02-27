import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";

// --- Constants ---

const MAX_CONCURRENCY = 4;

// --- Types ---

interface PlanTask {
  id: string;
  subject: string;
  description: string;
  estimate: string;
  affectedFiles: string[];
  linkedCommit: string | null;
  blocked_by?: string[];
}

interface Plan {
  title: string;
  status: string;
  tasks: PlanTask[];
  relatedIssues: string[];
  relatedPatches: string[];
  thread: {
    comments: Record<string, {
      body: string;
      edits: Array<{ body: string }>;
    }>;
  };
}

interface PlanState {
  plan: Plan;
  completed: PlanTask[];
  inProgress: PlanTask[];
  ready: PlanTask[];
  blockedDep: PlanTask[];
  blockedFile: PlanTask[];
  allComplete: boolean;
  contextFeedback: ContextFeedback[];
}

interface ContextFeedback {
  contextId: string;
  taskId: string | null;
  constraints: string[];
  friction: string[];
  openItems: string[];
  learnings: { repo: string[]; code: Array<{ path: string; line: number; finding: string }> };
  filesTouched: string[];
}

interface WorkerResult {
  taskId: string;
  taskSubject: string;
  success: boolean;
  exitCode: number;
  stderr: string;
  worktreePath: string;
  turns: number;
  cost: number;
}

interface WorkerProgress {
  taskId: string;
  taskSubject: string;
  status: "starting" | "running" | "done" | "failed";
  turns: number;
  cost: number;
  currentTool: string | null;
  lastActivity: string | null;
  startTime: number;
}

interface AgentConfig {
  name: string;
  model?: string;
  tools?: string[];
  systemPrompt: string;
}

// --- State ---

interface OrchestratorState {
  isRadicleRepo: boolean;
  radPlanInstalled: boolean;
  radContextInstalled: boolean;
  repoId: string | null;
}

// --- Helpers ---

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}

function shortId(id: string): string {
  return id.slice(0, 7);
}

function getCommentBodies(plan: Plan): string[] {
  const bodies: string[] = [];
  for (const comment of Object.values(plan.thread?.comments ?? {})) {
    // Use the latest edit body
    const edits = comment.edits;
    if (edits && edits.length > 0) {
      bodies.push(edits[edits.length - 1].body);
    } else {
      bodies.push(comment.body);
    }
  }
  return bodies;
}

function findClaimedTaskIds(plan: Plan): Set<string> {
  const claimed = new Set<string>();
  for (const body of getCommentBodies(plan)) {
    const match = body.match(/^CLAIM task:(\S+)/);
    if (match) claimed.add(match[1]);
  }
  return claimed;
}

function findSignalFiles(plan: Plan): Map<string, string[]> {
  const signals = new Map<string, string[]>();
  for (const body of getCommentBodies(plan)) {
    const match = body.match(/^SIGNAL task:(\S+) files-added:(.+)/);
    if (match) {
      const existing = signals.get(match[1]) ?? [];
      existing.push(...match[2].split(",").map(f => f.trim()));
      signals.set(match[1], existing);
    }
  }
  return signals;
}

function getEffectiveFiles(task: PlanTask, signals: Map<string, string[]>): string[] {
  const base = task.affectedFiles ?? [];
  const extra = signals.get(shortId(task.id)) ?? signals.get(task.id) ?? [];
  return [...new Set([...base, ...extra])];
}

function filesOverlap(a: string[], b: string[]): boolean {
  const setA = new Set(a);
  return b.some(f => setA.has(f));
}

// --- Agent Loading ---

function loadAgentConfig(agentPath: string): AgentConfig | null {
  if (!fs.existsSync(agentPath)) return null;
  const content = fs.readFileSync(agentPath, "utf-8");
  const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);
  if (!frontmatter.name) return null;
  const tools = frontmatter.tools?.split(",").map((t: string) => t.trim()).filter(Boolean);
  return {
    name: frontmatter.name,
    model: frontmatter.model,
    tools: tools && tools.length > 0 ? tools : undefined,
    systemPrompt: body,
  };
}

function writePromptToTempFile(name: string, prompt: string): { dir: string; filePath: string } {
  const tmpDir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "pi-orchestrator-"));
  const filePath = path.join(tmpDir, `prompt-${name}.md`);
  fs.writeFileSync(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
  return { dir: tmpDir, filePath };
}

// --- Plan Analysis ---

async function loadPlan(pi: ExtensionAPI, planId: string): Promise<Plan | null> {
  const result = await pi.exec("rad-plan", ["show", planId, "--json"], { timeout: 10000 });
  if (result.code !== 0) return null;
  try {
    return JSON.parse(result.stdout.trim()) as Plan;
  } catch {
    return null;
  }
}

async function analyzePlan(pi: ExtensionAPI, planId: string): Promise<PlanState | null> {
  const plan = await loadPlan(pi, planId);
  if (!plan) return null;

  const claimed = findClaimedTaskIds(plan);
  const signals = findSignalFiles(plan);

  const completed: PlanTask[] = [];
  const inProgress: PlanTask[] = [];
  const ready: PlanTask[] = [];
  const blockedDep: PlanTask[] = [];
  const blockedFile: PlanTask[] = [];

  // First pass: categorize by completion and dependency
  const completedIds = new Set<string>();
  for (const task of plan.tasks) {
    if (task.linkedCommit) {
      completed.push(task);
      completedIds.add(task.id);
      completedIds.add(shortId(task.id));
    }
  }

  for (const task of plan.tasks) {
    if (task.linkedCommit) continue;

    // Check if claimed (in progress)
    if (claimed.has(shortId(task.id)) || claimed.has(task.id)) {
      inProgress.push(task);
      continue;
    }

    // Check dependencies
    const deps = task.blocked_by ?? [];
    const depsUnmet = deps.some(dep => !completedIds.has(dep) && !completedIds.has(shortId(dep)));
    if (depsUnmet) {
      blockedDep.push(task);
      continue;
    }

    // Check file conflicts with in-progress tasks
    const candidateFiles = getEffectiveFiles(task, signals);
    const hasConflict = inProgress.some(ip => {
      const ipFiles = getEffectiveFiles(ip, signals);
      return filesOverlap(candidateFiles, ipFiles);
    });

    if (hasConflict) {
      blockedFile.push(task);
    } else {
      ready.push(task);
    }
  }

  // Load context feedback
  const contextFeedback = await loadContextFeedback(pi, planId);

  return {
    plan,
    completed,
    inProgress,
    ready,
    blockedDep,
    blockedFile,
    allComplete: completed.length === plan.tasks.length,
    contextFeedback,
  };
}

// --- Context Feedback ---

async function loadContextFeedback(pi: ExtensionAPI, planId: string): Promise<ContextFeedback[]> {
  const whichResult = await pi.exec("which", ["rad-context"], { timeout: 3000 });
  if (whichResult.code !== 0) return [];

  const listResult = await pi.exec("rad-context", ["list"], { timeout: 10000 });
  if (listResult.code !== 0) return [];

  const contextIds = listResult.stdout.trim().split("\n")
    .map(line => line.match(/^([0-9a-f]{7,40})/)?.[1])
    .filter((id): id is string => !!id);

  const feedback: ContextFeedback[] = [];
  for (const contextId of contextIds) {
    const showResult = await pi.exec("rad-context", ["show", contextId, "--json"], { timeout: 5000 });
    if (showResult.code !== 0) continue;

    try {
      const ctx = JSON.parse(showResult.stdout.trim());
      const relatedPlans: string[] = ctx.relatedPlans ?? [];
      const isRelevant = relatedPlans.some(p => p.startsWith(planId) || planId.startsWith(p.slice(0, 7)));
      if (!isRelevant) continue;

      feedback.push({
        contextId,
        taskId: ctx.taskId ?? null,
        constraints: ctx.constraints ?? [],
        friction: ctx.friction ?? [],
        openItems: ctx.openItems ?? [],
        learnings: ctx.learnings ?? { repo: [], code: [] },
        filesTouched: ctx.filesTouched ?? [],
      });
    } catch {
      continue;
    }
  }
  return feedback;
}

// --- Worktree Lifecycle ---

async function createWorktree(pi: ExtensionAPI, cwd: string, taskId: string, slug: string): Promise<string> {
  const name = `worktree-${shortId(taskId)}-${slug}`;
  const worktreePath = path.resolve(cwd, "..", name);
  const branch = `task/${shortId(taskId)}`;
  const result = await pi.exec("git", ["worktree", "add", worktreePath, "-b", branch], { timeout: 15000 });
  if (result.code !== 0) {
    throw new Error(`Failed to create worktree: ${result.stderr}`);
  }
  return worktreePath;
}

async function removeWorktree(pi: ExtensionAPI, worktreePath: string): Promise<void> {
  await pi.exec("git", ["worktree", "remove", worktreePath, "--force"], { timeout: 15000 });
}

// --- Subagent Spawning ---

function spawnWorker(
  agent: AgentConfig,
  worktreePath: string,
  planId: string,
  task: PlanTask,
  onProgress?: (update: Partial<WorkerProgress>) => void,
  signal?: AbortSignal,
): Promise<WorkerResult> {
  return new Promise((resolve) => {
    const args: string[] = ["--mode", "json", "-p", "--no-session"];
    if (agent.model) args.push("--model", agent.model);
    if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));

    let tmpPromptDir: string | null = null;
    let tmpPromptPath: string | null = null;

    const result: WorkerResult = {
      taskId: task.id,
      taskSubject: task.subject,
      success: false,
      exitCode: 1,
      stderr: "",
      worktreePath,
      turns: 0,
      cost: 0,
    };

    try {
      if (agent.systemPrompt.trim()) {
        const tmp = writePromptToTempFile(agent.name, agent.systemPrompt);
        tmpPromptDir = tmp.dir;
        tmpPromptPath = tmp.filePath;
        args.push("--append-system-prompt", tmpPromptPath);
      }

      const taskPrompt = `Execute task ${shortId(task.id)} from plan ${shortId(planId)}. ` +
        `Read the plan with: rad-plan show ${shortId(planId)} --json`;
      args.push(taskPrompt);

      let wasAborted = false;
      const proc = spawn("pi", args, {
        cwd: worktreePath,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let buffer = "";

      const processLine = (line: string) => {
        if (!line.trim()) return;
        let event: any;
        try { event = JSON.parse(line); } catch { return; }

        // Track tool execution for live progress
        if (event.type === "tool_execution_start") {
          const toolName = event.toolName ?? "unknown";
          const toolArgs = event.args ?? {};
          let activity: string | null = null;

          // Extract meaningful info from tool args
          if (toolName === "bash" && toolArgs.command) {
            const cmd = toolArgs.command.split("\n")[0].slice(0, 60);
            activity = `$ ${cmd}${toolArgs.command.length > 60 ? "…" : ""}`;
          } else if (toolName === "read" && toolArgs.path) {
            activity = `reading ${toolArgs.path}`;
          } else if (toolName === "write" && toolArgs.path) {
            activity = `writing ${toolArgs.path}`;
          } else if (toolName === "edit" && toolArgs.path) {
            activity = `editing ${toolArgs.path}`;
          }

          onProgress?.({ currentTool: toolName, lastActivity: activity });
        }

        if (event.type === "tool_execution_end") {
          onProgress?.({ currentTool: null });
        }

        if (event.type === "message_end" && event.message?.role === "assistant") {
          result.turns++;
          const usage = event.message.usage;
          if (usage) {
            result.cost += usage.cost?.total || 0;
          }
          onProgress?.({ turns: result.turns, cost: result.cost, status: "running" });
        }

        // Capture thinking/text snippets for activity display
        if (event.type === "message_update" && event.message?.role === "assistant") {
          const content = event.assistantMessageEvent;
          if (content?.type === "thinking" && content.thinking) {
            const snippet = content.thinking.slice(-80).split("\n").pop()?.trim();
            if (snippet) onProgress?.({ lastActivity: `💭 ${snippet.slice(0, 60)}${snippet.length > 60 ? "…" : ""}` });
          } else if (content?.type === "text" && content.text) {
            const snippet = content.text.slice(-80).split("\n").pop()?.trim();
            if (snippet) onProgress?.({ lastActivity: snippet.slice(0, 60) + (snippet.length > 60 ? "…" : "") });
          }
        }
      };

      proc.stdout.on("data", (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
      });

      proc.stderr.on("data", (data: Buffer) => {
        result.stderr += data.toString();
      });

      proc.on("close", (code: number | null) => {
        if (buffer.trim()) processLine(buffer);
        result.exitCode = code ?? 1;
        result.success = code === 0 && !wasAborted;

        // Cleanup temp files
        if (tmpPromptPath) try { fs.unlinkSync(tmpPromptPath); } catch { /* ignore */ }
        if (tmpPromptDir) try { fs.rmdirSync(tmpPromptDir); } catch { /* ignore */ }

        resolve(result);
      });

      proc.on("error", () => {
        if (tmpPromptPath) try { fs.unlinkSync(tmpPromptPath); } catch { /* ignore */ }
        if (tmpPromptDir) try { fs.rmdirSync(tmpPromptDir); } catch { /* ignore */ }
        resolve(result);
      });

      if (signal) {
        const killProc = () => {
          wasAborted = true;
          proc.kill("SIGTERM");
          setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
        };
        if (signal.aborted) killProc();
        else signal.addEventListener("abort", killProc, { once: true });
      }
    } catch (err) {
      if (tmpPromptPath) try { fs.unlinkSync(tmpPromptPath); } catch { /* ignore */ }
      if (tmpPromptDir) try { fs.rmdirSync(tmpPromptDir); } catch { /* ignore */ }
      result.stderr = err instanceof Error ? err.message : String(err);
      resolve(result);
    }
  });
}

// --- Concurrency ---

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = new Array(limit).fill(null).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

// --- Formatting ---

function formatDispatchReport(state: PlanState): string {
  const total = state.plan.tasks.length;
  const lines: string[] = [];

  lines.push(`Dispatch: "${state.plan.title}"`);
  lines.push("═".repeat(50));
  lines.push(`Status: ${state.completed.length}/${total} completed | ${state.inProgress.length} in progress | ${state.ready.length} ready | ${state.blockedDep.length + state.blockedFile.length} blocked`);
  lines.push("");

  if (state.completed.length > 0) {
    lines.push("── Completed ──");
    for (const t of state.completed) {
      lines.push(`  ✓ ${shortId(t.id)}: "${t.subject}" — ${shortId(t.linkedCommit!)}`);
    }
    lines.push("");
  }

  if (state.inProgress.length > 0) {
    lines.push("── In Progress ──");
    for (const t of state.inProgress) {
      lines.push(`  ◉ ${shortId(t.id)}: "${t.subject}"`);
      if (t.affectedFiles?.length) lines.push(`    Files: ${t.affectedFiles.join(", ")}`);
    }
    lines.push("");
  }

  if (state.ready.length > 0) {
    lines.push("── Ready for Dispatch ──");
    for (const t of state.ready) {
      lines.push(`  ○ ${shortId(t.id)}: "${t.subject}"`);
      if (t.affectedFiles?.length) lines.push(`    Files: ${t.affectedFiles.join(", ")}`);
    }
    lines.push("");
  }

  if (state.blockedDep.length > 0 || state.blockedFile.length > 0) {
    lines.push("── Blocked ──");
    for (const t of state.blockedDep) {
      const deps = (t.blocked_by ?? []).map(d => shortId(d)).join(", ");
      lines.push(`  ✕ ${shortId(t.id)}: "${t.subject}" — waiting on: ${deps}`);
    }
    for (const t of state.blockedFile) {
      lines.push(`  ✕ ${shortId(t.id)}: "${t.subject}" — file conflict with in-progress task`);
    }
    lines.push("");
  }

  if (state.contextFeedback.length > 0) {
    lines.push("── Context Feedback ──");
    for (const fb of state.contextFeedback) {
      const from = fb.taskId ? `task ${shortId(fb.taskId)}` : shortId(fb.contextId);
      for (const c of fb.constraints) {
        lines.push(`  ⚠ Constraint (${from}): ${c}`);
      }
      for (const f of fb.friction) {
        lines.push(`  ℹ Friction (${from}): ${f}`);
      }
      for (const o of fb.openItems) {
        lines.push(`  ℹ Open item (${from}): ${o}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatWorkerDashboard(
  planTitle: string,
  workers: Map<string, WorkerProgress>,
  completedTasks: PlanTask[],
  totalTasks: number,
): string[] {
  const lines: string[] = [];
  const now = Date.now();

  const doneCount = completedTasks.length + [...workers.values()].filter(w => w.status === "done").length;
  const activeCount = [...workers.values()].filter(w => w.status === "running" || w.status === "starting").length;

  lines.push(`⚙ Orchestrating: "${planTitle}" [${doneCount}/${totalTasks} done, ${activeCount} active]`);
  lines.push("─".repeat(50));

  // Show previously completed tasks (brief)
  for (const t of completedTasks) {
    lines.push(`  ✓ ${shortId(t.id)}: ${t.subject} → ${shortId(t.linkedCommit!)}`);
  }

  // Show active workers
  for (const [, w] of workers) {
    const elapsed = Math.round((now - w.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const time = mins > 0 ? `${mins}m${secs}s` : `${secs}s`;

    if (w.status === "starting") {
      lines.push(`  ⏳ ${shortId(w.taskId)}: "${w.taskSubject}" — starting...`);
    } else if (w.status === "running") {
      const tool = w.currentTool ? ` [${w.currentTool}]` : "";
      const activity = w.lastActivity ? ` ${w.lastActivity}` : "";
      lines.push(`  ◉ ${shortId(w.taskId)}: "${w.taskSubject}" — turn ${w.turns}, ${time}${tool}`);
      if (activity) {
        lines.push(`    └─${activity}`);
      }
    } else if (w.status === "done") {
      const cost = w.cost > 0 ? ` ($${w.cost.toFixed(4)})` : "";
      lines.push(`  ✓ ${shortId(w.taskId)}: "${w.taskSubject}" — ${w.turns} turns, ${time}${cost}`);
    } else if (w.status === "failed") {
      lines.push(`  ✗ ${shortId(w.taskId)}: "${w.taskSubject}" — failed after ${w.turns} turns, ${time}`);
    }
  }

  return lines;
}

function formatWorkerResults(results: WorkerResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    const icon = r.success ? "✓" : "✗";
    const cost = r.cost > 0 ? ` ($${r.cost.toFixed(4)})` : "";
    lines.push(`  ${icon} ${shortId(r.taskId)}: "${r.taskSubject}" — ${r.turns} turns${cost}`);
    if (!r.success && r.stderr) {
      const preview = r.stderr.split("\n")[0].slice(0, 100);
      lines.push(`    Error: ${preview}`);
    }
  }
  return lines.join("\n");
}

// --- Completion ---

async function completePlan(
  pi: ExtensionAPI,
  planId: string,
  state: PlanState,
  worktreePaths: string[],
): Promise<{ patchId: string | null }> {
  // Merge task branches into a plan branch
  const planBranch = `plan/${shortId(planId)}`;
  await pi.exec("git", ["checkout", "-b", planBranch], { timeout: 10000 });

  for (const task of state.completed) {
    const taskBranch = `task/${shortId(task.id)}`;
    const mergeResult = await pi.exec("git", [
      "merge", taskBranch, "--no-ff",
      "-m", `Merge task ${shortId(task.id)}: ${task.subject}`,
    ], { timeout: 30000 });

    if (mergeResult.code !== 0) {
      // Try to abort the merge and report
      await pi.exec("git", ["merge", "--abort"], { timeout: 5000 });
      throw new Error(`Merge conflict on task ${shortId(task.id)}: ${mergeResult.stderr}`);
    }
  }

  // Push the Radicle patch
  const pushResult = await pi.exec("git", ["push", "rad", "HEAD:refs/patches"], { timeout: 30000 });
  const pushOutput = (pushResult.stdout + "\n" + pushResult.stderr).trim();
  const patchIdMatch = pushOutput.match(/([0-9a-f]{40})/);
  const patchId = patchIdMatch?.[1] ?? null;

  if (patchId) {
    await pi.exec("rad-plan", ["link", planId, "--patch", patchId], { timeout: 10000 });
  }

  // Close plan
  await pi.exec("rad-plan", ["status", planId, "completed"], { timeout: 10000 });

  // Close linked issues
  for (const issueId of state.plan.relatedIssues) {
    await pi.exec("rad", ["issue", "state", issueId, "--closed"], { timeout: 10000 });
  }

  // Clean up worktrees
  for (const wt of worktreePaths) {
    await removeWorktree(pi, wt);
  }

  // Announce
  await pi.exec("rad", ["sync", "--announce"], { timeout: 15000 });

  return { patchId };
}

// --- Extension ---

export default function (pi: ExtensionAPI) {
  const state: OrchestratorState = {
    isRadicleRepo: false,
    radPlanInstalled: false,
    radContextInstalled: false,
    repoId: null,
  };

  // Detect capabilities at session start
  pi.on("session_start", async (_event, ctx) => {
    const radResult = await pi.exec("rad", ["."], { timeout: 5000 });
    if (radResult.code !== 0) return;
    state.isRadicleRepo = true;
    state.repoId = radResult.stdout.trim();

    const planResult = await pi.exec("which", ["rad-plan"], { timeout: 3000 });
    state.radPlanInstalled = planResult.code === 0;

    const ctxResult = await pi.exec("which", ["rad-context"], { timeout: 3000 });
    state.radContextInstalled = ctxResult.code === 0;

    if (state.radPlanInstalled) {
      ctx.ui.setStatus("rad-orchestrator", "rad-plan ✓");
    }
  });

  // Register the /rad-orchestrate command
  pi.registerCommand("rad-orchestrate", {
    description: "Orchestrate multi-agent execution of a Plan COB across worktrees",
    handler: async (args, ctx) => {
      if (!state.isRadicleRepo) {
        ctx.ui.notify("Not a Radicle repository", "error");
        return;
      }
      if (!state.radPlanInstalled) {
        ctx.ui.notify("rad-plan not installed. Install from: rad clone rad:z4L8L9ctRYn2bcPuUT4GRz7sggG1v", "error");
        return;
      }

      const planId = args?.trim();
      if (!planId) {
        ctx.ui.notify("Usage: /rad-orchestrate <plan-id>", "error");
        return;
      }

      // Find the worker agent definition
      const agentDir = path.resolve(ctx.cwd, ".pi", "agents");
      const workerPath = path.join(agentDir, "rad-worker.md");
      const workerAgent = loadAgentConfig(workerPath);
      if (!workerAgent) {
        ctx.ui.notify(`Worker agent not found at ${workerPath}`, "error");
        return;
      }

      // Phase 1: Load and validate plan
      const initialState = await analyzePlan(pi, planId);
      if (!initialState) {
        ctx.ui.notify(`Failed to load plan ${planId}`, "error");
        return;
      }

      if (initialState.plan.status !== "approved" && initialState.plan.status !== "in-progress") {
        const proceed = await ctx.ui.confirm(
          "Plan not approved",
          `Plan "${initialState.plan.title}" has status "${initialState.plan.status}". Approve and proceed?`,
        );
        if (!proceed) return;
        await pi.exec("rad-plan", ["status", planId, "approved"], { timeout: 10000 });
      }

      // Track all worktree paths for cleanup
      const allWorktreePaths: string[] = [];

      // Live progress tracking
      const workerProgress = new Map<string, WorkerProgress>();
      let dashboardInterval: ReturnType<typeof setInterval> | null = null;

      const updateDashboard = (planState: PlanState) => {
        const lines = formatWorkerDashboard(
          planState.plan.title,
          workerProgress,
          planState.completed,
          planState.plan.tasks.length,
        );
        ctx.ui.setWidget("rad-orchestrator", lines);

        // Also update footer status
        const active = [...workerProgress.values()].filter(w => w.status === "running" || w.status === "starting").length;
        const done = planState.completed.length + [...workerProgress.values()].filter(w => w.status === "done").length;
        const total = planState.plan.tasks.length;
        ctx.ui.setStatus("rad-orchestrator", `⚙ ${done}/${total} tasks [${active} active]`);
      };

      const cleanupDashboard = () => {
        if (dashboardInterval) {
          clearInterval(dashboardInterval);
          dashboardInterval = null;
        }
        ctx.ui.setWidget("rad-orchestrator", undefined);
        ctx.ui.setStatus("rad-orchestrator", undefined);
      };

      // Phase 2: Dispatch loop
      let currentPlanState = initialState;
      while (true) {
        const planState = await analyzePlan(pi, planId);
        if (!planState) {
          ctx.ui.notify("Failed to reload plan state", "error");
          break;
        }
        currentPlanState = planState;

        // Show dispatch report as widget
        updateDashboard(planState);
        ctx.ui.notify(formatDispatchReport(planState), "info");

        if (planState.allComplete) {
          // Phase 3: Completion
          cleanupDashboard();
          const proceed = await ctx.ui.confirm(
            "All tasks complete",
            `Merge ${planState.completed.length} task branches, create patch, and close the plan?`,
          );
          if (!proceed) break;

          ctx.ui.setStatus("rad-orchestrator", "⚙ merging and creating patch…");
          try {
            const { patchId } = await completePlan(pi, planId, planState, allWorktreePaths);
            ctx.ui.setStatus("rad-orchestrator", undefined);
            if (patchId) {
              ctx.ui.notify(`✓ Patch created: ${shortId(patchId)}`, "info");
            }
            ctx.ui.notify("✓ Plan completed and announced", "info");
          } catch (err) {
            ctx.ui.setStatus("rad-orchestrator", undefined);
            const msg = err instanceof Error ? err.message : String(err);
            ctx.ui.notify(`Completion failed: ${msg}`, "error");
          }
          break;
        }

        if (planState.ready.length === 0 && planState.inProgress.length === 0) {
          cleanupDashboard();
          ctx.ui.notify("No tasks ready and none in progress. Plan may be stuck.", "warning");
          break;
        }

        if (planState.ready.length === 0) {
          cleanupDashboard();
          ctx.ui.notify(`Waiting for ${planState.inProgress.length} in-progress task(s) to complete...`, "info");
          ctx.ui.notify("Re-run /rad-orchestrate after in-progress tasks complete.", "info");
          break;
        }

        // Dispatch prompt
        const options = [
          `Dispatch all (${planState.ready.length})`,
          "Dispatch one",
          "Stop orchestration",
        ];
        const choice = await ctx.ui.select(
          `${planState.ready.length} task(s) ready for dispatch`,
          options,
        );

        if (!choice || choice === "Stop orchestration") {
          cleanupDashboard();
          break;
        }

        const tasksToDispatch = choice === "Dispatch one"
          ? [planState.ready[0]]
          : planState.ready;

        // Create worktrees and spawn workers
        ctx.ui.notify(`Creating ${tasksToDispatch.length} worktree(s)...`, "info");

        const workerTasks: Array<{ task: PlanTask; worktreePath: string }> = [];
        for (const task of tasksToDispatch) {
          try {
            const wt = await createWorktree(pi, ctx.cwd, task.id, slugify(task.subject));
            workerTasks.push({ task, worktreePath: wt });
            allWorktreePaths.push(wt);

            // Initialize progress tracking
            workerProgress.set(task.id, {
              taskId: task.id,
              taskSubject: task.subject,
              status: "starting",
              turns: 0,
              cost: 0,
              currentTool: null,
              lastActivity: null,
              startTime: Date.now(),
            });

            ctx.ui.notify(`  ✓ ${shortId(task.id)}: ${path.basename(wt)}`, "info");
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ctx.ui.notify(`  ✗ ${shortId(task.id)}: ${msg}`, "error");
          }
        }

        if (workerTasks.length === 0) {
          cleanupDashboard();
          ctx.ui.notify("No worktrees created. Stopping.", "error");
          break;
        }

        // Start periodic dashboard refresh (elapsed time updates)
        updateDashboard(planState);
        dashboardInterval = setInterval(() => updateDashboard(currentPlanState), 1000);

        // Spawn workers in parallel with live progress
        ctx.ui.notify(`Dispatching ${workerTasks.length} worker(s)…`, "info");

        const results = await mapWithConcurrency(
          workerTasks,
          MAX_CONCURRENCY,
          async ({ task, worktreePath }) => {
            const progress = workerProgress.get(task.id)!;
            progress.status = "running";
            updateDashboard(currentPlanState);

            const result = await spawnWorker(
              workerAgent,
              worktreePath,
              planId,
              task,
              (update) => {
                Object.assign(progress, update);
                updateDashboard(currentPlanState);
              },
            );

            // Update final progress state
            progress.status = result.success ? "done" : "failed";
            progress.turns = result.turns;
            progress.cost = result.cost;
            progress.currentTool = null;
            progress.lastActivity = result.success ? "completed" : `exit code ${result.exitCode}`;
            updateDashboard(currentPlanState);

            return result;
          },
        );

        // Stop periodic refresh
        if (dashboardInterval) {
          clearInterval(dashboardInterval);
          dashboardInterval = null;
        }

        // Report results
        const succeeded = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        ctx.ui.notify(`\nBatch complete: ${succeeded.length} succeeded, ${failed.length} failed`, "info");
        if (failed.length > 0) {
          ctx.ui.notify(formatWorkerResults(failed), "error");

          for (const f of failed) {
            const action = await ctx.ui.select(
              `Task ${shortId(f.taskId)} failed. Action?`,
              ["Skip (continue with next batch)", "Stop orchestration"],
            );
            if (action === "Stop orchestration") {
              cleanupDashboard();
              ctx.ui.notify("Orchestration stopped by user.", "info");
              return;
            }
          }
        }

        // Clear finished workers from progress (they'll show as completed in next plan analysis)
        for (const r of results) {
          workerProgress.delete(r.taskId);
        }

        // Evaluate context feedback
        if (state.radContextInstalled && succeeded.length > 0) {
          const freshState = await analyzePlan(pi, planId);
          if (freshState) {
            currentPlanState = freshState;
            if (freshState.contextFeedback.length > 0) {
              const remaining = [...freshState.ready, ...freshState.blockedDep, ...freshState.blockedFile];
              for (const fb of freshState.contextFeedback) {
                for (const constraint of fb.constraints) {
                  const conflicting = remaining.filter(t =>
                    t.description?.toLowerCase().includes(constraint.toLowerCase().split(" ").slice(0, 3).join(" ")),
                  );
                  if (conflicting.length > 0) {
                    ctx.ui.notify(
                      `⚠ Constraint from ${fb.taskId ? "task " + shortId(fb.taskId) : shortId(fb.contextId)}: "${constraint}"` +
                      `\n  May affect: ${conflicting.map(t => shortId(t.id)).join(", ")}`,
                      "warning",
                    );
                  }
                }

                for (const item of fb.openItems) {
                  ctx.ui.notify(
                    `ℹ Open item (${fb.taskId ? shortId(fb.taskId) : shortId(fb.contextId)}): ${item}`,
                    "info",
                  );
                }
              }
            }
          }
        }

        // Loop continues — next iteration will re-analyze and show updated state
      }

      cleanupDashboard();
    },
  });
}
