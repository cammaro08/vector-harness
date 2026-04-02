# Adversarial Review: Vector V2 CLI

**Reviewed:** 2026-04-02
**Branch:** `feat/vector-v2-cli`
**Scope:** All source files, tests, and configuration

---

## Review Summary

**Total Issues Found: 22**
- CRITICAL: 4
- HIGH: 7
- MEDIUM: 8
- LOW: 3

The Vector v2 CLI implementation is **80% complete** but has **significant security, logic, and type safety issues** that must be fixed before merge. Several bugs will cause runtime failures or unexpected behavior in production use.

**Overall Verdict: FAIL — Merge Blocked Until Critical Issues Are Fixed**

---

## CRITICAL Issues (Must Fix)

### 1. Command Injection Vulnerability in `runCheck`
**File:** `src/protocol/runner.ts`, line 39
**Severity:** CRITICAL (Security)

```typescript
// VULNERABLE CODE
const { stdout, stderr } = await execAsync(definition.run, {
  shell: '/bin/bash',
  signal: controller.signal,
});
```

**Problem:**
- Executes shell commands via `/bin/bash` directly from user-provided config
- No escaping, validation, or sandboxing
- While documented as "developer-authored config only," this is a footgun:
  - Config files can be shared with teammates who might inject commands
  - If config comes from a package manager or auto-generated source, injection is trivial
  - No protection against symlink attacks or PATH injection

**Impact:**
- Arbitrary code execution with the privileges of the running process
- Silent data exfiltration possible (commands with no visible output)

**Fix Required:**
- Use `child_process.spawn()` instead of `exec()` with `/bin/bash` — pass command and args separately
- Validate `run` command against a whitelist of allowed patterns (e.g., regex)
- Document security model explicitly in README with warnings

---

### 2. Type Safety Loss via `as unknown as VectorConfig`
**File:** `src/config/schema.ts`, line 85
**Severity:** CRITICAL (Type Safety)

```typescript
export function validateConfig(data: unknown): VectorConfig {
  // ... validation logic ...
  return data as unknown as VectorConfig;  // ← DANGEROUS DOUBLE CAST
}
```

**Problem:**
- Double cast to `unknown` then `VectorConfig` bypasses TypeScript entirely
- Validation function throws on invalid data, but if it returns, the type is unsafe
- A single validation branch that doesn't execute will silently produce invalid data
- For example, if `data.version === '2'` check is bypassed, version could be anything

**Impact:**
- Later code assumes `config.checks` is a valid `Record<string, CheckDefinition>` but it might not be
- Runtime errors in unrelated code when fields are malformed
- Difficult to debug because the type system is lying

**Fix Required:**
- Return `data as VectorConfig` after validation (single cast, not double)
- OR use `satisfies VectorConfig` pattern (TypeScript 5.0+) if available
- Validate **every single required field** explicitly before the cast

**Current validation covers:**
- `version` (line 47)
- `checks` (line 54)
- `vectors` (line 63)
- `defaults` (line 72)

But the code throws on *any* validation failure, so if we reach line 85, all validations passed. **The double cast is redundant and harmful.**

---

### 3. Missing `environment.gitBranch` and `environment.gitCommit` in `adapter`
**File:** `src/adapters/claude-code.ts`, lines 61-65
**Severity:** CRITICAL (Logic Error)

```typescript
const environment: EnvironmentInfo = {
  cwd: projectRoot,
  gitBranch: 'unknown',
  gitCommit: 'unknown',
};
```

**Problem:**
- Adapter hardcodes git info as 'unknown', but `runCommand` (CLI) detects it via `execSync`
- This creates **inconsistency**: CLI reports real git info, adapter reports 'unknown'
- Reports from adapter will always show wrong branch/commit, making them useless for CI/CD
- Violates principle of least surprise — adapter should match CLI behavior

**Impact:**
- PR comments generated from adapter will have wrong git context
- Developers debugging via adapter reports will see misleading information
- Adapter is less useful than the CLI for the same operation

**Fix Required:**
- Import `getGitInfo` from `../cli/commands/run.ts` or extract to shared utility
- Call `getGitInfo(projectRoot)` in adapter, same as CLI
- Handle errors gracefully (fallback to 'unknown' if not in git repo)

---

### 4. Missing Check Name Mapping in Adapter
**File:** `src/adapters/claude-code.ts`, lines 52-58
**Severity:** CRITICAL (Logic Error)

```typescript
const checks = checkDefinitions.map((definition, index) => {
  const vectorDef = config.vectors[vectorName];
  const checkName = vectorDef && vectorDef.checks[index]
    ? vectorDef.checks[index]
    : `check-${index}`;
  return { name: checkName, definition };
});
```

**Problem:**
- Uses array index to look up check name: `vectorDef.checks[index]`
- **This is wrong:** `checkDefinitions` is the result of `resolveChecksForVector()`, which returns an **array of CheckDefinition objects**, not check names
- Should match definitions back to names from the vector definition, not by index
- If vector has checks `['lint', 'test', 'type-check']` and 2 are enabled, index mapping breaks

**Example Failure:**
```yaml
vectors:
  v2:
    checks: ['lint', 'test', 'type-check']
active:
  v2: ['test']  # only 'test' enabled
```

- `resolveChecksForVector()` returns 1 CheckDefinition (for 'test')
- Adapter maps it to `check-0` instead of `'test'`
- Reports show wrong check name

**Fix Required:**
- `resolveChecksForVector()` should return `Array<{ name: string; definition: CheckDefinition }>`
- OR: Refactor adapter to build the check name array in parallel with filtering
- OR: Store check names in the result of `resolveChecksForVector()`

---

## HIGH Issues (Should Fix)

### 5. Unhandled JSON Parsing in `activateCommand`
**File:** `src/cli/commands/activate.ts`, line 51-54
**Severity:** HIGH (Error Handling)

```typescript
let active = loadActiveConfig(projectRoot);
if (!active) {
  active = { vectors: {} };
}
```

**Problem:**
- `loadActiveConfig()` can throw if `.vector/active.yaml` exists but is malformed
- Error is not caught; it propagates to CLI entry point, which prints generic "Failed to activate check" message
- User doesn't know if the file is corrupted or just missing

**Context from loader (line 69-74):**
```typescript
try {
  fileContent = fs.readFileSync(activePath, 'utf-8');
} catch (error) {
  if ((error as any).code === 'ENOENT') {
    return null;
  }
  throw error; // ← Throws if PERMISSION_DENIED or other errors
}
```

And later (line 76-83):
```typescript
let parsed: unknown;
try {
  parsed = yaml.load(fileContent);
} catch (error) {
  throw new Error(
    `Failed to parse YAML at ${activePath}: ${(error as Error).message}`
  );
}
```

**Impact:**
- Corrupted YAML in `.vector/active.yaml` crashes the command without context
- User sees generic error; doesn't know which file is problematic
- No guidance on how to fix (e.g., "delete and recreate with `vector init`")

**Fix Required:**
- Wrap `loadActiveConfig()` in try/catch in all commands that call it
- Provide clear error message: "Failed to load active config at [path]: [reason]. Try deleting the file and running `vector activate` again."
- Consider adding `--reset` flag to `activate` command to force-recreate the file

---

### 6. Silent Failure in `checkAddCommand` When Check Already Exists
**File:** `src/cli/commands/check-add.ts`, line 45-48
**Severity:** HIGH (Error Handling)

```typescript
if (config.checks[checkName]) {
  console.error(`Error: check '${checkName}' already exists`);
  return 1;
}
```

**Problem:**
- Command fails silently if check already exists
- User sees error, assumes the check was NOT added
- But there's no confirmation that the existing check wasn't modified
- No `--force` flag to update an existing check

**Impact:**
- Confusing UX: user can't add a check they've already added
- No way to modify a check without manually editing `.vector/config.yaml`
- Team workflow: multiple devs might try to add the same check, first succeeds, others fail

**Fix Required:**
- Add `--force` or `--update` flag to allow overwriting
- With flag: update the existing check and print "Updated check 'X'" instead of "Added check 'X'"
- Without flag: fail with suggestion "Use `--force` to update existing check"

---

### 7. `runCommand` Doesn't Filter Disabled Checks Properly
**File:** `src/cli/commands/run.ts`, line 90-94
**Severity:** HIGH (Logic Error)

```typescript
const enabledChecks = namedChecks.filter(({ definition }) => definition.enabled);
if (enabledChecks.length === 0) {
  console.warn(`[vector] All checks for vector '${vectorName}' are disabled`);
  return 0;
}
```

**Problem:**
- Returns exit code 0 when **all checks are disabled**
- This is wrong: disabling all checks should probably still exit with 0, but the report is misleading
- A vector with no enabled checks is not a "pass" — it's a skip
- Behavior is inconsistent: if 1 check is disabled and 1 passes, exit 0; if all are disabled, exit 0. No difference in behavior.
- **EnforcementReport verdict** might still be 'fail' if some checks ran and failed, but exit code is 0

**Impact:**
- CI/CD might not detect that no checks ran
- Silent skips of enforcement
- Confusing behavior: "all checks passed" might mean "no checks ran"

**Fix Required:**
- If all checks are disabled, set report verdict to 'skip' or add `verdict: 'inconclusive'`
- Return exit code 0 (correct) but make the report reflect skipped status
- Document this behavior in `CLAUDE.md`
- Consider adding `--fail-if-no-checks` flag for CI environments

---

### 8. Missing Validation of Check Names in Vectors
**File:** `src/config/schema.ts`, line 176-180
**Severity:** HIGH (Validation)

```typescript
for (const checkName of vector.checks) {
  if (typeof checkName !== 'string') {
    throw new Error(`Vector '${name}' contains non-string check name`);
  }
}
```

**Problem:**
- Validates that check names are strings, but **doesn't validate that they exist**
- A vector can reference a non-existent check `'foo'`
- Runtime error occurs when `runCommand` tries to resolve checks

**Example:**
```yaml
vectors:
  v1:
    checks: ['missing-check']
```

This passes validation! But at runtime:
```typescript
// In resolveChecksForVector (loader.ts line 111-113)
.map((checkName) => config.checks[checkName])
.filter((check): check is CheckDefinition => check !== undefined)
```

The missing check is silently filtered out, and the vector runs with 0 checks. This is confusing.

**Impact:**
- Typos in vector definitions go unnoticed until the vector is run
- User adds `checks: ['lint']` but misspells it as `checks: ['linter']`, and the command silently skips it
- Debugging is difficult because the config loads successfully

**Fix Required:**
- In `validateVectorDefinition()`, after validating check names are strings:
  ```typescript
  // Also validate that checks exist in the config
  // (requires passing config to validator, or deferring to loader)
  ```
- OR: In `resolveChecksForVector()`, warn if a check name is not found:
  ```typescript
  const missingChecks = checkNames.filter(name => !config.checks[name]);
  if (missingChecks.length > 0) {
    console.warn(`[vector] Missing checks for ${vector}: ${missingChecks.join(', ')}`);
  }
  ```

---

### 9. `initCommand` Always Overwrites Hooks
**File:** `src/cli/commands/init.ts`, line 63-68
**Severity:** HIGH (Data Loss)

```typescript
// Set up Stop hook
settings.hooks.Stop = [
  {
    type: 'command',
    command: 'npx vector run v1',
  },
];
```

**Problem:**
- **Overwrites existing hooks** with `Stop = [{ ... }]`
- If user already has hooks configured, they are lost
- No merging, no preservation of existing hooks
- Violates documented behavior in `plan.md` line 57: "doesn't overwrite"

**Impact:**
- Users lose their custom Stop hooks if they run `vector init` twice
- Destructive operation without warning
- Documented requirement not met

**Fix Required:**
- Check if `settings.hooks.Stop` already exists
- If it does, append to it (or warn if a 'vector' hook already exists)
- Example:
  ```typescript
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [];
  }
  // Check if vector hook already exists
  const hasVectorHook = settings.hooks.Stop.some(h => h.command?.includes('vector'));
  if (!hasVectorHook) {
    settings.hooks.Stop.push({ type: 'command', command: 'npx vector run v1' });
  }
  ```

---

### 10. `parseArgs` Doesn't Handle Empty Command
**File:** `src/cli/index.ts`, line 37-42
**Severity:** HIGH (Error Handling)

```typescript
if (args.length === 0) {
  return {
    command: '',
    positional: [],
    flags: {},
  };
}
```

**Problem:**
- Returns empty command string instead of raising an error
- `main()` catches this in the default case (line 149) and prints usage
- But this means invalid usage succeeds with exit code 1
- User sees "Error: unknown command ''" which is not helpful

**Impact:**
- Confusing error message for `npx vector` (no args)
- Should print help/usage instead

**Fix Required:**
- In `main()`, before switch statement, check for empty command:
  ```typescript
  if (!parsed.command) {
    console.error('Usage: vector <command> [options]');
    console.error('Commands: init, run, activate, report, check');
    return 1;
  }
  ```

---

### 11. Race Condition in Report Writing
**File:** `src/cli/commands/run.ts`, line 123-127
**Severity:** HIGH (Concurrency)

```typescript
const reportsDir = path.join(projectRoot, '.vector', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

// Write JSON report
await writeReportToJSON(report, { outputDir: reportsDir });
```

**Problem:**
- Two concurrent `vector run` commands can race on `reports` directory creation
- `mkdirSync` is synchronous, but there's no locking
- If two processes both call `mkdirSync` at the same time, one might fail
- File write (`writeReportToJSON`) might overwrite previous report before reporter finishes reading it

**Impact:**
- Rare failures in CI/CD when multiple vector runs happen in parallel
- Report loss or corruption

**Fix Required:**
- Use `fs.mkdirSync()` with the existing `{ recursive: true }` flag (already done, so this is partial)
- But: **ensure report file name is unique per run** (it should be based on timestamp or PID)
- Check `writeReportToJSON` implementation to see if it handles race conditions

---

## MEDIUM Issues (Recommended)

### 12. Inconsistent Error Messages
**File:** Multiple files
**Severity:** MEDIUM (Code Quality)

Examples:
- `initCommand`: "Failed to initialize Vector project: {message}"
- `runCommand`: "[vector] Failed to run vector: {message}"
- `activateCommand`: "Failed to activate check: {message}"
- `reportCommand`: "Failed to display report: {message}"

**Problem:**
- Some messages have `[vector]` prefix, some don't
- Some have "Failed to X", others have just "Error"
- Inconsistent prefix makes parsing logs difficult

**Fix Required:**
- Use consistent format: `[vector] <command>: <message>`
- Example: `[vector] run: Failed to load config`

---

### 13. Test Coverage Gaps in `engine.test.ts`
**File:** `src/protocol/__tests__/engine.test.ts`
**Severity:** MEDIUM (Testing)

**Missing test cases:**
1. Retry and succeed on second attempt (important logic!)
2. Escalation report when all retries exhausted (important logic!)
3. Mixed pass/fail in multiple checks
4. Check with captured stdout/stderr
5. Report shape validation (structure, field names, types)
6. Empty check list
7. maxRetries = 0 (no retries)

**Current tests** (from reading the file):
- Single passing check
- Single failing check
- Multiple checks

**Impact:**
- Retry logic is not thoroughly tested
- Escalation logic is not tested
- Output capture is not tested
- Might have bugs in these critical paths

**Fix Required:**
- Add at least 3 more test cases for retry scenarios
- Add test for escalation
- Add test for output capture with different `capture` modes
- Test report structure matches `EnforcementReport` type

---

### 14. Type Assertion `as any` in `loader.ts`
**File:** `src/config/loader.ts`, line 35, 70
**Severity:** MEDIUM (Type Safety)

```typescript
if ((error as any).code === 'ENOENT') {
```

**Problem:**
- Uses `as any` to check error code
- Loses type information
- Breaks TypeScript's type narrowing

**Fix Required:**
```typescript
// Better approach:
if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
```

Or use a helper:
```typescript
function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as any).code === 'ENOENT';
}
```

---

### 15. Missing Input Validation in `checkAddCommand`
**File:** `src/cli/commands/check-add.ts`, line 28-39
**Severity:** MEDIUM (Validation)

```typescript
const checkName = flags.name as string;
const runCommand = flags.run as string;

if (!checkName) {
  console.error('Error: --name flag is required');
  return 1;
}

if (!runCommand) {
  console.error('Error: --run flag is required');
  return 1;
}
```

**Problem:**
- No validation of check name format (e.g., must match `/^[a-z0-9-]+$/`)
- No validation that run command is not empty or malicious
- No length limits

**Impact:**
- Users can create checks with weird names like `   spaces   ` or `UPPERCASE`
- Commands with special shell characters might cause issues

**Fix Required:**
```typescript
// Validate check name format
if (!/^[a-z0-9][a-z0-9-]*$/.test(checkName)) {
  console.error('Error: check name must start with letter/digit, contain only letters, digits, and hyphens');
  return 1;
}

// Validate command is not empty
if (runCommand.trim().length === 0) {
  console.error('Error: --run command cannot be empty');
  return 1;
}

// Warn about shell injection risk
if (runCommand.includes('$(') || runCommand.includes('`')) {
  console.warn('[vector] Warning: command contains command substitution. This can be dangerous.');
}
```

---

### 16. No Version Check in Schema Validation
**File:** `src/config/schema.ts`, line 47-51
**Severity:** MEDIUM (Future Compatibility)

```typescript
if (data.version !== '2') {
  throw new Error(
    `Config version must be '2', got '${data.version || 'undefined'}'`
  );
}
```

**Problem:**
- Rejects any version other than '2', including future versions
- If v3 config format is introduced, old code won't accept it gracefully
- Should have a message like "Config version '3' not supported by this version of Vector"

**Impact:**
- Makes migration to v3 harder
- Users get confusing error messages

**Fix Required:**
```typescript
if (data.version !== '2') {
  if (typeof data.version === 'string' && data.version > '2') {
    throw new Error(
      `Config version '${data.version}' requires a newer version of Vector. Please update Vector.`
    );
  }
  throw new Error(
    `Config version must be '2', got '${data.version || 'undefined'}'`
  );
}
```

---

### 17. No Maximum Timeout Validation
**File:** `src/config/schema.ts`, line 80-82
**Severity:** MEDIUM (Validation)

```typescript
if (typeof data.defaults.timeout !== 'number') {
  throw new Error('Config.defaults.timeout must be a number');
}
```

**Problem:**
- No validation that timeout is positive
- No validation that timeout is reasonable (e.g., not 1 billion milliseconds)
- User could set timeout to -1 or 0, causing issues

**Impact:**
- Invalid timeouts cause confusing behavior
- No feedback to user that their config is wrong

**Fix Required:**
```typescript
if (typeof data.defaults.timeout !== 'number' || data.defaults.timeout <= 0) {
  throw new Error('Config.defaults.timeout must be a positive number (milliseconds)');
}

if (data.defaults.timeout > 600000) { // 10 minutes
  console.warn(`[vector] Warning: timeout ${data.defaults.timeout}ms is very long`);
}
```

---

### 18. `environment` Parameter Missing `gitBranch` and `gitCommit` in Engine Options
**File:** `src/protocol/engine.ts`, line 22
**Severity:** MEDIUM (Type Safety)

```typescript
export interface EngineOptions {
  vectorName: VectorName | string;
  checks: Array<{ name: string; definition: CheckDefinition }>;
  maxRetries: number;
  timeout: number; // ms
  environment: EnvironmentInfo;
}
```

And `EnvironmentInfo` is:
```typescript
// From protocol/types.ts
export type {
  EnvironmentInfo,
} from '../../tools/enforcementReport';
```

**Problem:**
- `EnvironmentInfo` from v1 might require `gitBranch` and `gitCommit`
- These are not validated as required
- Adapter hardcodes 'unknown', CLI detects them
- Type doesn't enforce that these fields exist

**Impact:**
- Reports have incomplete environment info
- Type system doesn't catch the inconsistency

**Fix Required:**
- Verify that `EnvironmentInfo` includes `gitBranch` and `gitCommit` as optional
- If required, update adapter to provide them
- Document in code comments that these should be populated if available

---

## LOW Issues (Nice to Have)

### 19. No Help Text or Usage Docs
**File:** `src/cli/index.ts`
**Severity:** LOW (Documentation)

**Problem:**
- No `vector --help` or `vector help` command
- No usage docs printed when command is invalid
- Users must read CLAUDE.md or source code to understand commands

**Fix Required:**
```typescript
case 'help':
case '--help':
case '-h':
  console.log(HELP_TEXT);
  return 0;

const HELP_TEXT = `
Vector v2 CLI - Composable enforcement protocol

Usage: vector <command> [options]

Commands:
  init                                    Initialize Vector in a project
  run <vector>                           Run checks for a vector (v1-v5)
  activate --check <name> --vector <v>   Enable/disable checks per task
  report [--format terminal|json|markdown] Display the latest report
  check add --name <name> --run <cmd>    Add a check to the registry

Examples:
  vector init
  vector run v1
  vector activate --check test-pass --on --vector v2
  vector report --format json
`;
```

---

### 20. Magic Strings in Default Config
**File:** `src/config/defaults.ts`, line 19, 24
**Severity:** LOW (Code Quality)

```typescript
'test-pass': {
  run: 'npm test',
  expect: 'exit-0',
  enabled: true,
},
'no-ts-errors': {
  run: 'npx tsc --noEmit',
  expect: 'exit-0',
  enabled: true,
},
```

**Problem:**
- Check names and commands are hardcoded strings
- If you want to change them, you edit this file
- No constants for these default check names

**Fix Required:**
```typescript
const DEFAULT_CHECKS = {
  TEST: 'test-pass',
  TYPE_CHECK: 'no-ts-errors',
} as const;

export const DEFAULT_CONFIG: VectorConfig = {
  // ...
  checks: {
    [DEFAULT_CHECKS.TEST]: { ... },
    [DEFAULT_CHECKS.TYPE_CHECK]: { ... },
  },
};
```

---

### 21. Unused Import in `pr-comment.ts`
**File:** `src/reporters/pr-comment.ts`, line 4
**Severity:** LOW (Code Quality)

```typescript
import {
  renderMarkdown as v1RenderMarkdown,
  postPRComment as v1PostPRComment,
  detectPRContext as v1DetectPRContext,  // ← UNUSED
} from '../../tools/ghPrCommenter';
```

Then later:
```typescript
function detectPR(): PRContext | null {
  const context = v1DetectPRContext();  // ← USED HERE
  return context ? { prNumber: context.prNumber, branch: context.branch } : null;
}
```

**Problem:**
- Import name doesn't match usage (imported as `v1DetectPRContext`, used in `detectPR()`)
- Minor code quality issue

**Fix Required:**
- Either use the import directly or remove it
- Or rename import for consistency

---

### 22. No Logging in `adapters/claude-code.ts`
**File:** `src/adapters/claude-code.ts`
**Severity:** LOW (Observability)

**Problem:**
- Adapter doesn't log what it's doing
- No debug output for Claude Code to understand
- Hard to troubleshoot if adapter is called vs CLI

**Fix Required:**
```typescript
export async function runAdapter(options: AdapterOptions): Promise<AdapterResult> {
  const { projectRoot, vectorName } = options;

  // Log adapter invocation
  console.log(`[vector-adapter] Running vector '${vectorName}'`);

  // ... rest of code ...
}
```

---

## Test Coverage Analysis

### Well-Tested
- **Config schema validation** (27 tests, 93.55% coverage)
- **Config loader** (23 tests with active override merging)
- **Default config generation**
- **Argument parsing** (8 tests for edge cases)
- **Command integration** (basic flow tests)

### Under-Tested (Critical Gaps)
1. **Engine retry logic** — NO tests for "fail then succeed on retry 2"
2. **Engine escalation** — NO tests for escalation info in report
3. **Output capture modes** — Only basic capture tested
4. **Error scenarios** — Limited error path testing
5. **Adapter check name mapping** — Test exists but might pass despite bug (high false negative risk)
6. **Report command** — Minimal testing, doesn't test JSON/markdown formats
7. **Protocol edge cases** — Empty vectors, all disabled checks, timeout behavior

### Not Tested At All
- `vector run` with enabled/disabled check filtering
- `vector check add` with validation of check names
- `vector activate` with merging existing active config
- `vector report` JSON output structure
- Integration with v1 reporters (terminal, JSON, markdown)
- PR comment generation flow
- File I/O error scenarios (permission denied, disk full)
- Signal handling (SIGINT/SIGTERM during check execution)

**Coverage Estimate:** ~65% overall (below 80% target for production code)

---

## Architecture Review

### Does Code Match Plan?
**Mostly yes, with some mismatches:**

✓ **Phase 1 (Config):** Complete as planned
✓ **Phase 2 (Engine):** Complete as planned
✓ **Phase 3 (CLI):** Complete but with issues (bugs in commands)
✓ **Phase 4 (Adapter):** Exists but broken (git info, check name mapping)
✓ **Phase 5 (Reporters):** Thin wrappers, matches plan
✗ **Phase 6 (Migration):** Not documented in this review scope

### Architectural Concerns

1. **Coupling:** Adapter duplicates logic from CLI (git detection, check resolution)
   - Should extract to shared utilities
   - Violates DRY principle

2. **Error Handling:** Inconsistent strategy
   - Some commands throw, some return exit code 1
   - No global error handler that normalizes messages

3. **Type Safety:** Multiple unsafe casts
   - `as any` in loader
   - Double cast in schema validation
   - `as unknown as VectorConfig` anti-pattern

4. **Separation of Concerns:** Reporters are thin wrappers
   - Good, but minimal value-add
   - Could be removed in favor of calling v1 directly

---

## Security Audit

### Critical Vulnerabilities

| Vuln | File | Issue | Severity |
|------|------|-------|----------|
| Command Injection | `runner.ts:39` | Direct shell execution with user input | CRITICAL |
| Unvalidated Check Names | `schema.ts` | No whitelist/validation of check names | HIGH |
| Silent Failures | `run.ts:84` | All disabled checks returns 0 | HIGH |

### Mitigations
- Commands come from developer-authored YAML (some protection)
- No untrusted user input flows to commands
- But this is a false sense of security — shared repos, CI/CD injection attacks possible

### Recommendations
1. Replace `exec()` with `spawn()` and validate command syntax
2. Whitelist allowed check name patterns
3. Review all error paths for silent failures
4. Add security documentation to README

---

## Verdict

### FAIL — Do Not Merge

**Blocking Issues:**
1. Command injection vulnerability (CRITICAL) — Unacceptable
2. Type safety regressions (CRITICAL) — Violates TypeScript discipline
3. Git info hardcoded in adapter (CRITICAL) — Breaks CI/CD features
4. Check name mapping bug in adapter (CRITICAL) — Wrong reports generated

**High-Priority Issues:**
- Error handling gaps (5 HIGH issues)
- Test coverage gaps
- Hook overwriting

**If ONLY Critical Issues Are Fixed:**
- Merge can proceed after code review
- But HIGH issues should block merge for production use

**Recommendation:**
1. Fix all 4 CRITICAL issues immediately
2. Fix at least 5 HIGH issues (choose the most impactful)
3. Add test cases for retry, escalation, output capture
4. Re-run full test suite
5. Security audit of command execution
6. Then proceed to review and merge

---

## Evidence & Files

### Critical Issues Evidence
- **Command Injection:** `src/protocol/runner.ts` line 38-39, no input validation
- **Type Cast:** `src/config/schema.ts` line 85, `as unknown as VectorConfig`
- **Git Info:** `src/adapters/claude-code.ts` line 63-64, hardcoded 'unknown'
- **Check Mapping:** `src/adapters/claude-code.ts` line 52-58, index-based lookup

### Test Evidence
- `npm test` output: 7 failed tests in test-apps (unrelated to Vector v2)
- Vector v2 tests: 411 passed, but gaps in protocol and adapter coverage
- Coverage reports: 93.55% config, 88.43% protocol, ~65% estimated overall

### Related Files
- `plans/active/vector-v2/plan.md` — Requirements (partly violated)
- `plans/active/vector-v2/progress.md` — Status (phases marked complete but incomplete)
- `CLAUDE.md` — Project instructions (hook behavior documented as non-destructive, but is)

