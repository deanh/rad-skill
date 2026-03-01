#!/bin/bash
# Session start hook for Radicle integration
# Detects if current directory is a Radicle repo and shows open issues/plans count

# Check if we're in a Radicle repository
if ! rad . >/dev/null 2>&1; then
    # Not a Radicle repo, exit silently
    exit 0
fi

# Get the repository ID
RID=$(rad . 2>/dev/null)

# Count open issues
OPEN_ISSUES=$(rad issue list --state open 2>/dev/null | grep -c "^" || echo "0")

# Check for rad-plan CLI
RAD_PLAN_INSTALLED=false
ACTIVE_PLANS=0
if command -v rad-plan >/dev/null 2>&1; then
    RAD_PLAN_INSTALLED=true
    # Count plans that are not archived
    ACTIVE_PLANS=$(rad-plan list 2>/dev/null | grep -E '\[(draft|approved|in-progress)\]' | wc -l | tr -d ' ' || echo "0")
fi

# Check for rad-context CLI
RAD_CONTEXT_INSTALLED=false
CONTEXT_COUNT=0
if command -v rad-context >/dev/null 2>&1; then
    RAD_CONTEXT_INSTALLED=true
    CONTEXT_COUNT=$(rad-context list 2>/dev/null | grep -c "^" || echo "0")
fi

# Output repository info
echo "Radicle repository detected: $RID"

if [ "$OPEN_ISSUES" -gt 0 ]; then
    echo "Open issues: $OPEN_ISSUES"
fi

if [ "$RAD_PLAN_INSTALLED" = true ] && [ "$ACTIVE_PLANS" -gt 0 ]; then
    echo "Active plans: $ACTIVE_PLANS"
fi

if [ "$RAD_CONTEXT_INSTALLED" = true ] && [ "$CONTEXT_COUNT" -gt 0 ]; then
    echo "Session contexts: $CONTEXT_COUNT"
fi

echo ""

echo "Use /rad-status for a full overview."

if [ "$OPEN_ISSUES" -gt 0 ]; then
    echo "Use /rad-import <issue-id> to import an issue as tasks."
fi

if [ "$RAD_PLAN_INSTALLED" = true ] && [ "$ACTIVE_PLANS" -gt 0 ]; then
    echo "Use 'rad-plan list' to see active plans."
fi

if [ "$RAD_CONTEXT_INSTALLED" = true ] && [ "$CONTEXT_COUNT" -gt 0 ]; then
    echo "Use /rad-context list to see session contexts."
fi

if [ "$RAD_PLAN_INSTALLED" = false ]; then
    echo "Optional: Install rad-plan for Plan COB support (saved implementation plans)."
    echo "  rad clone rad:z4L8L9ctRYn2bcPuUT4GRz7sggG1v && cargo install --path radicle-plan-cob"
fi

if [ "$RAD_CONTEXT_INSTALLED" = false ]; then
    echo "Optional: Install rad-context for Context COB support (session observations)."
    echo "  rad clone rad:z2qBBbhVCfMiFEWN55oXKTPmKkrwY && cargo install --path radicle-context-cob"
fi
