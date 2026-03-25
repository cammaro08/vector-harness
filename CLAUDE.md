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

## Custom Skills

### `/talha-style` — TDD Workflow with Sub-Agents

Opinionated workflow for implementing multi-phase plans. Use when working from `docs/active-plan/`.

**Workflow:**
1. Read `docs/active-plan/plan.md` and `progress.md`
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
