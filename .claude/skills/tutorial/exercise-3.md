# Exercise 3: Multiple Checks & Vectors

## Goal

Learn to add custom checks, compose them into vectors, and run different vectors for different contexts. You'll discover how checks are independent, reusable building blocks that can be grouped into named vectors for quick feedback (v1) or comprehensive validation (v2).

## Steps

### Step 1: Install ESLint

Install ESLint and its JavaScript configuration:

```bash
npm install -D eslint @eslint/js
```

### Step 2: Create `eslint.config.js`

Create the ESLint configuration file at the project root:

```javascript
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
  },
];
```

### Step 3: Add a Lint Check

Register a new lint check in your vector configuration:

```bash
npx vector check add --name lint --run "npx eslint src/"
```

### Step 4: Verify Check Registration

Open `.vector/config.yaml` and confirm the new lint check appears under `checks`:

```yaml
checks:
  test-pass:
    run: npm test -- --run
  no-ts-errors:
    run: npx tsc --noEmit
  lint:
    run: npx eslint src/
```

**Key observation:** The lint check is registered but not yet assigned to any vector. Checks are independent building blocks.

### Step 5: Create Two Vectors

Edit `.vector/config.yaml` to define two vectors that compose checks differently:

```yaml
vectors:
  v1:
    trigger: Quick — tests only
    checks:
      - test-pass
  v2:
    trigger: Full — tests + types + lint
    checks:
      - test-pass
      - no-ts-errors
      - lint
```

- **v1:** Fast feedback loop with just tests (1 check)
- **v2:** Comprehensive pre-commit validation (3 checks)

### Step 6: Run v1 (Quick Feedback)

Execute the quick vector:

```bash
npx vector run v1
```

**Expected behavior:**
- Only the `test-pass` check runs
- Completes quickly
- Terminal and JSON output show 1 check result

### Step 7: Run v2 (Full Validation)

Execute the comprehensive vector:

```bash
npx vector run v2
```

**Expected behavior:**
- All 3 checks run in sequence: test-pass, no-ts-errors, lint
- Takes longer than v1 due to additional checks
- Terminal and JSON output show all 3 check results
- All checks pass (assuming no existing errors)

### Step 8: Introduce a Lint Error

Add a deliberate lint violation to trigger the lint check failure. Open `src/app.ts` and add this line:

```typescript
var unused = 42;
```

Run v2 again:

```bash
npx vector run v2
```

**Expected behavior:**
- `test-pass` still passes (no test changes)
- `no-ts-errors` still passes (valid TypeScript, just unused variable)
- `lint` fails (ESLint catches unused variable declaration)
- Terminal output shows mixed results (2 pass, 1 fail)
- JSON report includes the lint failure details

### Step 9: Fix and Verify

Remove the lint error from `src/app.ts` and run v2 again:

```bash
npx vector run v2
```

**Expected behavior:**
- All 3 checks pass again
- v2 is ready for commit

## Expected Output

### v1 Output (Step 6)

```
[vector] Running vector 'v1' with 1 check(s):
  - test-pass: "npm test -- --run" (enabled)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VECTOR ENFORCEMENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Blueprint: v1
Task:      Running vector v1

CHECKS
  [PASS] test-pass .................... 250ms

VERDICT: PASS (1 check, 250ms total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[vector] All checks passed.
```

### v2 Output (Step 7)

```
[vector] Running vector 'v2' with 3 check(s):
  - test-pass: "npm test -- --run" (enabled)
  - no-ts-errors: "npx tsc --noEmit" (enabled)
  - lint: "npx eslint src/" (enabled)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VECTOR ENFORCEMENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Blueprint: v2
Task:      Running vector v2

CHECKS
  [PASS] test-pass .................... 250ms
  [PASS] no-ts-errors ................. 1200ms
  [PASS] lint .......................... 800ms

VERDICT: PASS (3 checks, 2250ms total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[vector] All checks passed.
```

### v2 with Lint Failure (Step 8)

```
[vector] Running vector 'v2' with 3 check(s):
  - test-pass: "npm test -- --run" (enabled)
  - no-ts-errors: "npx tsc --noEmit" (enabled)
  - lint: "npx eslint src/" (enabled)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VECTOR ENFORCEMENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Blueprint: v2
Task:      Running vector v2

CHECKS
  [PASS] test-pass .................... 250ms
  [PASS] no-ts-errors ................. 1200ms
  [FAIL] lint .......................... 900ms
         Command exited with code 1

RETRIES
  lint: 4 attempts
    #1 FAIL (900ms): Command exited with code 1
    #2 FAIL (890ms): Command exited with code 1
    #3 FAIL (895ms): Command exited with code 1
    #4 FAIL (885ms): Command exited with code 1

ESCALATION
  Reason:     Check 'lint' failed after 4 attempts
  Suggestion: Review the check configuration or the underlying command: npx eslint src/

VERDICT: FAIL (3 checks, 1 retry, 3970ms total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[vector] Some checks failed. See report above.
```

JSON report shows:

```json
{
  "id": "v2-...",
  "blueprintName": "v2",
  "taskDescription": "Running vector v2",
  "verdict": "fail",
  "checks": [
    {
      "checkName": "test-pass",
      "status": "passed",
      "duration": 250,
      "details": { "message": "passed\nStdout: ..." }
    },
    {
      "checkName": "no-ts-errors",
      "status": "passed",
      "duration": 1200,
      "details": { "message": "passed\nStdout: ..." }
    },
    {
      "checkName": "lint",
      "status": "failed",
      "duration": 900,
      "details": { "message": "Command exited with code 1\nStdout: ...\nStderr: ..." }
    }
  ],
  "retries": [
    {
      "checkName": "lint",
      "attempts": [
        { "status": "failed", "duration": 900, "message": "Command exited with code 1" },
        { "status": "failed", "duration": 890, "message": "Command exited with code 1" },
        { "status": "failed", "duration": 895, "message": "Command exited with code 1" },
        { "status": "failed", "duration": 885, "message": "Command exited with code 1" }
      ]
    }
  ],
  "escalation": {
    "reason": "Check 'lint' failed after 4 attempts",
    "suggestion": "Review the check configuration or the underlying command: npx eslint src/"
  },
  "timestamp": "...",
  "totalDuration": 3970,
  "environment": { "cwd": "...", "gitBranch": "...", "gitCommit": "..." }
}
```

## What You Learned

- **Checks are independent, reusable building blocks.** Register once with `check add`, use in multiple vectors.

- **Vectors compose checks for different contexts.** v1 is quick (tests only), v2 is thorough (tests + types + lint). Use v1 during development for fast feedback, v2 before committing.

- **`check add` registers, doesn't auto-compose.** You must manually edit `.vector/config.yaml` to assign a check to a vector.

- **Failed checks don't stop the pipeline.** All checks run even if one fails, so you see the complete picture in one run.

- **Mixed results show real-world complexity.** A lint failure can happen independently of test success—useful for understanding which layer broke.

- **JSON reports enable tooling.** Parse the JSON output in your CI/CD or IDE integration for structured access to check results.

## Next Steps

Try these variations:

1. **Add more vectors:** Create a v3 with custom checks (e.g., security scanning, performance benchmarks).

2. **Override at task level:** Use `.vector/active.yaml` to toggle checks per task (e.g., disable lint for quick prototyping).

3. **Integrate with Git hooks:** Run `npx vector run v2` in a pre-commit hook to prevent commits with lint errors.

4. **View the report:** Run `npx vector report` or `npx vector report --format json` to inspect results programmatically.
