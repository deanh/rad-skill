# rad-plan CLI Reference

All commands accept **short-form IDs** (minimum 7 hex characters) for plans, tasks, issues, patches, and commits. Ambiguous prefixes produce a clear error.

## rad-plan open

Create a new plan:

```bash
rad-plan open "Plan title" --description "Description"
rad-plan open "Plan title" --description "Description" --labels "label1,label2"
```

## rad-plan list

```bash
rad-plan list
rad-plan list --status in-progress
rad-plan list --all  # Include archived
```

## rad-plan show

```bash
rad-plan show <plan-id>
rad-plan show <plan-id> --json
```

## rad-plan edit

```bash
rad-plan edit <plan-id> --title "New title"
rad-plan edit <plan-id> --description "New description"
rad-plan edit <plan-id> --title "New title" --description "Updated description"
```

## rad-plan status

```bash
rad-plan status <plan-id> draft
rad-plan status <plan-id> approved
rad-plan status <plan-id> in-progress
rad-plan status <plan-id> completed
rad-plan status <plan-id> archived
```

## rad-plan task add

```bash
rad-plan task add <plan-id> "Task subject" \
  --description "Details" \
  --estimate "4h" \
  --files "src/auth.ts,src/middleware.ts"
```

## rad-plan task edit

```bash
rad-plan task edit <plan-id> <task-id> --subject "Updated title"
rad-plan task edit <plan-id> <task-id> --description "New details"
rad-plan task edit <plan-id> <task-id> --estimate "6h"
rad-plan task edit <plan-id> <task-id> --files "src/client.rs,src/config.rs"
```

All flags are optional. Only provided fields are updated.

## rad-plan task link-commit

Link a task to its implementing commit (marks it done):

```bash
rad-plan task link-commit <plan-id> <task-id> --commit <commit-oid>
```

## rad-plan task list

```bash
rad-plan task list <plan-id>
```

## rad-plan task remove

```bash
rad-plan task remove <plan-id> <task-id>
```

## rad-plan task link

Link a task to a Radicle issue:

```bash
rad-plan task link <plan-id> <task-id> --issue <issue-id>
```

## rad-plan link

Link plan to issues/patches:

```bash
rad-plan link <plan-id> --issue <issue-id>
rad-plan link <plan-id> --patch <patch-id>
```

## rad-plan comment

```bash
rad-plan comment <plan-id> "Comment text"
rad-plan comment <plan-id> "Reply text" --reply-to <comment-id>
```

## rad-plan export

```bash
rad-plan export <plan-id> --format md
rad-plan export <plan-id> --format json
rad-plan export <plan-id> --format md --output plan.md
```

## Authorization

| Action | Who Can Do It |
|--------|--------------|
| Create plan | Any user |
| Edit plan | Author or delegate |
| Add/edit tasks | Author or delegate |
| Comment | Any user |
| Label/Assign | Delegates only |
