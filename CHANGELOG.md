# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Update all skill files for `rad-plan` v0.2.0: `task start`/`task complete` replaced with `task link-commit`, CLAIM comment convention for in-progress signaling, correct JSON field names (`affectedFiles`, `linkedCommit`), short-form ID support
- Update `rad-context` docs for upstream CLI changes: `verification` field, `taskId` field, JSON validation, short-form IDs, `--no-auto-files` and `--auto-link-commits` flags

## [0.6.0] - 2026-02-24

### Added

- Worker agent (`agents/worker.md`) for executing Plan COB tasks in isolated worktrees — one commit, one patch, one Context COB per task
- Plan-manager dispatch workflow for identifying tasks ready for parallel execution across worktrees
- `/rad-dispatch` command for analyzing Plan COBs and outputting dispatch instructions
- Multi-agent coordination design doc (`agents-cobs-worktrees.md`) covering coordinator, worker, and reviewer roles
- SIGNAL comment convention for workers to report file scope changes mid-execution
- CLAIM comment convention for task assignment in the absence of atomic status

### Changed

- Plugin version bumped to 0.6.0
- Plan-manager agent expanded with dispatch analysis and context feedback evaluation workflows

## [0.5.0] - 2026-02-13

### Added

- pi extension (`.pi/extensions/rad-context.ts`) for rad-context lifecycle — hooks into compaction events to auto-create Context COBs via side-channel LLM call
- pi `/rad-context` command with list, show, and create subcommands
- pi settings (`.pi/settings.json`) pointing at shared skills directory
- SessionStart hook matcher for Radicle repository detection

### Changed

- Plugin version bumped to 0.5.0
- Simplified `marketplace.json` to minimal form — `plugin.json` is sole source of truth for version and description
- README rewritten: renamed to "Radicle Skill", added platform support matrix (Claude Code vs pi), documented Context COB workflow

### Removed

- Stop hook (rad-context reminder) — replaced by pi extension lifecycle

## [0.4.0] - 2026-02-13

### Added

- Context COB (`me.hdh.context`) support — a custom Collaborative Object for capturing AI session observations
- `rad-contexts` skill (`skills/rad-contexts/SKILL.md`) with full Context COB documentation
- `/rad-context` command with create, list, show, and link subcommands
- `context-loader` agent for querying and surfacing linked Context COBs
- Context loading integrated into `/rad-import` and `/rad-sync` commands
- Session-start hook detection for `rad-context` CLI

## [0.3.0] - 2026-02-10

### Added

- Plan COB (`me.hdh.plan`) support — a custom Collaborative Object for persisting implementation plans
- `rad-plans` skill (`skills/rad-plans/SKILL.md`) with Plan COB documentation
- `/rad-plan` command for Plan COB management (create, list, show, sync, export)
- `/rad-issue` command with multi-role specialist research via Task dispatch
- `plan-manager` agent for creating and managing Plan COBs
- Session-start hook detection for `rad-plan` CLI with install instructions

### Changed

- Replaced `/rad-create` command and `issue-planner` agent with `/rad-issue` (specialist agents dispatched as Task subagent roles)

## [0.2.2] - 2026-01-30

### Changed

- Version bump

### Removed

- Stop hook (was not functioning correctly)

## [0.2.0] - 2026-01-29

### Added

- Radicle issue integration with Claude Code tasks and plans
- `/rad-import` command for importing Radicle issues as Claude Code tasks
- `/rad-sync` command for syncing task completion back to Radicle issues
- `/rad-status` command for viewing task status with Radicle links
- Plan mode support in `/rad-import` with `--no-plan` argument
- `AskUserQuestion` integration for choosing plan vs direct task creation
- `marketplace.json` for local development configuration
- Hooks system (`hooks.json`) with named event keys

### Changed

- Plugin version bumped to 0.2.0

## [0.1.0] - 2026-01-27

### Added

- Initial release: Radicle skill for Claude Code
- Core `radicle` skill covering repository management, patches, issues, and node operations
- Non-interactive auth documentation (`rad auth --stdin`)
- Node status symbol reference table
- `rad init --no-confirm` for scripted initialization
- GitHub mirroring via post-commit hook
- README with installation instructions (global and project-local)

[Unreleased]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/main
[0.6.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/3f68c8c
[0.5.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/c982900
[0.4.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/4e40ddb
[0.3.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/5b06580
[0.2.2]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/a1a5014
[0.2.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/d34ee14
[0.1.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/3dfae5b
