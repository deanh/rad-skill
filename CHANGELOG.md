# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-03-01

### Added

- `/rad-status` now queries actual repository state (`rad issue list`, `rad-plan list`) and cross-references with session tasks — shows open issues, active plans, and session progress in a unified dashboard with actionable suggestions
- `/rad-import` offers interactive "Save as Plan COB?" prompt after task creation, replacing the old `--save-plan` flag
- `/rad-import` context-loading step enhanced with full priority-ordered pattern (constraints → friction → learnings → approach → open items → verification), multi-context chronological display, and file-based secondary queries
- `rad-plans` skill now includes interactive plan management patterns (create, edit, export, status, comments) absorbed from the deleted `/rad-plan` command
- `/rad-sync` now shows Plan COB sync status prominently alongside issue sync in both dry-run and actual output
- Session-start hook suggests `/rad-status` as the first action

### Changed

- Plugin version bumped to 0.8.0
- `/rad-import` no longer accepts `--no-plan`, `--save-plan`, or `--dispatch` flags — plan mode prompt and plan-save prompt are now interactive
- `/rad-sync` description updated to reflect dual sync scope (issues and Plan COBs)
- `plan-manager` agent scoped to orchestration pipeline only — removed "Sync Task Completion" and "Convert Tasks to Issues" workflows (handled by `/rad-sync` and `/rad-issue --from-task`)
- Session-start hook uses `rad-plan list` (CLI) instead of `/rad-plan list` (deleted command)
- README updated: platform support table, skills table (3 not 4), commands section (no flags on `/rad-import`, no `/rad-plan`), agents table (no `context-loader`), manual dispatch section

### Removed

- `rad-tasks` skill (`skills/rad-tasks/SKILL.md`) — duplicated `/rad-import`, `/rad-sync`, and `/rad-status` command documentation
- `/rad-plan` command (`.claude-plugin/commands/rad-plan.md`) — CRUD patterns merged into `rad-plans` skill; users interact via `rad-plan` CLI directly
- `context-loader` agent (`.claude-plugin/agents/context-loader.md`) — context-loading logic already inlined in `/rad-import` (step 3) and `worker` agent; ad-hoc queries handled by `rad-contexts` skill

## [0.7.1] - 2026-02-27

### Changed

- Moved `commands/` and `agents/` under `.claude-plugin/` for cleaner platform separation — shared skills remain at repo root, platform-specific code lives under `.claude-plugin/` (Claude Code) and `.pi/` (pi)
- Updated `plugin.json` paths to reflect new locations
- Removed dangling `commands/rad-dispatch.md` reference from `plugin.json` (file was deleted in v0.7.0)
- Updated README: replaced `/rad-dispatch` with `/rad-orchestrate`, documented pi orchestrator and worker agent, added pi installation for orchestrator extension and agents

## [0.7.0] - 2026-02-27

### Added

- pi orchestrator extension (`.pi/extensions/rad-orchestrator.ts`) — `/rad-orchestrate <plan-id>` command for automated multi-agent task execution across worktrees
- pi worker agent (`.pi/agents/rad-worker.md`) — subagent definition for executing single Plan COB tasks in isolated worktrees
- One-patch-per-plan model: workers produce commits only, orchestrator cherry-picks and creates a single Radicle patch at completion
- Worker DONE protocol: workers post `DONE task:<id> commit:<sha>` comments; orchestrator parses these to drive cherry-pick and link-commit
- REJECTED comment protocol: orchestrator posts `REJECTED task:<id> reason:<msg>` on cherry-pick failure
- `workerDone` state in plan analysis — tasks signaled done by workers but not yet cherry-picked into the plan branch
- `baseCommit` tracking: orchestrator records HEAD at dispatch time so the plan branch is created from a stable base
- Implementation plan document (`PLAN-pi-multi-agent-worktrees.md`) covering the full multi-agent worktree architecture

### Changed

- Plugin version bumped to 0.7.0
- Orchestrator completion switched from `git merge --no-ff` to `git cherry-pick` for cleaner plan branches
- Orchestrator creates plan branch from recorded base commit instead of current HEAD
- Orchestrator collects worker commit SHAs both from subprocess output and DONE comments (dual-source with fallback)
- Orchestrator `link-commit` now uses the cherry-picked SHA (not the worker's original) for accurate plan-branch references
- Dispatch report labels: "Landed" for linked tasks, "Worker Done (awaiting cherry-pick)" for DONE-signaled tasks
- Worker agent: posts DONE comment instead of calling `rad-plan task link-commit` directly
- Stricter error handling in `completePlan`: patch push failure, missing patch ID, and patch verification all throw with context
- On completion failure, orchestrator returns to previous branch and preserves worktrees for manual recovery
- Update all skill files for `rad-plan` v0.2.0: `task start`/`task complete` replaced with `task link-commit`, CLAIM comment convention for in-progress signaling, correct JSON field names (`affectedFiles`, `linkedCommit`), short-form ID support
- Update `rad-context` docs for upstream CLI changes: `verification` field, `taskId` field, JSON validation, short-form IDs, `--no-auto-files` and `--auto-link-commits` flags
- Worker agent (`agents/worker.md`): removed per-worker patch pushing — workers produce commits and Context COBs only
- Design doc (`agents-cobs-worktrees.md`): removed reviewer agent (deferred), moved patches to coordinator level, updated information flow diagram
- Plan-manager agent: `/rad-dispatch` references updated to `/rad-orchestrate`

### Removed

- `/rad-dispatch` command (`commands/rad-dispatch.md`) — replaced by `/rad-orchestrate` in the pi orchestrator extension
- Reviewer agent concept — deferred until worker loop is proven

## [0.6.0] - 2026-02-24

### Added

- Worker agent (`agents/worker.md`) for executing Plan COB tasks in isolated worktrees — one commit, one patch, one Context COB per task
- Plan-manager dispatch workflow for identifying tasks ready for parallel execution across worktrees
- `/rad-dispatch` command for analyzing Plan COBs and outputting dispatch instructions
- Multi-agent coordination design doc (`agents-cobs-worktrees.md`) covering coordinator and worker roles
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
[0.8.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/main
[0.7.1]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/607801a
[0.7.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/d2a2b3c
[0.6.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/3f68c8c
[0.5.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/c982900
[0.4.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/4e40ddb
[0.3.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/5b06580
[0.2.2]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/a1a5014
[0.2.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/d34ee14
[0.1.0]: https://app.radicle.xyz/nodes/seed.radicle.xyz/rad:zvBj4kByGeQSrSy2c4H7fyK42cS8/commits/3dfae5b
