#!/bin/bash
# Session start hook for rad-cobs
# Detects Plan and Context CLI availability and shows counts

# Check if we're in a Radicle repository
if ! rad . >/dev/null 2>&1; then
    exit 0
fi

RID=$(rad . 2>/dev/null)

# Check for rad-plan CLI
if command -v rad-plan >/dev/null 2>&1; then
    ACTIVE_PLANS=$(rad-plan list 2>/dev/null | grep -E '\[(draft|approved|in-progress)\]' | wc -l | tr -d ' ' || echo "0")
    if [ "$ACTIVE_PLANS" -gt 0 ]; then
        echo "Active plans: $ACTIVE_PLANS"
    fi
else
    echo "Optional: Install rad-plan for Plan COB support."
    echo "  rad clone rad:z4L8L9ctRYn2bcPuUT4GRz7sggG1v && cargo install --path radicle-plan-cob"
fi

# Check for rad-context CLI
if command -v rad-context >/dev/null 2>&1; then
    CONTEXT_COUNT=$(rad-context list 2>/dev/null | grep -c "^" || echo "0")
    if [ "$CONTEXT_COUNT" -gt 0 ]; then
        echo "Session contexts: $CONTEXT_COUNT"
    fi
else
    echo "Optional: Install rad-context for Context COB support."
    echo "  rad clone rad:z2qBBbhVCfMiFEWN55oXKTPmKkrwY && cargo install --path radicle-context-cob"
fi

echo ""
echo "Use /rad-status for a full overview."
echo "Use /rad-import <issue-id> to import an issue as tasks."
