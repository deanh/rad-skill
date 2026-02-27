/**
 * Test writeFailureLog: creates a log file in /tmp with expected content.
 * Run with: node tests/test-failure-log.mjs
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// --- Inline the function under test ---

function shortId(id) {
  return id.slice(0, 7);
}

function writeFailureLog(planId, result) {
  const dir = path.join(os.tmpdir(), "rad-orchestrator", shortId(planId));
  fs.mkdirSync(dir, { recursive: true });
  const logPath = path.join(dir, `${shortId(result.taskId)}.log`);
  const lines = [
    `Task: ${result.taskId}`,
    `Subject: ${result.taskSubject}`,
    `Exit code: ${result.exitCode}`,
    `Turns: ${result.turns}`,
    `Cost: ${result.cost > 0 ? `$${result.cost.toFixed(4)}` : "n/a"}`,
    `Worktree: ${result.worktreePath}`,
    `Timestamp: ${new Date().toISOString()}`,
    "",
    "--- stderr ---",
    result.stderr || "(empty)",
  ];
  fs.writeFileSync(logPath, lines.join("\n"), "utf-8");
  return logPath;
}

// --- Tests ---

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

// Test 1: Basic log creation
console.log("Test: writeFailureLog creates file with correct content");
{
  const planId = "aaa1111222233334444555566667777888899990000";
  const result = {
    taskId: "bbb1111222233334444555566667777888899990000",
    taskSubject: "Do something important",
    success: false,
    exitCode: 1,
    stderr: "Error: model not found\nsome detail\n",
    worktreePath: "/tmp/fake-worktree",
    turns: 0,
    cost: 0,
  };

  const logPath = writeFailureLog(planId, result);
  assert(fs.existsSync(logPath), "log file exists");

  const content = fs.readFileSync(logPath, "utf-8");
  assert(content.includes("Task: bbb1111"), "contains task ID");
  assert(content.includes("Subject: Do something important"), "contains subject");
  assert(content.includes("Exit code: 1"), "contains exit code");
  assert(content.includes("Turns: 0"), "contains turns");
  assert(content.includes("Cost: n/a"), "contains cost (n/a for zero)");
  assert(content.includes("Worktree: /tmp/fake-worktree"), "contains worktree path");
  assert(content.includes("--- stderr ---"), "contains stderr header");
  assert(content.includes("Error: model not found"), "contains stderr content");

  assert(logPath.includes(path.join("rad-orchestrator", "aaa1111")), "path uses plan short ID");
  assert(logPath.endsWith("bbb1111.log"), "filename uses task short ID");

  // Cleanup
  fs.rmSync(path.dirname(logPath), { recursive: true });
}

// Test 2: Empty stderr
console.log("Test: writeFailureLog handles empty stderr");
{
  const planId = "ccc1111222233334444555566667777888899990000";
  const result = {
    taskId: "ddd1111222233334444555566667777888899990000",
    taskSubject: "Another task",
    success: false,
    exitCode: 137,
    stderr: "",
    worktreePath: "/tmp/fake-worktree-2",
    turns: 3,
    cost: 0.0512,
  };

  const logPath = writeFailureLog(planId, result);
  const content = fs.readFileSync(logPath, "utf-8");

  assert(content.includes("Exit code: 137"), "contains signal exit code");
  assert(content.includes("Turns: 3"), "contains non-zero turns");
  assert(content.includes("Cost: $0.0512"), "contains formatted cost");
  assert(content.includes("(empty)"), "empty stderr shows placeholder");

  // Cleanup
  fs.rmSync(path.dirname(logPath), { recursive: true });
}

// Test 3: Overwrite on repeated failure
console.log("Test: writeFailureLog overwrites on retry");
{
  const planId = "eee1111222233334444555566667777888899990000";
  const taskId = "fff1111222233334444555566667777888899990000";

  writeFailureLog(planId, {
    taskId, taskSubject: "Flaky task", success: false,
    exitCode: 1, stderr: "first failure", worktreePath: "/tmp/wt", turns: 0, cost: 0,
  });

  const logPath = writeFailureLog(planId, {
    taskId, taskSubject: "Flaky task", success: false,
    exitCode: 2, stderr: "second failure", worktreePath: "/tmp/wt", turns: 1, cost: 0.01,
  });

  const content = fs.readFileSync(logPath, "utf-8");
  assert(content.includes("Exit code: 2"), "second write overwrites first");
  assert(content.includes("second failure"), "contains latest stderr");
  assert(!content.includes("first failure"), "does not contain old stderr");

  // Cleanup
  fs.rmSync(path.dirname(logPath), { recursive: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
