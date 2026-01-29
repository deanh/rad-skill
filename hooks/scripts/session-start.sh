#!/bin/bash
# Session start hook for Radicle integration
# Detects if current directory is a Radicle repo and shows open issues count

# Check if we're in a Radicle repository
if ! rad . >/dev/null 2>&1; then
    # Not a Radicle repo, exit silently
    exit 0
fi

# Get the repository ID
RID=$(rad . 2>/dev/null)

# Count open issues
OPEN_ISSUES=$(rad issue list --state open 2>/dev/null | grep -c "^" || echo "0")

# Only output if there are open issues
if [ "$OPEN_ISSUES" -gt 0 ]; then
    echo "Radicle repository detected: $RID"
    echo "Open issues: $OPEN_ISSUES"
    echo ""
    echo "Use /rad-import <issue-id> to import an issue as tasks."
    echo "Use 'rad issue list' to see all open issues."
fi
