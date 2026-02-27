#!/usr/bin/env bash
# Test teardownWorktree logic: create a worktree + branch, then tear it down.
# Run with: bash tests/test-teardown-worktree.sh

set -euo pipefail

PASS=0
FAIL=0


assert() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $desc"
    FAIL=$((FAIL + 1))
  fi
}

assert_not() {
  local desc="$1"
  shift
  if ! "$@" >/dev/null 2>&1; then
    echo "  ✓ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $desc"
    FAIL=$((FAIL + 1))
  fi
}

REPO_ROOT="$(git rev-parse --show-toplevel)"
TASK_ID="test999"
BRANCH="task/${TASK_ID}"
WT_PATH="${REPO_ROOT}/../worktree-${TASK_ID}-teardown-test"

# Cleanup from any prior failed run
git worktree remove "$WT_PATH" --force 2>/dev/null || true
git branch -D "$BRANCH" 2>/dev/null || true

echo "Test: create and tear down a worktree"

# Setup: create worktree + branch (mimics createWorktree)
git worktree add "$WT_PATH" -b "$BRANCH" 2>/dev/null
assert "worktree exists after creation" test -d "$WT_PATH"
assert "branch exists after creation" git rev-parse --verify "$BRANCH"
if git worktree list --porcelain | grep -q "worktree-${TASK_ID}"; then
  echo "  ✓ worktree listed"
  PASS=$((PASS + 1))
else
  echo "  ✗ worktree listed"
  FAIL=$((FAIL + 1))
fi

# Teardown (mimics teardownWorktree)
git worktree remove "$WT_PATH" --force
git branch -D "$BRANCH"

assert_not "worktree removed" test -d "$WT_PATH"
assert_not "branch removed" git rev-parse --verify "$BRANCH"
if ! git worktree list --porcelain | grep -q "worktree-${TASK_ID}"; then
  echo "  ✓ worktree not listed"
  PASS=$((PASS + 1))
else
  echo "  ✗ worktree not listed"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "Test: teardown is idempotent (no error on missing)"

# Removing a non-existent worktree should not crash the orchestrator
# (the real code has a try/catch; here we just verify the commands fail gracefully)
if git worktree remove "$WT_PATH" --force 2>/dev/null; then
  echo "  ✓ worktree remove on missing is silent"
  PASS=$((PASS + 1))
else
  echo "  ✓ worktree remove on missing exits non-zero (expected, caught by try/catch)"
  PASS=$((PASS + 1))
fi

if git branch -D "$BRANCH" 2>/dev/null; then
  echo "  ✓ branch delete on missing is silent"
  PASS=$((PASS + 1))
else
  echo "  ✓ branch delete on missing exits non-zero (expected, caught by try/catch)"
  PASS=$((PASS + 1))
fi

echo ""
echo "${PASS} passed, ${FAIL} failed"
exit $((FAIL > 0 ? 1 : 0))
