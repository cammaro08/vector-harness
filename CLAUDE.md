# Vector — Project Instructions

## Committing Changes

Every meaningful change or completed task must be committed with a detailed commit description.

**What counts as a meaningful change:**
- Any new file added
- Any feature implemented or completed
- Any bug fixed
- Any test added or updated
- Any documentation written or updated
- Any refactor that changes behaviour or structure

**Commit message format:**
```
<type>: <subject under 72 chars>

<body — 2+ lines explaining what changed, why, and how>

<optional: bullet list of specific changes>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

**Good example:**
```
feat: add DELETE /users/:id endpoint

Implement user deletion with proper HTTP semantics to complete
the CRUD surface for the user resource.

- Returns 204 No Content on successful deletion
- Returns 404 Not Found if user does not exist
- Covered by 3 new tests in user-endpoints.test.ts
- docs/API.md updated with endpoint spec
```

**Bad examples (do not do these):**
```
fix stuff
update code
WIP
changes
```

Do not batch unrelated changes into one commit. One logical task = one commit.

## Validation Harness

The project includes a **repeatable validation harness** that exercises the observability pipeline (terminal reporter, JSON logger, PR commenter) with scenario-based testing.

### Running validation

```bash
npm run validate          # run all 6 scenarios
npm run validate:pass     # only passing scenarios
npm run validate:fail     # only failing scenarios
npx vitest run tools/validation/  # run harness unit tests (41 tests)
```

Output artifacts are written to `validation-output/` (gitignored). Each scenario produces:
- `terminal.txt` / `terminal-colored.txt` — plain and ANSI terminal output
- `report.json` — JSON with `_meta` envelope
- `pr-comment.md` — GitHub PR markdown comment

### Adding a new validation scenario

When adding a new observability feature, add a corresponding scenario:

1. Create `tools/validation/scenarios/<name>.ts`
2. Implement the `ValidationScenario` interface:
   ```typescript
   import { ValidationScenario } from '../types';
   import { createReport, addCheck, finalize } from '../../enforcementReport';

   const scenario: ValidationScenario = {
     id: '<name>',
     description: 'What this scenario tests',
     tags: ['pass' | 'fail', ...other tags],
     buildReport(cwd: string) {
       let report = createReport({ id: '<name>-001', blueprintName: '...', taskDescription: '...', cwd, gitBranch: 'main', gitCommit: 'abc123' });
       report = addCheck(report, { checkName: '...', status: 'passed', duration: 10 });
       return finalize(report);
     },
   };
   export default scenario;
   ```
3. Register in `tools/validation/scenarios/index.ts` — import and add to `allScenarios` array
4. Run `npm run validate` to verify output
5. Run `npx vitest run tools/validation/` to confirm tests pass

### Harness structure

```
tools/validation/
├── types.ts              # ValidationScenario, ScenarioOutput, ValidationRunResult
├── registry.ts           # Scenario registration, tag filtering, duplicate detection
├── runner.ts             # Runs scenarios through all renderers, writes artifacts
├── run.ts                # CLI entry point (--tag filtering)
├── scenarios/            # One file per scenario
│   ├── index.ts          # Barrel export — register new scenarios here
│   ├── all-pass.ts       # tags: [pass, basic]
│   ├── single-failure.ts # tags: [fail, basic]
│   ├── retry-then-pass.ts# tags: [pass, retry]
│   ├── escalation.ts     # tags: [fail, retry, escalation]
│   ├── all-skipped.ts    # tags: [pass, edge-case]
│   └── many-checks.ts    # tags: [fail, retry, stress]
└── __tests__/            # 41 tests across 3 suites
```

### Available tags

`pass`, `fail`, `basic`, `retry`, `escalation`, `edge-case`, `stress`

Use tags to filter scenarios: `npx ts-node tools/validation/run.ts --tag retry --tag escalation`

## Vector v2 CLI

The project includes a Vector v2 CLI that replaces hardcoded checks with a configurable check registry. Every check is a shell command (exit 0 = pass).

### Quick start

```bash
# Initialize vector in a project
npx vector init

# Run checks for a vector
npx vector run v1

# Add a custom check
npx vector check add --name lint --run "npm run lint"

# Toggle checks per task
npx vector activate --check test-pass --on --vector v2

# View the latest report
npx vector report
npx vector report --format json
npx vector report --format markdown
```

### Configuration

- `.vector/config.yaml` — Project-level check registry and vector definitions
- `.vector/active.yaml` — Task-level check overrides
- `.vector/reports/` — JSON report output directory

### Architecture

```
src/
├── config/     # Schema, loader, defaults for .vector/*.yaml
├── protocol/   # Engine that runs checks → EnforcementReport
├── cli/        # CLI commands (init, run, activate, report, check add)
├── adapters/   # Claude Code hook integration
└── reporters/  # Terminal, JSON, PR comment output
```

## Planning Workflow

Use `plans/` for all multi-phase work. Each plan lives in its own folder with a `plan.md` and `progress.md`.

### Directory structure

```
plans/
└── <plan-name>/
    ├── plan.md          # What to build, phases, acceptance criteria
    └── progress.md      # Phase status table, log of completions
```

### Creating a plan

1. Create `plans/<plan-name>/plan.md` with:
   - **Objective** — what you're building and why
   - **Prerequisites** — what's needed before starting
   - **File Structure** — what files will be created or modified
   - **Phases** — numbered phases, each with file targets, content requirements, and design notes
   - **Acceptance Criteria** — checklist of what "done" means

2. Create `plans/<plan-name>/progress.md` with:
   ```markdown
   # Progress: <Plan Name>

   ## Status: PLANNED

   ## Phases

   | # | Phase | Status | Notes |
   |---|-------|--------|-------|
   | 1 | Phase description | Not Started | |
   | 2 | Phase description | Not Started | |

   ## Log

   - YYYY-MM-DD: Plan created
   ```

### Working a plan

1. Read `plan.md` and `progress.md`
2. Create tasks for each phase
3. Implement each phase (use sub-agents for parallel work)
4. Commit after every meaningful change
5. Update `progress.md` after each phase completes — set status to `Done` with notes
6. When all phases are done, set `## Status: COMPLETE` and add a log entry

### Branch convention

Create a feature branch named after the plan: `feat/<plan-name>`

## Custom Skills

### `/talha-style` — TDD Workflow with Sub-Agents

Opinionated workflow for implementing multi-phase plans. Use when working from `plans/<plan-name>/`.

**Workflow:**
1. Read `plans/<plan-name>/plan.md` and `progress.md`
2. Create tasks for each phase
3. For each phase, follow strict TDD with **sonnet sub-agents**:
   - **RED** — sonnet agent writes failing tests
   - **GREEN** — sonnet agent implements minimal code to pass
   - **REFACTOR** — sonnet agent reviews and improves
   - **VERIFY** — run tests, ensure 80%+ coverage
4. Commit after every meaningful change (detailed messages)
5. Update `progress.md` after each phase completes

**Sub-agents:** Use sonnet for `tdd-guide`, `code-reviewer`, and `build-error-resolver`. Run agents in parallel when tasks are independent.

### `/manual-instruction-save` — Capture Session Requests

Saves ad-hoc functional requests from a conversation to `docs/manual-save/`. Run at the end of a session to preserve decisions that aren't in any formal plan.

**What it captures:**
- Functional requests beyond the initial task (e.g., "clean up redundant tests")
- Process preferences (e.g., "use sonnet sub-agents")
- Design decisions made during the conversation
- Patterns that worked and should be repeated

**Output:** One file per conversation at `docs/manual-save/YYYY-MM-DD-<descriptor>.md`

**What it skips:** Routine actions (commit, push), technical implementation details, things already in CLAUDE.md or plan files.
