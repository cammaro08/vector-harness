# Vector as Protocol — Session Discussion

**Date:** 2026-03-31
**Topic:** Rethinking Vector from enforcement runtime to composable protocol

---

## Where We Started

Vector v1 was built as a **Layer 1 enforcement runtime** — a set of specific checks (test runner, coverage validator, doc validator) wired into git hooks via the PI enforcer extension. It worked: agents couldn't self-report success, deterministic tools verified the work, and failures triggered retry with escalation.

But this was one layer out of five. A previous session (Mar 27) had mapped Vector's pattern across five paradigms observed in real companies:

1. **Enforcement Runtime** (what Vector was) — per-commit checks
2. **Step Orchestration** (Stripe Minions pattern) — per-step gates in a blueprint
3. **Knowledge/Environment Health** (OpenAI Codex pattern) — scheduled background checks
4. **Adversarial Evaluator** (Anthropic pattern) — LLM judge + Playwright
5. **Skill Optimizer** (Para's closed-loop pattern) — blind judges scoring agent instructions

All five shared the same DNA: a quality bar, an unfakeable check, and a structured report that routes to pass / retry / escalate. But Vector was only implementing the first one.

---

## The Realization

**The first strategy was misaligned.** Vector was building the "how" (specific check implementations like `testRunner.ts`, `coverageValidator.ts`) instead of the "what" (the protocol that makes all layers work).

The codebase had two things interleaved:

**Thing 1 — The Protocol:**
- `EnforcementReport` type and its immutable construction functions (`createReport`, `addCheck`, `addRetry`, `withEscalation`, `finalize`)
- The retry engine in the blueprint orchestrator
- The three reporters (terminal, JSON, GitHub PR comment)

**Thing 2 — Specific Check Implementations:**
- `testRunner.ts` — runs `npm test`, parses Vitest output
- `coverageValidator.ts` — runs `npm run test:coverage`
- `docValidator.ts` — checks markdown file existence
- PI enforcer validators (commit message format, test co-location, doc updates)

Thing 1 works for all layers. Thing 2 only works for Node.js projects using Vitest.

---

## The Protocol

The contract is three promises:

1. **Any check returns a structured fact** — `passed` / `failed` / `skipped` with machine-readable details (a `CheckResult`)
2. **Any failure gets a structured response** — retry N times, then escalate with full history
3. **The result is a single `EnforcementReport`** — same shape regardless of what triggered it or what was checked

The protocol doesn't care whether the check was a test runner, a Playwright judge, a doc-freshness cron, or a blind LLM evaluator. It receives a `CheckResult` and handles retry, escalation, and reporting.

---

## Check Registry Model

Instead of Vector shipping check implementations, checks live **outside Vector** (or as optional example plugins). Each project curates a **check registry** — all possible checks that could apply. Per task, the developer toggles which ones are active.

Example project registry:
- `test-pass` — always on
- `coverage-80` — on for features, off for docs-only changes
- `api-docs-updated` — on when touching endpoints
- `no-new-ts-errors` — always on
- `playwright-smoke` — on for UI changes
- `architecture-boundaries` — on for refactors

The agent doesn't invent checks. The developer defines the quality bar. Vector enforces it.

---

## The Five Vectors

The word "layers" implies hierarchy. "Categories" is too generic. "Gates" implies stopping.

Vector — the product name — comes from the physics concept: **force with direction**. Without direction, you just spin your wheels. Each category of checks is itself a **vector** — a directional force pushing work toward quality. You compose vectors per task. The `EnforcementReport` is the **resultant** — the combined outcome of all vectors applied.

### Vector 1 — Conversation Vector
**Trigger:** Agent says "done" (end of conversation/session)
**Purpose:** Verify the work actually happened
**Deterministic:** Yes
**Example checks:** tests pass, files were created/modified, coverage met

### Vector 2 — Commit Vector
**Trigger:** git commit
**Purpose:** Enforce quality at the commit boundary
**Deterministic:** Yes
**Example checks:** test pass, coverage threshold, docs updated, commit message quality

### Vector 3 — Step Vector
**Trigger:** Step completion in a multi-step blueprint
**Purpose:** Gate between steps — did step N produce what step N+1 needs?
**Deterministic:** Yes
**Example checks:** file exists, API responds, schema validates, step output matches expected shape

### Vector 4 — Background Vector
**Trigger:** Cron / scheduled
**Purpose:** Check environment health over time
**Deterministic:** Yes
**Example checks:** doc freshness, architecture boundary violations, pattern drift, dependency staleness

### Vector 5 — Adversarial Vector
**Trigger:** Per-output
**Purpose:** Challenge the output with an adversarial agent
**Deterministic:** Partially (Playwright is deterministic, LLM judge is not)
**Example checks:** Playwright smoke test, LLM quality scoring, design review

### Composability

Vectors are not isolated. Any trigger can pull checks from any vector. The conversation vector (V1) can also run commit checks (V2), architecture checks (V4), and a Playwright smoke test (V5). The adversarial vector (V5) can re-run all deterministic checks from V1–V4 before layering its own judgment on top.

The developer decides which vectors to compose per task. A cautious setup runs all five at every trigger. A fast-moving one runs V1–V2 at conversation end and saves V5 for releases.

---

## What Vector Becomes

Vector is not a test runner or a coverage checker. It is the **enforcement protocol that any coding agent harness can call to get a structured, unfakeable answer about whether work meets the bar.**

The product is three things:

1. **The Protocol** — `EnforcementReport`, `CheckResult`, retry engine, escalation model, reporters
2. **A Check Registry** — pluggable, per-project, toggle per task, with example implementations
3. **Five Vectors** — composable categories of checks, each with a different trigger and scope

Specific check implementations live outside Vector or ship as examples. The "how" gets defined at onboarding time or in real-time by the coding agent, based on the project's registry. Vector runs whatever checks are activated and produces the same `EnforcementReport` regardless.

---

## Architecture: Three Layers

Vector the idea is platform-agnostic. But to actually run, it needs two things from whatever harness it sits on: **how am I triggered?** and **what do I do with the result?**

The protocol itself — the middle part — is always the same:

```
TRIGGER → COLLECT active checks → RUN each check → GET CheckResult →
RETRY if failed (up to N) → PRODUCE EnforcementReport → OUTPUT
```

This gives Vector three architectural layers:

```
┌─────────────────────────────────────┐
│         ADAPTER (per platform)      │
│  Claude Code hooks / GH Actions /   │
│  PI extension                       │
│                                     │
│  Knows: when to trigger, how to     │
│  output, how to feed back to agent  │
├─────────────────────────────────────┤
│         PROTOCOL (core)             │
│  run() → CheckResult[] → retry →   │
│  EnforcementReport                  │
│                                     │
│  Knows: how to execute checks,      │
│  retry logic, escalation model      │
├─────────────────────────────────────┤
│       CHECK REGISTRY (per project)  │
│  .vector/config.yaml                │
│                                     │
│  Knows: what commands to run,       │
│  how to parse output, thresholds    │
└─────────────────────────────────────┘
```

### 1. Adapters (platform-specific, thin)

Each adapter translates "something happened" into "run these checks" and translates the `EnforcementReport` into whatever the platform needs. ~50 lines per harness.

**Claude Code adapter:**
- Trigger: hooks (`PostToolUse` on git commit → V2, `Stop` on conversation end → V1)
- Output: terminal reporter, block the action, feed failure back to agent context

**GitHub Actions adapter:**
- Trigger: workflow event (push, PR, schedule/cron → V4)
- Output: PR comment, check status, fail the workflow

**PI Coding Agent adapter:**
- Trigger: extension events (`tool_call`, `context`)
- Output: extension response, block the tool call

### 2. Protocol (platform-agnostic, the core)

```
run(activeChecks: CheckDefinition[]) → EnforcementReport
```

The engine:
- Takes a list of checks to run
- Executes each one (spawns a command, parses output)
- Collects `CheckResult`s
- If any fail, retries up to `maxRetries`
- If retries exhausted, builds escalation info
- Returns an `EnforcementReport` with verdict, all results, retry history

It doesn't know about Claude Code or GitHub. It runs checks and produces a report.

### 3. Check Registry (project-specific, configured)

```yaml
# .vector/config.yaml
checks:
  test-pass:
    run: "npm test"
    parse: vitest
    enabled: true

  coverage-80:
    run: "npm run test:coverage"
    parse: coverage-table
    threshold: 80
    enabled: true

  api-docs-updated:
    run: "check-file-contains"
    args: { file: "docs/API.md", pattern: "$ENDPOINT" }
    enabled: false  # toggled per task

  no-ts-errors:
    run: "npx tsc --noEmit"
    parse: exit-code
    enabled: true
```

Each check is: run a command, parse the output into `CheckResult`. The registry is project-specific — a Go project would have `go test ./...`, a Rust project would have `cargo test`.

---

## Walkthrough: Claude Code + Vector

Concrete example. Project: crud-server. Task: "add DELETE /users/:id endpoint."

**Step 1: Project setup (one-time)**

Install Vector into the project. Creates `.vector/config.yaml` with the project's check registry.

**Step 2: Activate checks for this task**

Before the agent starts, checks are toggled for the task:

```yaml
# .vector/active.yaml
vectors:
  v1:  # conversation end
    - test-pass
    - coverage-80
    - api-docs-updated  # enabled for this task
    - no-ts-errors
  v2:  # per commit
    - test-pass
    - no-ts-errors
```

**Step 3: Agent works, commits along the way**

At each commit, the `PostToolUse` hook fires:

```
commit triggered → Vector reads active.yaml → runs v2 checks
  → test-pass: ✅ passed (14 passed, 0 failed)
  → no-ts-errors: ✅ passed (exit 0)
  → EnforcementReport: verdict PASS → commit proceeds
```

If tests fail:

```
commit triggered → Vector runs v2 checks
  → test-pass: ❌ failed (13 passed, 1 failed)
  → EnforcementReport: verdict FAIL
  → retry 1/3: feed report back to agent
  → agent fixes the test
  → retry 2/3: test-pass ✅ → commit proceeds
```

**Step 4: Agent says "done"**

The `Stop` hook fires. Vector runs the full V1 suite:

```
stop triggered → Vector reads active.yaml → runs v1 checks
  → test-pass: ✅
  → coverage-80: ✅ (84.2%)
  → api-docs-updated: ❌ (docs/API.md missing DELETE /users/:id)
  → no-ts-errors: ✅
  → EnforcementReport: verdict FAIL
  → agent told: "api-docs-updated failed"
  → agent updates the docs
  → retry: all checks pass → session ends
```

**Step 5: Report**

Vector writes the final `EnforcementReport` — same shape regardless of which checks ran. Terminal output for the developer, JSON for logging, PR comment if pushed.

---

## Implementation: What Vector Actually Is

### The runner is a bash script

Vector's runtime job is: read config, run shell commands, check exit codes, retry if failed, output a report. That's it. No compilation, no runtime dependencies. The entire runner is a single bash script (~100-150 lines):

```
.vector/
  config.yaml     ← the developer's check registry
  run.sh          ← the entire "product"
```

`vector init` copies `run.sh` into the project, scaffolds a starter `config.yaml`, and wires up Claude Code hooks in `.claude/settings.local.json`. The hook calls `.vector/run.sh v1`.

JSON reports via `jq`. PR comments via `gh api`. Terminal formatting via `echo` with ANSI. All bash-native.

A binary (Go, Rust) would give cleaner code to maintain but no additional capability. The config format stays the same either way — if the runner needs to be rewritten later, nothing about the developer experience changes.

**The config is the product. The runner is plumbing.**

### Every check is just a command

Vector doesn't know what any check does. It runs a command and checks the exit code. Exit 0 = pass. Non-zero = fail. This means anything that can run in a shell is a valid check:

```yaml
vectors:
  v1:
    checks:
      # basic test runner
      - name: tests-pass
        run: "npm test"
        expect: exit-0

      # sonarqube quality gate
      - name: sonar-quality-gate
        run: "sonar-scanner && curl -s localhost:9000/api/qualitygates/project_status?projectKey=myapp | jq -e '.projectStatus.status == \"OK\"'"
        expect: exit-0

      # doc validator — just grep
      - name: docs-updated
        run: "grep -q 'DELETE /users' docs/API.md"
        expect: exit-0

      # LLM as judge
      - name: llm-review
        run: "claude -p 'Review the git diff for quality issues. Exit 1 if critical problems found, exit 0 if acceptable.' < <(git diff HEAD~1)"
        expect: exit-0

      # playwright smoke test
      - name: e2e-smoke
        run: "npx playwright test --project=smoke"
        expect: exit-0

      # architecture boundary check
      - name: no-circular-deps
        run: "npx madge --circular src/"
        expect: exit-0
```

Vector doesn't know what SonarQube is, what an LLM is, or what Playwright is. It runs the command and checks exit 0. The developer writes the command — it can be a curl call, a CLI tool, a script that calls an API, or a one-liner that pipes git diff into Claude.

### Deterministic vs non-deterministic checks

Vector doesn't require determinism. It requires **a command with an exit code.** The protocol treats all checks the same — run it, did it pass or fail, report it. The difference is in how much you trust the result.

**Deterministic checks — same input always gives same result:**

```yaml
# tests pass or they don't
- name: tests-pass
  run: "npm test"
  expect: exit-0

# string is there or it isn't
- name: handoff-has-api-spec
  run: "grep -q 'DELETE /users' docs/API.md"
  expect: exit-0

# file was modified within 7 days or it wasn't
- name: docs-fresh
  run: "find docs/ -name '*.md' -mtime +7 | grep -q . && exit 1 || exit 0"
  expect: exit-0

# CLAUDE.md was updated when src/ changed
- name: claude-md-current
  run: "git diff --name-only HEAD~1 | grep -q 'src/' && git diff --name-only HEAD~1 | grep -q 'CLAUDE.md' || exit 1"
  expect: exit-0
```

**Non-deterministic checks — LLM judgment, can vary between runs:**

```yaml
# does this doc accurately describe the current codebase?
- name: docs-accurate
  run: "claude -p 'Compare docs/API.md against src/routes/. Exit 1 if the doc is missing any endpoint or has incorrect info.' < <(cat docs/API.md && find src/routes -name '*.ts' -exec cat {} +)"
  expect: exit-0
  capture: stderr
```

The `docs-accurate` check can't be done deterministically — you need judgment to assess whether a doc is "accurate." The LLM might catch a missing endpoint one run and miss it the next. The developer knows this when they add the check. They're choosing to accept a probabilistic answer because it catches things deterministic checks can't ("is this doc accurate?" vs "does this file exist?").

Vector doesn't hide this distinction or pretend all checks are equal. The developer consciously chooses which kind to use. Deterministic checks give facts. Non-deterministic checks give high-confidence judgments. Both produce the same `CheckResult` — Vector handles them identically.

This maps to the five vectors: V1–V4 are typically deterministic. V5 (adversarial) is where non-deterministic checks live — LLM judges, design reviews, quality scoring.

### Richer output than pass/fail

For checks that need to report details (SonarQube findings, LLM judge reasoning), the convention is:

```yaml
      - name: llm-review
        run: "./checks/llm-review.sh"
        expect: exit-0
        capture: stderr  # stderr becomes the check's detail message in the report
```

The check script writes its details to stderr, exits 0 or 1. Vector captures both. The `EnforcementReport` includes the detail message alongside the pass/fail verdict.

### Installation wires up hooks automatically

`vector init` for Claude Code does two things:

1. Creates `.vector/config.yaml` with a starter check registry
2. Adds hooks to `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "tool === 'git' && action === 'commit'",
        "command": ".vector/run.sh v2"
      }
    ],
    "Stop": [
      {
        "command": ".vector/run.sh v1"
      }
    ]
  }
}
```

The developer doesn't manually configure hooks. Vector sets them up as part of installation. Different adapters wire differently — a GitHub Actions adapter would create a workflow file instead.

---

## What Vector Enables

### Smaller models with guardrails

Vector's strongest argument. If Vector catches failures deterministically and retries, the model doesn't need to be perfect — it just needs to be good enough to pass the checks within 3 attempts. A $3/month model that fails 40% of the time but gets retried by Vector might produce the same final quality as a $200/month frontier model that passes first try. Vector is the equalizer.

**Batch endpoints for cost reduction** — partially fits. For async checks like V4 (background vector), batch inference endpoints reduce cost significantly. For V1/V2 where the agent is waiting on the result, batch doesn't apply since the result is needed now.

**Throwing x15 small models at a problem** — this is an orchestration pattern, not a Vector concern. The strategy of running many models in parallel and picking the best output lives upstream of Vector. However, Vector could verify the output of whichever model won — "did the winning output actually pass the checks?" That's a valid check. The orchestration isn't Vector's job; the verification is.

**Accessibility** — this follows directly from the smaller models point. If Vector makes cheap models reliable enough, then the $200/month frontier plan stops being a requirement. Vector makes quality agent-assisted development accessible to people who can't afford top-tier subscriptions.

### Context management

**Checks that verify docs are up to date — YES.** A V4 background check that runs `doc-freshness` and flags stale docs. That's a check, it returns pass/fail, Vector handles it. This is pure Vector.

**Verifying the right context was available — YES.** A check like "does the handoff doc contain the API spec?" or "was CLAUDE.md updated with the new patterns?" — these are pass/fail checks. Vector can enforce that context hygiene happened.

**Configuring Vector to inject context into system prompts — NO, this is out of scope.** That's a harness/agent configuration concern. Vector checks if work meets a bar. It doesn't set up the agent's working environment. If you add this, Vector becomes two things: an enforcement protocol AND a context management system. Those are different jobs. The distinction: Vector checks the condition ("was context available?"), it doesn't create the condition ("inject this context into the prompt").

**Adding context to docs so the next agent can pick it up — NO, this is orchestration.** The act of writing handoff docs is the agent's job. Vector can verify it happened ("does the handoff doc exist and contain the required sections?") but shouldn't be the thing doing it. Vector is the referee, not the player.

**The net effect** — through checks alone (without owning context injection), Vector still solves the context management problem indirectly. If you have a check that fails when docs are stale, the agent is forced to update them. If you have a check that fails when handoff context is missing, the agent is forced to write it. The right context ends up available because Vector won't let work proceed without it.

### Pattern only

Every team uses their own versions. Vector shows the pattern to solve the problem of providing guardrails. The value is: check registry, per-task activation, retry, escalation, structured report. The bash script is a reference implementation, not the product. Anyone can rewrite the runner in any language — the config format and the protocol are what matter.

Through these guardrails, Vector also indirectly solves the context management problem — by enforcing that context exists and is current, without owning the context itself.

### Custom agents and handoff

**Vector fitting inside custom workflows to ensure proper handoff — YES.** Tools like PI coding agent allow custom agents and workflows. Vector fits inside each step, ensuring quality at every handoff point. That's the Step Vector (V3). Did step N produce what step N+1 needs? Check. Pass/fail. Retry.

**Spinning up a new agent with error context on retry — NO, that's the adapter's job.** Vector says "this check failed, here's the error, retry attempt 2 of 3." How the adapter creates a new agent, what context it passes, whether it's a fresh context window — that's harness-specific. Vector provides the structured failure info (the `EnforcementReport`) that makes good handoffs possible, but it doesn't orchestrate the agents themselves. The PI adapter or Claude Code adapter decides how to spin up a new agent with the right context.

**Calling commands — YES.** A check can call any shell command. That's the entire model.

**Calling skills — NO.** Skills are a Claude Code concept — they're prompt expansions, not executable programs. A skill doesn't have an exit code. Vector can't invoke a skill because there's nothing to check pass/fail against. However, a skill could be wrapped in a script that calls `claude -p` with the skill's intent, and that script is just another check. But Vector doesn't natively understand skills — it understands commands.

### Vector does NOT solve orchestration

This needs to be explicit. Vector does not orchestrate agents. It does not decide:

- Whether to retry in the same context window or spin up a new agent
- How to pass context from a failed attempt to the next attempt
- How to parallelize work across multiple agents
- How to route tasks to specific models
- When to escalate to a human vs keep retrying

Vector produces a structured result: "check X failed, here's the error, attempt 2 of 3." What happens next is entirely up to the harness.

If Claude Code's adapter decides "on failure, keep going in the same conversation" — fine. If PI's adapter decides "on failure, spin up a fresh agent with the error context and a clean context window" — also fine. If a custom harness decides "on failure, try a different model" — Vector doesn't care.

Vector is the referee. It blows the whistle when something fails and holds the scorecard. It doesn't coach the team, call the plays, or substitute players. The harness does that.

This is a feature, not a limitation. Orchestration strategies vary wildly between teams, tools, and use cases. By staying out of orchestration, Vector remains a simple, composable primitive that any orchestrator can call.

### Fit summary

| Claim | Fits Vector? | Why |
|-------|-------------|-----|
| Smaller models + guardrails | **Yes** | Core value prop — retry makes cheap models reliable |
| Batch endpoints | **Partially** | Only for async checks (V4), not blocking checks |
| x15 small models | **No** | Orchestration, not enforcement — but Vector verifies the winner |
| Doc freshness checks | **Yes** | It's a check with pass/fail |
| Verify context was available | **Yes** | It's a check with pass/fail |
| Inject context into prompts | **No** | Harness config, not enforcement |
| Add context to handoff docs | **No** | Agent's job — Vector verifies it happened |
| Pattern only | **Yes** | Exactly the conclusion of this session |
| Ensure proper handoff | **Yes** | Step Vector (V3) |
| Spin up new agent on retry | **No** | Adapter's job — Vector provides failure info |
| Call commands | **Yes** | The entire check model |
| Call skills | **No** | Skills aren't commands with exit codes |

---

## Key Decision: Dropped Layer

The original five-layer model included a **Skill Optimizer** layer (Para's closed-loop pattern — blind workers, blind judges, holdout validation). This was removed from Vector's scope. Vector's focus is enforcing work quality, not optimizing agent instructions. Skill optimization can call Vector's protocol, but it isn't a Vector concern.

---

## Next Steps (Not Yet Decided)

- Restructure the codebase to separate protocol from check implementations
- Define the check registry interface and per-task activation model
- Write the protocol spec as a standalone document
- Ship example checks as optional plugins
- Build the Claude Code adapter (hooks integration)
- Test the model against a real V4 (background) and V5 (adversarial) use case
