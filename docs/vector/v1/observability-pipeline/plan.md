# Plan: Layered Observability for Vector

**Status:** Ready for implementation
**Branch:** `feat/observability`
**Created:** 2026-03-25

---

## 1. Goal

Add observability to Vector so that after every enforcement run, developers can see exactly what happened: which checks ran, what passed/failed, what was retried, escalations, and timing.

Output surfaces in three ways:
- **Terminal** (primary) — colored stdout during local execution
- **JSON file** — machine-readable log for tooling/debugging
- **PR comment** (optional) — markdown posted to GitHub PRs in CI

---

## 2. Architecture

```
EnforcementReport (single source of truth)
        |
        +-- Terminal Reporter   <- always, real-time, colored stdout
        +-- JSON Event Log      <- always, machine-readable file
        +-- PR Comment          <- optional, CI only, via gh CLI
```

Three thin renderers over one data model. Each renderer is independent and non-blocking (failure in one does not affect the others or the validation outcome).

---

## 3. Constraints

- No new npm dependencies (Node built-ins only)
- TypeScript strict mode
- TDD with 80%+ coverage per phase
- Immutable data patterns (no mutation)
- Existing `progressLog.ts` untouched (supplemented, not replaced)
- Backward compatible with existing enforcer behavior

---

## 4. File Map

```
tools/
  enforcementReport.ts          Phase 1  ~120 lines   Core data model + builders
  terminalReporter.ts           Phase 2  ~250 lines   Colored terminal output
  jsonLogger.ts                 Phase 3  ~80 lines    JSON file writer
  ghPrCommenter.ts              Phase 4  ~150 lines   GitHub PR commenting
  __tests__/
    enforcementReport.test.ts   Phase 1  ~180 lines
    terminalReporter.test.ts    Phase 2  ~200 lines
    jsonLogger.test.ts          Phase 3  ~120 lines
    ghPrCommenter.test.ts       Phase 4  ~150 lines

.pi/extensions/enforcer/
  reporter.ts                   Phase 5  ~180 lines   Wire all renderers together
  __tests__/
    reporter-integration.test.ts Phase 5 ~200 lines
```

Total new code: ~1,500 lines (roughly half tests)

---

## 5. Existing Types (from `blueprints/orchestrator.ts`)

These are the types we consume — no changes to these files:

```typescript
interface StepResult {
  stepName: string;
  type: 'deterministic' | 'agent';
  status: 'success' | 'failed' | 'skipped';
  attemptNumber: number;
  output?: unknown;
  error?: string;
  duration: number;
}

interface Escalation {
  reason: string;
  taskDescription: string;
  attemptHistory: StepResult[];
  suggestion: string;
}

interface OrchestratorResult {
  blueprintName: string;
  success: boolean;
  completedSteps: StepResult[];
  failedStep?: string;
  escalation?: Escalation;
  totalDuration: number;
}
```

---

## 6. Phases

### Phase 1: Core Data Model

**File:** `tools/enforcementReport.ts` (~120 lines)
**Tests:** `tools/__tests__/enforcementReport.test.ts` (~180 lines)

#### New Types

```typescript
interface CheckResult {
  checkName: string;              // e.g. 'commit-message', 'tests-exist', 'docs-updated'
  status: 'passed' | 'failed' | 'skipped';
  duration: number;               // ms
  details?: {
    message: string;
    issues?: readonly string[];
    missing?: readonly string[];
  };
}

interface RetryInfo {
  checkName: string;
  totalAttempts: number;
  succeededAtAttempt?: number;
  finalStatus: 'passed' | 'failed';
  attemptHistory: readonly {
    attemptNumber: number;
    status: 'passed' | 'failed';
    error?: string;
    duration: number;
  }[];
}

interface EnforcementReport {
  id: string;                     // timestamp-based
  blueprintName: string;
  taskDescription: string;
  verdict: 'pass' | 'fail';
  checks: readonly CheckResult[];
  retries: readonly RetryInfo[];
  escalation?: {
    reason: string;
    suggestion: string;
    failedCheckName: string;
  };
  timestamp: string;              // ISO 8601
  totalDuration: number;          // ms
  environment: {
    cwd: string;
    gitBranch?: string;
    gitCommit?: string;
  };
}
```

#### Builder Functions (all immutable — return new objects)

| Function | Purpose |
|----------|---------|
| `createReport(opts)` | Create empty report shell with metadata |
| `addCheck(report, check)` | Return new report with check appended |
| `addRetry(report, retry)` | Return new report with retry appended |
| `withEscalation(report, esc)` | Return new report with escalation + verdict=fail |
| `finalize(report)` | Compute verdict from checks, set totalDuration |
| `fromOrchestratorResult(result, cwd)` | Bridge: OrchestratorResult -> EnforcementReport |

#### Test Cases

- **Immutability:** `addCheck` returns new object, original unchanged; arrays not shared
- **Builders:** `createReport` sets defaults; `finalize` computes verdict from check statuses
- **Bridge:** maps OrchestratorResult success/failure/escalation/retries correctly
- **Edge cases:** empty checks, undefined escalation, no details on check

---

### Phase 2: Terminal Reporter

**File:** `tools/terminalReporter.ts` (~250 lines)
**Tests:** `tools/__tests__/terminalReporter.test.ts` (~200 lines)

#### Example Output (TTY with colors)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VECTOR ENFORCEMENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Blueprint: implement-feature
Task:      Add DELETE /users/:id endpoint

CHECKS
  [PASS] commit-message .............. 12ms
  [FAIL] tests-exist ................ 45ms
         Missing: user-endpoints.test.ts
  [PASS] tests-exist (retry #2) ..... 38ms
  [PASS] docs-updated ............... 8ms

RETRIES
  tests-exist: 2 attempts, succeeded at attempt 2
    #1 FAIL (45ms): Missing test file for user-endpoints.ts
    #2 PASS (38ms)

VERDICT: PASS (3 checks, 1 retry, 103ms total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Functions

| Function | Purpose |
|----------|---------|
| `writeToTerminal(report)` | Detect TTY, format, write to stdout |
| `formatReport(report, { color })` | Pure function: report -> string (testable) |
| `formatHeader(report)` | Blueprint name + task |
| `formatChecks(checks)` | Check list with PASS/FAIL markers, dot leaders, timing |
| `formatRetries(retries)` | Retry timeline (only if retries exist) |
| `formatEscalation(escalation)` | Escalation reason + suggestion (only on failure) |
| `formatVerdict(report)` | Summary line with counts and total time |
| `formatDuration(ms)` | "12ms", "1.2s", "2m 3s" |

#### Color Strategy

- ANSI codes: green (pass), red (fail), yellow (warning), bold, dim, reset
- TTY detection: `process.stdout.isTTY === true`
- `colorize(text, code, colorEnabled)` — wraps text only when color is on
- Non-TTY: identical content, no escape codes

#### Test Cases

- **Formatting:** all-pass (no retries section), failures with details, retries with timeline, escalation block
- **Color:** TTY=true has ANSI codes, TTY=false does not, same content in both
- **Duration:** 0ms, 500ms, 1000ms->1.0s, 65000ms->1m 5s
- **Edge cases:** long check names, many retries, empty checks

---

### Phase 3: JSON Event Log

**File:** `tools/jsonLogger.ts` (~80 lines)
**Tests:** `tools/__tests__/jsonLogger.test.ts` (~120 lines)

#### Functions

| Function | Purpose |
|----------|---------|
| `writeReportToJSON(report, opts?)` | Write JSON file, return absolute path |
| `readReportFromJSON(path)` | Read previously written report |

#### Default Behavior

- Output: `{cwd}/docs/enforcement-report.json`
- Creates directories if missing (`mkdir -p`)
- Overwrites previous report (latest run wins; git tracks history)
- 2-space indented JSON
- Wrapped in `_meta` envelope:

```json
{
  "_meta": {
    "version": "1.0.0",
    "generatedAt": "2026-03-25T14:30:00.000Z",
    "generator": "vector-enforcer"
  },
  "report": { ... }
}
```

#### Test Cases

- **File I/O:** writes valid JSON, creates nested dirs, overwrites existing, returns absolute path
- **Content:** parseable JSON, `_meta.version` = "1.0.0", report fields match input
- **Errors:** read-only directory returns error (doesn't throw), empty report writes valid JSON
- **Cleanup:** tests use temp dirs, afterEach cleans up

---

### Phase 4: GitHub PR Commenter

**File:** `tools/ghPrCommenter.ts` (~150 lines)
**Tests:** `tools/__tests__/ghPrCommenter.test.ts` (~150 lines)

#### Functions

| Function | Purpose |
|----------|---------|
| `detectPRContext()` | Return `{ prNumber, branch }` or null |
| `renderMarkdown(report)` | EnforcementReport -> GitHub markdown string |
| `postPRComment({ prNumber, body, dryRun? })` | Post via `gh pr comment` |

#### PR Detection (tried in order)

1. `GITHUB_REF=refs/pull/123/merge` -> prNumber=123
2. `gh pr view --json number --jq '.number'` -> prNumber from CLI
3. Return null (not in PR context, skip posting)

#### Markdown Output

```markdown
## Vector Enforcement Report

**Blueprint:** implement-feature
**Task:** Add DELETE /users/:id endpoint

### Checks

| Check | Status | Duration | Details |
|-------|--------|----------|---------|
| commit-message | :white_check_mark: Pass | 12ms | |
| tests-exist | :white_check_mark: Pass | 38ms | Retry #2 |
| docs-updated | :white_check_mark: Pass | 8ms | |

<details>
<summary>Retry Details (1 retry)</summary>

**tests-exist** — 2 attempts, succeeded at #2
| Attempt | Status | Duration | Error |
|---------|--------|----------|-------|
| 1 | :x: Fail | 45ms | Missing test file for user-endpoints.ts |
| 2 | :white_check_mark: Pass | 38ms | |

</details>

**Verdict: PASS** — 3 checks, 1 retry, 103ms total

---
<sub>Generated by Vector Enforcer</sub>
```

#### Key Decisions

- Uses `gh` CLI (no token management, pre-installed in GitHub Actions)
- Collapsible retry details via `<details>` HTML tag
- GitHub emoji shortcodes (`:white_check_mark:`, `:x:`)
- `dryRun` mode renders markdown without posting
- Non-blocking: returns error object instead of throwing

#### Test Cases

- **PR detection:** from env vars, from gh CLI, both fail -> null
- **Markdown:** all-pass, with retries (collapsible), with escalation, empty checks
- **Posting:** success (mocked gh), gh not found, permission denied, dry run
- **Edge cases:** body > 65536 chars (truncate), PR closed

---

### Phase 5: Integration

**File:** `.pi/extensions/enforcer/reporter.ts` (~180 lines)
**Tests:** `.pi/extensions/enforcer/__tests__/reporter-integration.test.ts` (~200 lines)
**Modified:** `.pi/extensions/enforcer/index.ts` (+~20 lines)

#### Reporter Module

```typescript
interface ReporterOptions {
  cwd: string;
  gitBranch?: string;
  gitCommit?: string;
  enableTerminal?: boolean;  // default: true
  enableJSON?: boolean;      // default: true
  enablePRComment?: boolean; // default: true (auto-skips if not in PR)
  jsonOutputDir?: string;    // default: 'docs'
  dryRun?: boolean;          // default: false
}

async function reportEnforcementResults(
  report: EnforcementReport,
  options: ReporterOptions
): Promise<{
  terminal: boolean;
  jsonPath: string | null;
  prComment: { posted: boolean; error?: string } | null;
}>
```

#### Execution Flow

```
Enforcer runs validators (commit, tests, docs)
    |
    v
Build EnforcementReport from validation results
    |
    v
reportEnforcementResults(report, options)
    |
    +-- 1. Terminal Reporter  (try-catch, non-blocking)
    +-- 2. JSON Logger        (try-catch, non-blocking)
    +-- 3. PR Commenter       (try-catch, non-blocking, skips if no PR)
```

#### Enforcer Hook Changes

In `.pi/extensions/enforcer/index.ts`, after existing validation:

1. Build `EnforcementReport` from validator results using `createReport` + `addCheck` for each validator
2. Call `reportEnforcementResults(report, { cwd: ctx.cwd })`
3. Return original validation result unchanged (backward compatible)

#### Test Cases

- **Integration flow:** all pass -> all 3 renderers run; failures -> all 3 show failures
- **Renderer isolation:** terminal fails -> JSON + PR still run; JSON fails -> others unaffected
- **Backward compat:** enforcer returns same result with/without reporter
- **Config:** each renderer can be disabled independently; dryRun mode for PR

---

## 7. Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| ANSI codes break on non-TTY | Medium | TTY detection, plain text fallback, test both modes |
| `gh` CLI not available | Medium | Graceful error, log warning, don't block validation |
| JSON write fails (permissions) | Low | Try-catch, non-blocking, log warning |
| Report structure changes | Low | `_meta.version` in JSON enables format evolution |
| PR number detection fails | Medium | 3 fallback methods, null = skip posting |
| Markdown too long for GitHub | Low | Truncate at 65536 chars if needed |
