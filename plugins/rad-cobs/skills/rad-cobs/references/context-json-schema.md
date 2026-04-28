# Context COB JSON Schema

JSON format for `rad-context create --json`:

```json
{
  "title": "Implement auth flow",
  "description": "Session to add OAuth support",
  "approach": "Used passport.js for OAuth, rejected manual token handling",
  "constraints": ["Assumes Redis is available for session storage"],
  "learnings": {
    "repo": ["Uses conventional commits", "Error types follow thiserror pattern"],
    "code": [
      {
        "path": "src/auth.rs",
        "line": 42,
        "finding": "Auth middleware expects Request to carry session state"
      }
    ]
  },
  "friction": ["Type errors with async middleware closures"],
  "openItems": ["Refresh token rotation not implemented"],
  "filesTouched": ["src/auth.rs", "src/middleware.rs"],
  "verification": [
    {"check": "cargo test", "result": "pass", "note": "all tests passed"},
    {"check": "cargo clippy", "result": "pass"}
  ],
  "taskId": "task-a1b2"
}
```

## Field Notes

- JSON uses **camelCase**: `openItems`, `filesTouched`, `taskId`
- **Required**: `title`, `description`, `approach`
- **Optional**: `verification`, `taskId` — omit when not applicable
- `learnings.repo`: Repository-level patterns and conventions (string[])
- `learnings.code`: File-specific findings with `path`, optional `line`/`endLine`, and `finding`
- `verification.result`: One of `"pass"`, `"fail"`, or `"skip"` (lowercase)
- `verification.note`: Optional details about the outcome
