#!/bin/bash
# Session start hook for rad-core
# Detects Radicle repo and shows basic status

# Check if we're in a Radicle repository
if ! rad . >/dev/null 2>&1; then
    exit 0
fi

# Get the repository ID
RID=$(rad . 2>/dev/null)

# Count open issues
OPEN_ISSUES=$(rad issue list --state open 2>/dev/null | grep -c "^" || echo "0")

# Output repository info
echo "Radicle repository detected: $RID"

if [ "$OPEN_ISSUES" -gt 0 ]; then
    echo "Open issues: $OPEN_ISSUES"
fi

echo ""

if [ "$OPEN_ISSUES" -gt 0 ]; then
    echo "Use 'rad issue list' to see open issues."
    echo "Use /rad-issue to create a new issue."
fi

# Hint about radicle-extras if COB CLIs are installed
if command -v rad-plan >/dev/null 2>&1 || command -v rad-context >/dev/null 2>&1; then
    echo ""
    echo "COB CLIs detected. Enable radicle-extras plugin for /rad-import, /rad-sync, /rad-status, /rad-context."
fi
