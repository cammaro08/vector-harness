# Exercise 2: Your First Check (fail → pass)

## Goal

Experience the full cycle of running Vector, seeing a failure, understanding retry/escalation output, and fixing the issue.

## Steps

### Step 1: Run a clean check

```bash
npx vector run v1
```

Observe the output. Both `test-pass` and `no-ts-errors` should PASS since the setup app is clean.

Expected terminal output:

```
[vector] Running vector 'v1' with 2 check(s):
  - test-pass: "npm test" (enabled)
  - no-ts-errors: "npx tsc --noEmit" (enabled)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VECTOR ENFORCEMENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Blueprint: v1
Task:      Running vector v1

CHECKS
  [PASS] test-pass .................... 1234ms
  [PASS] no-ts-errors ................. 567ms

VERDICT: PASS (2 checks, 1801ms total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[vector] All checks passed.
```

Notice:
- All checks passed on the first attempt
- The VERDICT line shows "PASS" with exit code 0
- Duration varies (these are real command timings)

### Step 2: Break something intentionally

Add a type error to `src/app.ts`:

```bash
# Open src/app.ts in your editor and add this line at the top:
const x: number = "hello";
```

### Step 3: Run checks on broken code

```bash
npx vector run v1
```

Observe the output:
- `test-pass` still passes (the type error doesn't affect runtime behavior)
- `no-ts-errors` FAILS with automatic retry attempts
- The process exits with code 1 (failure)

Expected terminal output with retries and escalation:

```
[vector] Running vector 'v1' with 2 check(s):
  - test-pass: "npm test" (enabled)
  - no-ts-errors: "npx tsc --noEmit" (enabled)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VECTOR ENFORCEMENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Blueprint: v1
Task:      Running vector v1

CHECKS
  [PASS] test-pass .................... 1234ms
  [FAIL] no-ts-errors ................. 890ms
         Command exited with code 1

RETRIES
  no-ts-errors: 4 attempts
    #1 FAIL (890ms): Command exited with code 1
    #2 FAIL (870ms): Command exited with code 1
    #3 FAIL (885ms): Command exited with code 1
    #4 FAIL (892ms): Command exited with code 1

ESCALATION
  Reason:     Check 'no-ts-errors' failed after 4 attempts
  Suggestion: Review the check configuration or the underlying command: npx tsc --noEmit

VERDICT: FAIL (2 checks, 1 retry, 4771ms total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[vector] Some checks failed. See report above.
```

Key observations:
- A type error is deterministic — it fails the same way every retry
- Vector retries by default (3 retries = 4 total attempts)
- Escalation section appears when retries are exhausted
- Exit code is 1 (indicating failure)

### Step 4: Fix the error

Remove the type error from `src/app.ts`:

```bash
# Remove the line: const x: number = "hello";
```

### Step 5: Verify the fix

```bash
npx vector run v1
```

Both checks should now pass again, exit code 0.

```
[vector] Running vector 'v1' with 2 check(s):
  - test-pass: "npm test" (enabled)
  - no-ts-errors: "npx tsc --noEmit" (enabled)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VECTOR ENFORCEMENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Blueprint: v1
Task:      Running vector v1

CHECKS
  [PASS] test-pass .................... 1234ms
  [PASS] no-ts-errors ................. 567ms

VERDICT: PASS (2 checks, 1801ms total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[vector] All checks passed.
```

## What You Learned

1. **Vector runs real commands** — It can't be fooled by mocks or workarounds. Type checking is actual TypeScript compilation.

2. **Automatic retries** — Failed checks retry automatically (default: 3 retries = 4 total attempts). This helps with flaky commands (e.g., network timeouts), but deterministic failures like type errors fail consistently.

3. **Escalation reporting** — When retries are exhausted, Vector provides an escalation section with context and suggestions to help you debug.

4. **Exit codes matter** —
   - Exit code 0 = all checks passed
   - Exit code 1 = any check failed
   - Use this for CI/CD pipelines and local git hooks

5. **Checks are independent** — A failure in one check (`no-ts-errors`) doesn't prevent other checks (`test-pass`) from running.
