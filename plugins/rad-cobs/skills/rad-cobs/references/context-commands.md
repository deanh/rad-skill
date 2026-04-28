# rad-context CLI Reference

All commands accept **short-form IDs** (minimum 7 hex characters).

## rad-context create

`filesTouched` is auto-populated from the HEAD commit by default. Use `--no-auto-files` to disable this and rely only on explicitly provided files.

Use `--auto-link-commits <ref>` to automatically link all commits between `<ref>` (exclusive) and HEAD (inclusive).

### Create from flags

```bash
rad-context create "Session title" \
  --description "Free-form description" \
  --approach "What was tried and why" \
  --constraint "Assumes X remains true" \
  --friction "Type errors with async closures" \
  --open-item "Refresh token rotation not implemented" \
  --file src/auth.rs --file src/middleware.rs \
  --task <plan-task-id>
```

### Create from JSON

```bash
echo '<json>' | rad-context create --json
```

### JSON Validation

The `--json` input is strict:
- **Unknown fields are rejected** with an error listing all valid field names
- **`title`, `description`, and `approach` are required** — empty values produce a hard error
- Agents can self-correct from the error messages

## rad-context list

```bash
rad-context list
```

Shows all contexts with IDs, titles, and link counts.

## rad-context show

```bash
rad-context show <context-id>
rad-context show <context-id> --json
```

## rad-context link

```bash
rad-context link <context-id> --commit <sha>
rad-context link <context-id> --issue <issue-id>
rad-context link <context-id> --patch <patch-id>
rad-context link <context-id> --plan <plan-id>
```

## rad-context unlink

```bash
rad-context unlink <context-id> --commit <sha>
rad-context unlink <context-id> --issue <issue-id>
```
