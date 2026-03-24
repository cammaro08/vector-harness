# Vector Harness — Verification & Usage Guide

## Contents

1. [System Overview](#1-system-overview)
2. [How Harness I/O Was Verified](#2-how-harness-io-was-verified)
3. [PI Enforcer: Input/Output Reference](#3-pi-enforcer-inputoutput-reference)
4. [How to Build a Feature with Vector](#4-how-to-build-a-feature-with-vector)
5. [Blueprint Reference](#5-blueprint-reference)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. System Overview

Vector is a **deterministic enforcement harness** that wraps AI agents to prevent them from lying about results, skipping tests, or cutting corners on quality. It has two main components:

```
vector/
├── blueprints/          # Workflow definitions (YAML) + orchestrator engine
│   ├── orchestrator.ts  # Executes blueprints step-by-step with retry
│   ├── implement-feature.yaml
│   ├── fix-bug.yaml
│   └── refactor.yaml
│
├── .pi/extensions/enforcer/   # Git hook enforcement
│   ├── index.ts               # Hooks into git commit/add tool calls
│   └── validators/
│       ├── commit-validator.ts   # Quality gate: commit message
│       ├── test-validator.ts     # Quality gate: test files exist
│       └── doc-validator.ts     # Quality gate: docs updated
│
└── tools/               # Deterministic tools used by the orchestrator
    ├── testRunner.ts        # Runs npm test, parses output
    ├── coverageValidator.ts # Validates 80% coverage threshold
    ├── progressLog.ts       # Structured audit trail
    └── docValidator.ts      # Checks docs existence
```

**Core principle**: Agent steps are sandwiched between deterministic steps. Agents implement; tools verify. If verification fails, the agent retries (max 3 attempts). If all attempts fail, the harness escalates to a human with full context.

---

## 2. How Harness I/O Was Verified

### 2.1 The Challenge

The PI Enforcer is a **Claude Code extension**, not a CLI tool. It registers handlers via `pi.on("tool_call", handler)` that intercept git commands at runtime. It cannot be called directly from a shell script. To verify it works, we needed a way to:

1. Simulate git commit tool call events programmatically
2. Capture the enforcer's `{ blocked: true, message }` return values
3. Assert correct blocking/allowing behavior across multiple scenarios

### 2.2 The Capture Approach

We created an integration test harness at `.pi/extensions/enforcer/__tests__/enforcer-integration.test.ts` that:

**Step 1 — Mock the ExtensionAPI**

```typescript
function createMockAPI() {
  const handlers: { event: string; handler: Function }[] = [];
  return {
    api: {
      on(event: string, handler: Function) {
        handlers.push({ event, handler });
      }
    },
    async triggerToolCall(toolCallEvent: object, ctx: object) {
      for (const h of handlers.filter(h => h.event === 'tool_call')) {
        const result = await h.handler(toolCallEvent, ctx);
        if (result) return result; // First block wins
      }
      return undefined; // Allowed
    }
  };
}
```

**Step 2 — Register the real enforcer into the mock**

```typescript
import enforcer from '../index';
const { api, triggerToolCall } = createMockAPI();
enforcer(api); // Enforcer registers its handlers onto mock
```

**Step 3 — Trigger with simulated git commit events**

```typescript
const result = await triggerToolCall({
  toolName: 'bash',
  input: { command: 'git commit -m "fix auth"' }
}, { cwd: '/path/to/crud-server' });

// result = { blocked: true, message: "🚫 Commit blocked — poor commit message..." }
```

**Step 4 — Validators called directly for unit coverage**

```typescript
import { validateCommitMessage } from '../validators/commit-validator';
import { validateTests } from '../validators/test-validator';
import { validateDocs } from '../validators/doc-validator';

const result = validateCommitMessage("fix auth");
// result = { valid: false, issues: ["too short (8 chars, min 50)", "Missing body"] }
```

### 2.3 Test Scenarios Run

Seven scenarios were executed against the CRUD test app (`test-apps/crud-server/`):

| # | Scenario | Staged Files | Commit Message | Expected | Result |
|---|---|---|---|---|---|
| 1 | Valid commit | `src/auth.ts` + `src/auth.test.ts` + `docs/CHANGES.md` | Good (multi-line, 50+ chars) | Allow | ✅ PASS |
| 2 | Message too short | `src/auth.ts` + `src/auth.test.ts` | `"fix auth"` | Block | ✅ PASS |
| 3 | Message missing body | `src/auth.ts` + `src/auth.test.ts` | Subject only, no blank line + body | Block | ✅ PASS |
| 4 | Source file, no test | `src/auth.ts` only | Good message | Block | ✅ PASS |
| 5 | Source changed, no docs | `src/user-endpoints.ts` + `src/user-endpoints.test.ts` | Good message | Block | ✅ PASS |
| 6 | Tests only | `src/auth.test.ts` only | Good message | Allow | ✅ PASS |
| 7 | Docs only | `docs/CHANGES.md` only | Good message | Allow | ✅ PASS |

**Final result: 7/7 scenarios correct (100%).**

Full captured output is in `.pi/extensions/enforcer/__tests__/TEST_RESULTS.md`.

### 2.4 Overall Test Suite Results

Running `npm test` from the project root:

```
blueprints/__tests__/orchestrator.test.ts     29 passed
tools/__tests__/testRunner.test.ts            22 passed
tools/__tests__/coverageValidator.test.ts     22 passed
tools/__tests__/progressLog.test.ts            9 passed
tools/__tests__/docValidator.test.ts          12 passed
test-apps/crud-server/src/user-endpoints.test.ts   4 passed, 3 FAILED (intentional)
test-apps/crud-server/src/auth.test.ts             1 passed, 2 FAILED (intentional)
test-apps/crud-server/src/error-handler.test.ts    0 passed, 2 FAILED (intentional)

Total: 106 tests — 99 passed, 7 failed (all failures intentional in CRUD app)
```

The 7 CRUD app failures are by design — they exist to prove the harness detects them.

---

## 3. PI Enforcer: Input/Output Reference

### 3.1 Commit Message Validator

**Input**: raw commit message string

**Rules**:
- Total length ≥ 50 characters
- Subject line ≤ 72 characters
- Blank line separating subject from body
- Body must be at least 2 lines

**Output when blocked**:
```
🚫 Commit blocked — poor commit message.

Commit message issues:
  - Commit message is too short (8 chars, minimum 50). Describe what changed and why.
  - Missing commit body — add a blank line after the subject, then explain what
    changed and why (at least 2 lines).

Write a detailed commit message with:
- Subject line (under 72 chars)
- Blank line
- Body explaining what changed, why, and how (at least 2 lines)
```

**Good commit message example**:
```
feat: add JWT authentication middleware

Implement token-based auth that validates signatures on protected routes.
This replaces session auth which had scaling issues with our Redis cluster.

- Validates JWT signature and expiry
- Extracts user context for downstream handlers
- Returns 401 with specific error codes for debugging
```

### 3.2 Test Validator

**Input**: list of staged file paths + working directory

**Rules**:
- Every `.ts` source file needs a co-located `.test.ts` or `.spec.ts`
- Co-located: `src/foo/bar.test.ts` alongside `src/foo/bar.ts`
- Mirrored: `tests/foo/bar.test.ts` for `src/foo/bar.ts`
- Skipped for: `.test.ts`, `.spec.ts`, config files, `node_modules`

**Output when blocked**:
```
🚫 Commit blocked — missing tests.

Source files staged without corresponding test files:
  - src/auth.ts (expected: src/auth.test.ts or tests/auth.test.ts)

Create the missing test files before committing.
```

### 3.3 Docs Validator

**Input**: list of staged file paths + working directory

**Rules**:
- If any `.ts` source file is staged, at least one doc file must also be staged
- Accepted doc locations: `docs/**`, `README.md`, `PROGRESS_LOG.md`
- Skipped if only test or doc files are staged

**Output when blocked**:
```
⚠️ Commit blocked — docs not updated.

Source code was changed but no documentation was updated.
Update relevant docs (docs/, README.md, or PROGRESS_LOG.md) to reflect the changes.
```

### 3.4 Context Injection

When the PI agent starts a session, the enforcer injects these rules into the system context:

```
[ENFORCEMENT RULES — PI Coding Agent]

1. Every .ts source file MUST have a corresponding .test.ts file.
2. When changing source code, update relevant documentation.
3. Commit messages MUST be detailed and descriptive.
   - Subject line: concise summary, under 72 characters
   - Blank line after subject
   - Body: at least 2 lines explaining what changed, why, and how
```

---

## 4. How to Build a Feature with Vector

### 4.1 Quick Start

```bash
cd /home/talha/dev/vector

# 1. Pick a blueprint
cat blueprints/implement-feature.yaml   # New feature
cat blueprints/fix-bug.yaml             # Bug fix
cat blueprints/refactor.yaml            # Refactoring

# 2. Run the orchestrator with your executor
# (See Section 4.3 for StepExecutor implementation)
```

### 4.2 The Feature Implementation Flow

The `implement-feature.yaml` blueprint defines a 7-step workflow. Here is what happens at each step and who does the work:

```
Step 1: setup           [deterministic] Create isolated git worktree
         ↓
Step 2: implement       [agent]         Agent implements the feature (retryable, max 3)
         ↓
Step 3: run-tests       [deterministic] testRunner runs npm test, captures results
         ↓ (failureAction: continue — always moves on)
Step 4: fix-failures    [agent]         Agent fixes failing tests IF step 3 had failures
         ↓ (conditional: steps.run-tests.failed > 0)
Step 5: validate-coverage [deterministic] coverageValidator checks 80% threshold
         ↓ (failureAction: block — stops here if coverage fails)
Step 6: validate-docs   [deterministic] docValidator checks docs exist
         ↓ (failureAction: block — stops here if docs missing)
Step 7: create-pr       [deterministic] Creates pull request
```

**Key insight**: Steps 1, 3, 5, 6, 7 are deterministic — no agent can fake their results. Steps 2 and 4 are agent-powered but bounded by the deterministic gates that follow them.

### 4.3 Wiring Up the StepExecutor

The orchestrator takes a `StepExecutor` function via dependency injection. You write this function to connect steps to real tools and agents:

```typescript
import { executeBlueprint, loadBlueprint } from './blueprints/orchestrator';
import { runTests } from './tools/testRunner';
import { validateCoverage } from './tools/coverageValidator';
import { validateDocs } from './tools/docValidator';

const blueprint = await loadBlueprint('./blueprints/implement-feature.yaml');

const result = await executeBlueprint({
  blueprint,
  taskDescription: 'Add DELETE /users/:id endpoint with 204 response',
  executor: async (step) => {
    switch (step.name) {
      case 'setup':
        // Create git worktree
        await exec(`git worktree add ../feature-worktree -b feat/${featureName}`);
        return { success: true };

      case 'implement':
        // Hand off to your AI agent (Claude, PI agent, etc.)
        await runAgent(step.agent, taskDescription);
        return { success: true };

      case 'run-tests':
        const testResult = await runTests({ cwd: worktreePath });
        return {
          success: testResult.failed === 0,
          failed: testResult.failed,
          passed: testResult.passed,
          output: testResult.output,
        };

      case 'validate-coverage':
        const coverage = await validateCoverage({ cwd: worktreePath, threshold: 80 });
        return { success: coverage.valid, coverage: coverage.pct };

      case 'validate-docs':
        const docs = await validateDocs({ cwd: worktreePath });
        return { success: docs.valid };

      case 'create-pr':
        await exec(`gh pr create --title "${prTitle}" --body "${prBody}"`);
        return { success: true };
    }
  }
});

if (result.success) {
  console.log(`Feature complete in ${result.totalDuration}ms`);
} else if (result.escalation) {
  console.log('Escalating to human:', result.escalation);
}
```

### 4.4 What the Orchestrator Returns

```typescript
type OrchestratorResult = {
  success: boolean;
  completedSteps: string[];      // Steps that finished
  failedStep?: string;           // Which step stopped execution
  totalDuration: number;         // ms
  escalation?: {
    reason: string;
    taskDescription: string;
    failedStep: string;
    attempts: AttemptRecord[];   // Full history of all retries
    suggestions: string[];       // Actionable next steps for human
  };
};
```

When escalation happens, the `attempts` array contains every retry with its error and timestamp — so the human receiving the escalation has full context without needing to re-run anything.

### 4.5 Using the PI Enforcer in Your Workflow

The PI enforcer runs **automatically** as a git hook extension inside any Claude Code / PI agent session. To activate it for your project:

1. Ensure `.pi/extensions/enforcer/` is present in your repo root
2. The enforcer is loaded by the PI agent on session start via `pi.on` hooks
3. No manual invocation needed — it intercepts every `git commit` tool call

**What it does during feature development**:

```
Agent writes code
      ↓
Agent stages files (git add)
      ↓
Agent attempts git commit
      ↓ ← PI Enforcer intercepts here
  ┌─ Validates commit message quality
  ├─ Checks test files exist for all staged source files
  └─ Checks docs were updated alongside source changes
      ↓
  BLOCKED? → Agent sees error message → Agent fixes issue → retries commit
  ALLOWED? → Commit proceeds
```

### 4.6 Running the Full Feature Workflow (Step by Step)

**1. Start a PI agent session in your repo**

The enforcer context rules are injected automatically when the session starts.

**2. Give the agent the feature task**

```
Implement a DELETE /users/:id endpoint that:
- Returns 204 on success
- Returns 404 if user not found
- Has a corresponding test in user-endpoints.test.ts
- Updates docs/API.md with the new endpoint
```

**3. The agent will attempt to commit — the enforcer validates**

If the agent tries to commit with `git commit -m "add delete"`, the enforcer blocks:
```
🚫 Commit blocked — poor commit message.
  - Commit message is too short (10 chars, minimum 50)
  - Missing commit body
```

The agent retries with a proper message:
```
feat: implement DELETE /users/:id endpoint

Add endpoint to delete users by ID with proper HTTP semantics.
Returns 204 No Content on success, 404 Not Found if user missing.

- Validates user existence before deletion
- Returns appropriate status codes
- Covered by 3 new test cases in user-endpoints.test.ts
```

If the agent forgot to update docs, the enforcer catches that too:
```
⚠️ Commit blocked — docs not updated.
Source code was changed but no documentation was updated.
```

**4. After successful commit, the orchestrator validates coverage**

The `validate-coverage` step runs `coverageValidator` against the worktree. If coverage dropped below 80%, the blueprint stops (`failureAction: block`) and reports why.

**5. PR is created only when all gates pass**

---

## 5. Blueprint Reference

### implement-feature.yaml — Full feature workflow

Use when: Building a new endpoint, service, or component from scratch.

| Step | Type | Retryable | On Failure |
|---|---|---|---|
| setup | deterministic | no | escalate |
| implement | agent | yes (×3) | escalate |
| run-tests | deterministic | no | continue |
| fix-failures | agent | yes (×3) | escalate |
| validate-coverage | deterministic | no | **block** |
| validate-docs | deterministic | no | **block** |
| create-pr | deterministic | no | escalate |

### fix-bug.yaml — Bug fix workflow

Use when: Reproducing and fixing a specific defect.

| Step | Type | Retryable | On Failure |
|---|---|---|---|
| setup | deterministic | no | escalate |
| fix | agent | yes (×3) | escalate |
| run-tests | deterministic | no | continue |
| fix-regressions | agent | yes (×3) | escalate |
| create-pr | deterministic | no | escalate |

### refactor.yaml — Refactoring workflow

Use when: Restructuring code without changing external behavior. Baseline tests run first to detect regressions.

| Step | Type | Retryable | On Failure |
|---|---|---|---|
| setup | deterministic | no | escalate |
| baseline-tests | deterministic | no | **block** |
| refactor | agent | yes (×3) | escalate |
| regression-tests | deterministic | no | **block** |
| create-pr | deterministic | no | escalate |

---

## 6. Troubleshooting

### Commit blocked: message too short

The enforcer requires ≥ 50 total characters and a body. Use the format:
```
<type>: <subject under 72 chars>

<2+ lines explaining what changed, why, and how>
```

### Commit blocked: missing tests

Every `.ts` source file needs a `.test.ts` in the same directory or under `tests/`. Check:
```bash
ls src/         # See which source files exist
ls src/*.test.ts  # Check which have tests
```

### Commit blocked: docs not updated

When staging any `.ts` source file, also stage at least one doc file:
```bash
git add docs/PROGRESS_LOG.md  # or README.md or docs/<anything>
```

### Orchestrator escalation: all retries exhausted

Check `result.escalation.attempts` for the full error history. The `suggestions` field lists concrete next steps. Common causes:
- Agent is generating wrong code for the problem (re-read the task description)
- Test environment issues (check `npm test` runs locally)
- Coverage threshold too high for the current code size (check `vitest.config.ts`)

### Coverage below threshold

The `coverageValidator` tool requires 80% across statements, branches, and functions. To diagnose:
```bash
npm run test:coverage
# Check coverage/index.html for per-file breakdown
```

Files excluded from coverage are configured in `vitest.config.ts` under `coverage.exclude`.
