# Exercise 4: Retries & Escalation

## Goal

Deep-dive into Vector's retry mechanism and escalation behavior. Understand attempt history, timing, and how to configure `maxRetries`.

## Steps

### 1. Create a "flaky" check that fails randomly

```bash
npx vector check add --name flaky-test --run "bash -c '[ \$((RANDOM % 2)) -eq 0 ] && exit 0 || exit 1'"
```

This check succeeds 50% of the time, allowing you to observe retry behavior in action.

### 2. Add `flaky-test` to v1 in `.vector/config.yaml`

```yaml
vectors:
  v1:
    trigger: Quick checks
    checks:
      - test-pass
      - flaky-test
```

### 3. Run `npx vector run v1` multiple times

Observe the behavior:
- Sometimes `flaky-test` passes on the first attempt
- Sometimes it needs retries (shown in the RETRIES section with attempt history and timing)
- The RETRIES section displays each attempt number, status, and duration

Run it 3–4 times to catch both success and failure paths.

### 4. Create a check that always fails

```bash
npx vector check add --name always-fail --run "exit 1"
```

### 5. Add `always-fail` to v1 and observe full escalation

Update `.vector/config.yaml`:

```yaml
vectors:
  v1:
    trigger: Quick checks
    checks:
      - test-pass
      - flaky-test
      - always-fail
```

Run:

```bash
npx vector run v1
```

Expected behavior:
- 4 attempts total for `always-fail` (1 initial + 3 retries, since `maxRetries` defaults to 3)
- RETRIES section showing all 4 failed attempts with timing
- ESCALATION section explaining why the check escalated
- VERDICT: FAIL

Expected terminal output:

```
[vector] Running vector 'v1' with 3 check(s):
  - test-pass: "npm test -- --run" (enabled)
  - flaky-test: "bash -c '[ $((RANDOM % 2)) -eq 0 ] && exit 0 || exit 1'" (enabled)
  - always-fail: "exit 1" (enabled)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VECTOR ENFORCEMENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Blueprint: v1
Task:      Running vector v1

CHECKS
  [PASS] test-pass .................... 1234ms
  [PASS] flaky-test ................... 876ms
  [FAIL] always-fail .................. 12ms
         Command exited with code 1

RETRIES
  always-fail: 4 attempts
    #1 FAIL (12ms): Command exited with code 1
    #2 FAIL (10ms): Command exited with code 1
    #3 FAIL (11ms): Command exited with code 1
    #4 FAIL (10ms): Command exited with code 1

ESCALATION
  Reason:     Check 'always-fail' failed after 4 attempts
  Suggestion: Review the check configuration or the underlying command: exit 1

VERDICT: FAIL (3 checks, 1 retry, 2143ms total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[vector] Some checks failed. See report above.
```

### 6. Modify `maxRetries` and re-run

Edit `.vector/config.yaml` to change the default max retries:

```yaml
defaults:
  maxRetries: 1
```

Run `npx vector run v1` again. Now you should see:
- Only 2 attempts for `always-fail` (1 initial + 1 retry)
- Faster escalation and shorter RETRIES section
- Same ESCALATION and FAIL verdict

### 7. Clean up

Remove the test checks from `.vector/config.yaml`:

```yaml
vectors:
  v1:
    trigger: Quick checks
    checks:
      - test-pass
```

Edit `.vector/config.yaml` to remove the `flaky-test` and `always-fail` entries from the `checks` block (there is no `check remove` command — just delete the YAML entries manually).

Restore `maxRetries` to 3 in `.vector/config.yaml`:

```yaml
defaults:
  maxRetries: 3
```

## What You Learned

- **Selective Retry:** Vector retries only the failing check, not the entire suite. Passing checks are complete.
- **Attempt History:** Each retry attempt is logged with its status and duration, giving full visibility into timing.
- **Automatic Escalation:** When all retries are exhausted (and the check still fails), Vector escalates with a reason and suggestion.
- **Configurable Retries:** The `maxRetries` setting in `defaults` controls the number of retry attempts per check.
- **Attempt Math:** Total attempts = 1 (initial) + `maxRetries` (retries).

This is the foundation for understanding Vector's resilience model — temporary failures are handled automatically, while persistent failures escalate for human review.
