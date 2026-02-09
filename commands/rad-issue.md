---
name: rad-issue
description: Create Radicle issues from a high-level description (with specialist agents), from an existing task, or from a plan file
arguments:
  - name: input
    description: "A high-level description of work needed, OR a flag: --from-task <task-id>, --from-plan <plan-file>"
    required: true
  - name: flags
    description: "Optional: --light/--standard/--deep (research depth), --single/--multi (issue splitting)"
    required: false
user_invocable: true
---

# Create Radicle Issue

Create Radicle issues in three modes:

1. **Default** — Transform a high-level description into a well-structured issue using specialist agents (`product-manager`, `ux-designer`, `senior-software-engineer`).
2. **`--from-task <task-id>`** — Convert an existing Claude Code task into a Radicle issue.
3. **`--from-plan <plan-file>`** — Parse a plan file and create an issue per actionable section.

**Important**: This command ONLY creates issue(s). It does not start implementation or modify any code.

## Instructions

### Step 0: Verify Radicle Repository

```bash
rad .
```

If this fails, inform the user they need to be in a Radicle repository.

### Determine Mode

- If the input starts with `--from-task` → go to **Mode: From Task**
- If the input starts with `--from-plan` → go to **Mode: From Plan**
- Otherwise → go to **Mode: From Description** (default)

---

## Mode: From Description (default)

Transform a high-level description into a comprehensive Radicle issue, optionally using specialist agents for research.

**Pragmatic Philosophy**:
- Ship Fast: Working solutions over perfect implementations.
- 80/20 Rule: 80% of the value with 20% of the effort.
- MVP First: The simplest thing that could possibly work.

### Step 1: Smart Research Depth Analysis

Analyze the request to determine research depth. Respect override flags if provided.

**LIGHT Complexity** (no agents needed):
- Typos, simple copy changes, minor style tweaks, one-line fixes
- Estimate: under 2 hours
- Skip to Step 3

**STANDARD Complexity** (default for features):
- New features, bug fixes, moderate enhancements
- Dispatch the Core Trio with standard scope
- Proceed to Step 2

**DEEP Complexity** (complex or vague requests):
- Architectural changes, cross-cutting concerns, vague requirements
- Dispatch the Core Trio with deeper investigation scope
- Proceed to Step 2

**Override Flags**:
- `--light`: Force minimal research (no agents)
- `--standard`: Force standard investigation
- `--deep`: Force deep investigation
- `--single`: Force single issue creation
- `--multi`: Force splitting into multiple issues

### Step 2: Dispatch Specialist Agents

For STANDARD and DEEP complexity, dispatch all three agents **in parallel** using the Task tool in a single message.

#### The Core Trio

- **`product-manager`**: Defines the "Why" and "What." User stories, business context, acceptance criteria.
- **`ux-designer`**: Defines the "How" for the user. User flow, states, accessibility, consistency.
- **`senior-software-engineer`**: Defines the "How" for the system. Technical approach, risks, dependencies, effort.

#### STANDARD Research Scope

Dispatch in a **single message** with three parallel Task calls:

- **product-manager** (subagent_type: `general-purpose`): "Define user stories and success criteria for the MVP of: [description]. Focus on who benefits, what problem it solves, and what 'done' looks like."
- **ux-designer** (subagent_type: `general-purpose`): "Propose a user flow for: [description]. Cover all states (loading, empty, error, success), identify existing patterns to reuse, and note accessibility considerations."
- **senior-software-engineer** (subagent_type: `Explore`): "Outline a technical approach for: [description]. Explore the codebase to identify affected files, existing patterns, risks, dependencies, and provide a pragmatic effort estimate in hours."

#### DEEP Research Scope

Same parallel dispatch, with expanded prompts:

- **product-manager**: Add business impact analysis, success metrics, and edge case scenarios.
- **ux-designer**: Add detailed design brief, state machine, and component inventory.
- **senior-software-engineer**: Add architectural trade-off analysis, phased roadmap, and risk mitigation strategies.

### Step 3: Generate Issue Content

Synthesize findings from the three agents (or generate directly for LIGHT) into the issue description.

#### STANDARD / DEEP template:

```markdown
## Business Context & Purpose
<Synthesized from product-manager findings>
- What problem are we solving and for whom?
- What is the expected impact?

## Expected Behavior/Outcome
<Synthesized from product-manager and ux-designer findings>
- Clear description of the new behavior
- Definition of relevant states (loading, empty, error, success)

## Research Summary
**Investigation Depth**: <LIGHT|STANDARD|DEEP>
**Confidence Level**: <High|Medium|Low>

### Key Findings
- **Product & User Story**: <Key insights from product-manager>
- **Design & UX Approach**: <Key insights from ux-designer>
- **Technical Plan & Risks**: <Key insights from senior-software-engineer>
- **Effort Estimate**: <From senior-software-engineer>

## Acceptance Criteria
<Generated from all three agents' findings>
- [ ] Functional: User can do X and see Y
- [ ] UX: Responsive, includes loading/error states
- [ ] Technical: API returns correct status codes
- [ ] All new code paths are covered by tests

## Dependencies & Constraints
<Identified by senior-software-engineer and ux-designer>
- Dependencies: Relies on existing components X, Y
- Technical Constraints: Must handle edge case Z

## Implementation Notes
<Technical guidance from senior-software-engineer>
- Recommended Approach: Extend existing module...
- Key Files: list of files to modify
- Potential Gotchas: Watch out for...
```

#### LIGHT template:

```markdown
## Summary
<Direct description of the change>

## Acceptance Criteria
- [ ] The change is applied correctly
- [ ] No regressions introduced
```

### Step 4: Smart Issue Creation

- **If effort <= 2 days** (or `--single` flag): Create a single issue.
- **If effort > 2 days** (or `--multi` flag): Break into 2-3 smaller issues, each scoped and estimated.

Create each issue:

```bash
rad issue open --title "<title>" --description "<description>"
```

Apply labels:

```bash
rad issue label <issue-id> --add <label>
```

Label detection:
- New functionality → `feature`
- Bug fix → `bug`
- Tests → `test`
- Documentation → `docs`
- Refactoring → `refactor`
- Security → `security`
- Performance → `performance`

### Step 5: Announce and Report

```bash
rad sync --announce
```

Report:

```
Created Radicle issue <id>: "<title>"
Labels: feature
Effort Estimate: 1 day
Investigation Depth: STANDARD

Use /rad-import <id> to import as tasks and start working.
```

---

## Mode: From Task (`--from-task <task-id>`)

Convert an existing Claude Code task into a Radicle issue.

1. **Get the task details** using TaskGet with the provided task ID.

2. **Create the issue**:
   ```bash
   rad issue open --title "<task-subject>" --description "<task-description>"
   ```

3. **Link the issue back to the task** by updating task metadata with TaskUpdate:
   - `radicle_issue_id`: the new issue ID
   - `radicle_repo`: output of `rad .`
   - `radicle_issue_title`: the issue title
   - `source`: `"radicle"`

4. **Apply labels** using the same heuristics as above.

5. **Announce and report**:
   ```bash
   rad sync --announce
   ```
   ```
   Created Radicle issue <id>: "<title>"
   Linked to Task #<task-id>
   ```

---

## Mode: From Plan (`--from-plan <plan-file>`)

Parse a plan file and create an issue per actionable section.

1. **Read the plan file** using the Read tool.

2. **Parse the plan structure**:
   - Identify major sections (## headers typically)
   - Each section with actionable work becomes an issue
   - Skip meta-sections: "Overview", "Introduction", "Background", "Summary", "Conclusion", "Notes", "References"

3. **For each actionable section**:
   - Extract the section title as issue title
   - Extract content as issue description
   - Detect labels from content

4. **Create issues**:
   ```bash
   rad issue open --title "<section-title>" --description "<section-content>"
   rad issue label <issue-id> --add <label>
   ```

5. **Announce and report**:
   ```bash
   rad sync --announce
   ```
   ```
   Created 3 Radicle issues from plan:

   1. Issue abc123: "Implement core API"
      Labels: feature

   2. Issue def456: "Add authentication"
      Labels: feature, security

   3. Issue ghi789: "Write documentation"
      Labels: docs

   Use /rad-import <id> to import any issue as tasks.
   ```

**Plan parsing label heuristics:**
- Contains "bug", "fix", "broken" → `bug`
- Contains "test", "coverage" → `test`
- Contains "doc", "readme", "guide" → `docs`
- Contains "security", "auth", "permission" → `security`
- Default → `feature`

---

## Example Workflows

### High-Level Description (STANDARD)

```
/rad-issue Add user profile page with avatar upload

# Detects STANDARD complexity
# Dispatches product-manager, ux-designer, senior-software-engineer in parallel
# Synthesizes findings into comprehensive issue

Created Radicle issue d4e5f6: "Add user profile page with avatar upload"
Labels: feature
Effort Estimate: 1.5 days
Investigation Depth: STANDARD
```

### Simple Fix (LIGHT)

```
/rad-issue Fix typo in README header --light

Created Radicle issue a1b2c3: "Fix typo in README header"
Labels: docs
Effort Estimate: <1 hour
Investigation Depth: LIGHT
```

### Complex Architecture (DEEP)

```
/rad-issue Migrate from REST to GraphQL API --deep

# Automatically splits into multiple issues due to >2 day estimate

Created 3 Radicle issues:
1. Issue g7h8i9: "GraphQL schema design and server setup"
2. Issue j0k1l2: "Migrate core endpoints to GraphQL resolvers"
3. Issue m3n4o5: "Update frontend to use GraphQL client"
```

### From Existing Task

```
/rad-issue --from-task 5

Created Radicle issue f7e8a9b: "Refactor database layer"
Linked to Task #5
```

### From Plan File

```
/rad-issue --from-plan feature-plan.md

Created 4 Radicle issues from plan:
1. Issue a1b2c3: "Set up project structure"
2. Issue d4e5f6: "Implement data models"
3. Issue g7h8i9: "Create API endpoints"
4. Issue j0k1l2: "Add test coverage"
```

## Notes

- This command only creates issues, it does not start implementation
- Use `/rad-import <issue-id>` to import a created issue as tasks
- Agents explore the current codebase for context, so run this from the relevant repository
- `rad sync --announce` propagates issues to the Radicle network
- Override flags are optional; the command auto-detects complexity by default
- Created issues are independent — use `/rad-import` to import them as linked tasks
