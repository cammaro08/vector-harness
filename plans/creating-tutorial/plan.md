# Plan: Creating Tutorial

## Objective

Create a project-level skill at `.claude/skills/tutorial/` that teaches Vector v2 through 5 hands-on exercises using a CRUD todo app. Anyone who clones the repo can run `/tutorial` and follow along.

## Prerequisites

- Node.js 18+
- npm
- Git

## File Structure

```
.claude/skills/tutorial/
├── SKILL.md              # Entry point — overview, navigation, setup instructions
├── setup.md              # Scaffold the CRUD todo app (Express + TypeScript + vitest)
├── exercise-1.md         # Initialize Vector
├── exercise-2.md         # Your First Check (fail → pass)
├── exercise-3.md         # Multiple Checks & Vectors
├── exercise-4.md         # Retries & Escalation
└── exercise-5.md         # Task-Level Overrides & Reports
```

## Phases

### Phase 1: SKILL.md — Entry Point

**File:** `.claude/skills/tutorial/SKILL.md`

**Content:**
- Frontmatter: `name: tutorial`, `disable-model-invocation: true`, `user-invocable: true`
- Description of what Vector is and why it matters (2-3 sentences)
- What the learner will build (CRUD todo API) and what they'll learn
- Numbered list of 5 exercises with one-line summaries
- Links to each exercise markdown file
- Link to setup.md for bootstrapping the practice project
- Estimated time: ~30 minutes total

### Phase 2: setup.md — CRUD App Scaffold

**File:** `.claude/skills/tutorial/setup.md`

**Purpose:** Bootstrap a minimal Express + TypeScript todo API that exercises will use.

**The app:**
- `src/app.ts` — Express app with 3 endpoints:
  - `GET /todos` — list all todos
  - `POST /todos` — create a todo `{ title: string }`
  - `DELETE /todos/:id` — delete a todo
- `src/server.ts` — starts the server on PORT env or 3000
- `src/app.test.ts` — vitest tests for all 3 endpoints using supertest
- `tsconfig.json` — basic TypeScript config
- `package.json` — dependencies: express, typescript, vitest, supertest, @types/*

**Instructions format:**
1. Create a fresh directory and `npm init -y`
2. Install dependencies (exact commands provided)
3. Create each file (full code blocks provided, copy-paste ready)
4. Run `npm test` to verify setup works (all tests pass)
5. Commit initial state: `git init && git add -A && git commit -m "initial: crud todo app"`

**Design notes:**
- In-memory array storage (no database) — keeps it simple
- Tests use supertest for HTTP-level testing
- App is exported separately from server start for testability

### Phase 3: exercise-1.md — Initialize Vector

**Concepts:** `vector init`, `.vector/config.yaml`, Claude Code hook

**Inspired by:** Scenario tests 1-2 (init + verify config)

**Steps:**
1. Run `npx vector init` in the project
2. Inspect `.vector/config.yaml` — explain each section:
   - `version: '2'`
   - `checks` block (test-pass, no-ts-errors)
   - `vectors` block (v1 with both checks)
   - `defaults` (maxRetries: 3, timeout: 30000)
3. Inspect `.claude/settings.local.json` — explain the Stop hook
4. Note that `.vector/active.yaml` doesn't exist yet (expected)

**Expected output:** Show the default config.yaml content

**What you learned:**
- Vector uses YAML config, not hardcoded rules
- Every check is a shell command with exit-0 expectation
- Vectors group checks into named sets
- The Stop hook runs Vector automatically when Claude finishes

### Phase 4: exercise-2.md — Your First Check (fail → pass)

**Concepts:** `vector run`, check failure, retry output, fixing code to pass

**Inspired by:** Scenario tests 3 and 10

**Steps:**
1. Run `npx vector run v1` — observe output
2. The `test-pass` check should PASS (npm test works from setup)
3. The `no-ts-errors` check should PASS (TypeScript compiles)
4. Now break something: introduce a type error in `src/app.ts` (e.g., `const x: number = "hello"`)
5. Run `npx vector run v1` again — observe:
   - `test-pass` still passes
   - `no-ts-errors` FAILS with retry attempts
   - Escalation triggered
   - Exit code 1
6. Fix the type error, run again — both pass, exit code 0

**Expected output:** Show the FAIL report (with retry and escalation sections) and the PASS report

**What you learned:**
- Vector runs real commands and can't be fooled
- Failed checks retry automatically (default 3 retries)
- Escalation happens when retries are exhausted
- Exit code 0 = all pass, 1 = any fail

### Phase 5: exercise-3.md — Multiple Checks & Vectors

**Concepts:** `vector check add`, composing vectors, check registry

**Inspired by:** Scenario tests 4 and 6

**Steps:**
1. Add a lint check: `npx vector check add --name lint --run "npx eslint src/"`
   - First install eslint: `npm install -D eslint @eslint/js`
   - Create minimal `eslint.config.js`
2. Verify it appears in `.vector/config.yaml` under `checks`
3. Note: the new check isn't in any vector yet
4. Edit `.vector/config.yaml` manually to create two vectors:
   - `v1` — quick: `[test-pass]` (just tests)
   - `v2` — full: `[test-pass, no-ts-errors, lint]` (tests + types + lint)
5. Run `npx vector run v1` — fast, just tests
6. Run `npx vector run v2` — all 3 checks
7. Introduce a lint error (e.g., unused variable), run v2, see lint fail while others pass

**Expected output:** Show v1 (1 check, fast) vs v2 (3 checks, thorough)

**What you learned:**
- Checks are independent, reusable building blocks
- Vectors compose checks into named sets for different contexts
- v1 for quick feedback, v2 for pre-commit thoroughness
- `check add` registers a check but doesn't auto-add it to vectors

### Phase 6: exercise-4.md — Retries & Escalation

**Concepts:** Retry behavior, attempt history, escalation trigger, maxRetries config

**Inspired by:** Scenario test 3 (retry/escalation output)

**Steps:**
1. Create a "flaky" check that fails sometimes:
   ```bash
   npx vector check add --name flaky-test --run "bash -c '[ \$((RANDOM % 2)) -eq 0 ] && exit 0 || exit 1'"
   ```
2. Add `flaky-test` to v1 in config.yaml
3. Run `npx vector run v1` multiple times — observe:
   - Sometimes passes on first attempt
   - Sometimes needs retries
   - The RETRIES section shows attempt history with timing
4. Now create a check that always fails:
   ```bash
   npx vector check add --name always-fail --run "exit 1"
   ```
5. Add to v1, run — observe full escalation:
   - 4 attempts (1 initial + 3 retries)
   - ESCALATION section with reason and suggestion
   - VERDICT: FAIL
6. Change `defaults.maxRetries` to 1 in config.yaml, run again — only 2 attempts now
7. Clean up: remove flaky-test and always-fail from v1, restore maxRetries to 3

**Expected output:** Show retry output, escalation output, and the effect of changing maxRetries

**What you learned:**
- Vector retries failed checks automatically (not the whole suite)
- Attempt history is tracked with timing for each attempt
- Escalation fires when all retries are exhausted
- `maxRetries` is configurable per project

### Phase 7: exercise-5.md — Task-Level Overrides & Reports

**Concepts:** `vector activate`, active.yaml, `vector report` in 3 formats

**Inspired by:** Scenario tests 5, 7a-c

**Steps:**
1. Start with v2 having 3 checks: test-pass, no-ts-errors, lint
2. Disable lint for this task: `npx vector activate --check lint --off --vector v2`
3. Inspect `.vector/active.yaml` — only test-pass and no-ts-errors listed
4. Run `npx vector run v2` — only 2 checks run (lint skipped)
5. Re-enable lint: `npx vector activate --check lint --on --vector v2`
6. Run `npx vector run v2` — all 3 checks run again
7. View the report in 3 formats:
   - `npx vector report` — terminal (human-readable)
   - `npx vector report --format json` — JSON (CI/CD pipeable)
   - `npx vector report --format markdown` — Markdown (PR comments)
8. Clean up: delete `.vector/active.yaml` to restore defaults

**Expected output:** Show activate output, the 2-check vs 3-check run, and all 3 report formats

**What you learned:**
- `active.yaml` overrides project config per-task without modifying it
- Activate/deactivate checks on the fly for different work contexts
- Reports come in 3 formats for different consumers
- Delete active.yaml to reset to project defaults

## Implementation Notes

- All exercises use the same CRUD app from setup.md
- Each exercise is self-contained: Goal → Steps → Expected Output → What You Learned
- Code blocks are copy-paste ready with exact commands
- Expected outputs are based on real scenario test results from the V2 PR
- Exercises build on each other but can be referenced independently
- No mocking — all commands run for real against the practice project

## Acceptance Criteria

- [ ] SKILL.md has correct frontmatter and links to all exercises
- [ ] setup.md produces a working CRUD app with passing tests
- [ ] Each exercise has: Goal, Steps (numbered), Expected Output, What You Learned
- [ ] All commands in exercises are copy-paste ready
- [ ] Expected outputs match real Vector v2 CLI behavior
- [ ] Skill is invocable via `/tutorial`
- [ ] Total tutorial is completable in ~30 minutes
