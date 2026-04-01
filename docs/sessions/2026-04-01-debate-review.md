# Vector Protocol Review — Pre-Debate Assessment

**Date:** 2026-04-01
**Reviewed:** 2026-03-31 session document (Vector as Protocol)
**Assessment:** This is a plausible direction with solid bones, but several critical gaps threaten viability. The thinking is 70% there — the protocol concept is sound, but the bridge from concept to execution is fragile and under-tested.

---

## What's Strong

### The Protocol Abstraction Is Sound

The core insight is legitimate: separate "what makes a check work" (deterministic fact + retry engine + structured report) from "what checks to run" (project-specific registry). This is a real abstraction boundary.

The `EnforcementReport` → `CheckResult` → retry logic pipeline is clean. It naturally handles:
- Different check types (test runners, docs, LLM judges, scripts)
- Retries without changing the core logic
- Escalation and structured fallout
- Multiple output formats (terminal, JSON, PR comment)

This is **not** obvious. Many projects conflate quality gates with specific tool integrations. Separating them is good design.

**Evidence this works:** The protocol is already in the codebase (`createReport`, `addCheck`, `finalize` functions). The validation harness uses it. Six different scenarios work through the same machinery. That's proof of concept.

### The Five Vectors Decomposition

Breaking enforcement into **five categories by trigger and scope** is clever and generalizable:
- V1 (conversation end) catches agent scope violations
- V2 (per commit) catches incremental regressions
- V3 (step completion) catches orchestration handoff failures
- V4 (scheduled background) catches drift and staleness
- V5 (adversarial) allows non-deterministic judgment

These map to real problems in real workflows. The physical analogy (force with direction) is helpful for communication.

**Strongest part:** The composability claim is understated. The ability to run V1 checks at a V3 trigger, or rerun V1–V4 checks as a prelude to V5, is flexible. Most frameworks force checks into rigid buckets.

### Bash-as-the-Runtime Decision

"The config is the product. The runner is plumbing." — shipping as bash (100-150 lines) instead of a compiled binary is pragmatic.

Reasons this is sound:
- **No dependency hell.** Node.js runner requires Node.js. Go binary requires Go runtime. Bash is already there.
- **Fast iteration.** Config changes don't require recompilation.
- **Transparency.** Developers can read `.vector/run.sh` and understand exactly what's happening.
- **Portability.** Same config runs on macOS, Linux, container, CI/CD.

The escape hatch ("if you need a binary later, the config format stays the same") is honest.

**Caveat:** Bash has real limitations (error handling, cross-platform ANSI colors, complex parsing), but for this scope it's defensible.

### Clear Boundaries on What Vector Is NOT

The document explicitly states what Vector doesn't do:
- Orchestration (spinning up agents, routing tasks, context window management)
- Context injection (setting up agent environment)
- Agent invocation (Vector doesn't call agents)
- Skill invocation (Vector doesn't know about Claude Code skills)

This restraint is mature. It acknowledges the temptation to expand scope and resists it. **Pattern-only** positioning makes sense: every team implements the protocol differently.

---

## What's Weak or Hand-Wavy

### The "Check" Abstraction Leaks

The document says: "Every check is just a command. Exit 0 = pass, non-zero = fail."

This is cleaner than reality. Questions that immediately arise:

1. **What if the command succeeds but the output contains failures?**
   - Example: `npm test` exits 0 but the log contains "skipped: 2 tests." Is that a pass or fail?
   - Example: `sonar-scanner` exits 0, but the JSON response has `status: "WARN"`. Should you parse the JSON separately?
   - The document's SonarQube example uses `jq` to parse the JSON response and turn it into an exit code. But this means the check author has to understand exit-code semantics. Not every tool works this way.

2. **Parsing complexity is hidden.**
   - Coverage threshold (`threshold: 80`) is mentioned in the YAML, but the mechanism for parsing test output and extracting the number is glossed over.
   - The document says there's a `parse: coverage-table` field, but doesn't specify how the parsing works, what formats it handles, or how to add a new parser.
   - If the test runner changes output format (e.g., Vitest 1.0 → 2.0), does the check break silently?

3. **Non-zero exit doesn't distinguish severity.**
   - Exit 1 = failed. Exit 2 = error. Exit 3 = timeout. Exit 139 = killed by signal.
   - Vector treats them all as failures, but they're meaningfully different. A timeout should maybe trigger a different retry strategy (wait longer) than a logic error (fix the code).
   - The document doesn't acknowledge this complexity.

4. **What does "capture: stderr" really do?**
   - The document says: "For checks that need to report details... write to stderr, Vector captures both."
   - But this assumes every check author knows to write details to stderr. Many tools write to stdout. Some don't distinguish. The convention is fragile.

**Likelihood of failure:** High. The first real check that doesn't fit the exit-code model (e.g., a tool that's designed to always exit 0 and returns machine-readable output) will need special handling. The abstraction will crack.

---

### The Check Registry Is Underspecified

The `.vector/config.yaml` example is illustrative but not complete:

```yaml
checks:
  test-pass:
    run: "npm test"
    parse: vitest
    enabled: true
```

Missing from the spec:
1. **How is the parser selected?** Is `parse: vitest` a built-in, or does the user have to implement it?
2. **What if you have multiple test suites?** `npm test` runs all tests. Do you need separate checks for each?
3. **How do you express conditional activation?** The document says "toggle per task," but the YAML doesn't show how. Is there a separate `.vector/active.yaml`? How does the tool know which one to read?
4. **Timeout handling.** What if `npm test` hangs? After how long does Vector kill it?
5. **Retry logic configuration.** Is maxRetries a global setting or per-check? Can you retry test-pass but not api-docs-updated?
6. **Environment variables.** How do you pass secrets or configuration to checks?

The document hand-waves over these with "the developer writes the command," but that only works if the scaffold is comprehensive. Without a complete spec, users will guess.

**Likelihood of failure:** Very high. Users will add checks that seem right in YAML but fail at runtime because the parser doesn't exist, the timeout is wrong, or the environment variable isn't set.

---

### Deterministic vs. Non-Deterministic Is Not Resolved

The document acknowledges the distinction:
- **Deterministic:** Same input, same result (tests, file existence, git checks)
- **Non-deterministic:** Same input, different result (LLM judge, design review)

Then it says: "Vector doesn't require determinism. It requires **a command with an exit code.**"

This is contradictory. Here's why:

1. **Retry strategy depends on determinism.**
   - If a check is non-deterministic and it fails, retrying it 3 times is wasteful (might pass one of the three runs by luck) or wrong (the LLM might give the same critique twice and disagree the third time).
   - If a check is deterministic and fails, retrying it without changing the code is useless.
   - Vector's retry engine doesn't know the difference, so it treats them identically. This is a bug waiting to happen.

2. **Confidence scoring is missing.**
   - A deterministic check ("test passed") has 100% confidence. An LLM check ("this code is well-designed") has ~70% confidence.
   - Vector's report doesn't distinguish. A developer reading "check passed" doesn't know if it's a hard fact or a probabilistic judgment.
   - This creates a false sense of certainty.

3. **The Playwright smoke test (V5 example) is non-deterministic in subtle ways.**
   - Flaky tests (intermittent failures due to timing) are common. Is a flaky Playwright test "non-deterministic" or "broken"?
   - Vector has no way to mark a check as "accepted to be flaky" or require a higher success threshold (e.g., pass 2 out of 3 runs).

**Real consequence:** Someone will add an LLM judge check, Vector will retry it 3 times on failure, the LLM will pass on retry 2, and the developer will think "the check works" when really they just got lucky. The reliability they think they have is false.

---

### The Retry Logic Is Oversimplified

The document shows:
```
commit triggered → test-pass: ❌ failed → retry 1/3 → agent fixes test → retry 2/3: ✅ PASS
```

This assumes:
1. The agent can read the failure message and understand what to fix
2. The agent's second attempt will fix the problem
3. Three retries is always the right number

Reality:
1. **Failure context matters.** If the test output is 50 lines, the agent needs to know which lines matter. The document says Vector captures `stderr` but doesn't say it's included in the report sent back to the agent. If context is missing, the agent retries blindly.
2. **Different checks need different retry strategies.** A test failure might benefit from 3 retries. A doc-freshness check should maybe never retry (docs are either fresh or not). A SonarQube quality gate might need to retry with different thresholds, not just run the same check again.
3. **Exponential backoff might help.** If a check fails due to a flaky external service, retrying immediately 3 times is less effective than waiting 5 seconds between retries. The document doesn't mention this.
4. **Max retries N is arbitrary.** Why 3? Never justified. Some checks might need 10, some 0.

**Likelihood of failure:** Medium. The model works for test failures and similar "fix the code" checks. It breaks down for environment-dependent checks, flaky external services, and non-deterministic checks.

---

### Five Vectors Aren't Actually Composable

The document claims: "Any trigger can pull checks from any vector."

But the triggers are fundamentally different:

1. **V1 (conversation end) is blocking.** The agent is waiting. It needs results in seconds.
2. **V4 (background, scheduled) is async.** No one is waiting. Can take minutes.
3. **V5 (adversarial) requires the previous output.** Can't start until V1–V4 are done.

The claim that "the conversation vector can run commit checks and architecture checks" is true in theory. In practice:

- Running a 5-minute background check at conversation end will timeout or annoy the user
- Running a non-deterministic LLM judge at commit time will slow down the workflow
- Composing V3 (step checks) with V5 (adversarial checks) requires knowing when the step is "really" done before the adversary checks it

The document says "the developer decides composition per task," which is true, but it doesn't acknowledge the constraints. Someone will compose incompatible vectors and get surprised.

**Likelihood of failure:** High. The flexibility is real, but the constraints aren't documented. Teams will compose in ways that cause pain (slow commits, flaky checks, confusing retry loops) before discovering the boundaries.

---

### The Walkthrough Glosses Over the Hard Parts

The "Claude Code + Vector" walkthrough is illustrative, but several steps are hand-waved:

1. **"Agent told: api-docs-updated failed"** — How? Vector produces a report. How does it get back to the agent? Does the hook modify the agent's context? Inject an error message? The document doesn't say.

2. **"Agent updates the docs → retry: all checks pass"** — This assumes the agent:
   - Understands what "api-docs-updated" means
   - Knows where the file is
   - Can find the right section
   - Writes the doc correctly

   It's possible, but not guaranteed. A naive retry without better context might produce the same failure.

3. **"The agent says 'done'"** — In Claude Code, what triggers this? The `Stop` hook fires at the end of a session. But what if the developer wants to run the final checks without ending the session? What if they want to run only V1 checks, not the full suite?

4. **Cwd and git context** — The examples assume the agent is in the right directory and git is initialized. What if the check is running in a different context (e.g., CI/CD environment)?

**Likelihood of failure:** Medium to high. The walkthrough works for the happy path. Real usage will involve context mismatches, agents that don't understand error messages, and integration friction with the harness.

---

### Implementation Claims Are Unvalidated

The document says:

> "The entire runner is a single bash script (~100-150 lines)"

But the script has to:
- Read YAML config
- Parse environment variables
- Execute commands with timeouts
- Capture stdout and stderr separately
- Parse output (coverage, test results, JSON)
- Build retry logic
- Output three different report formats (terminal ANSI, JSON, GitHub markdown)
- Handle signals and process exit codes

That's not 100-150 lines of bash. It's more like 500+, and bash is painful for that size. The claim is undersized.

**Likelihood of failure:** Medium. The proof of concept might be 100 lines. The production implementation will be larger, more error-prone, and harder to maintain.

---

### The "Pattern Only" Positioning Is Vague

The document says: "Every team uses their own versions. Vector shows the pattern."

But then what is Vector the product? If it's just a pattern, why have a `.vector/run.sh` file at all? Why not just documentation?

The answer is implicit: Vector provides one reference implementation (bash) + one configuration format (.vector/config.yaml). Teams can fork the bash script, rewrite in Go, change it to their needs. But they use the same config format so they can share checks.

This is reasonable, but it creates fragmentation:
- If you rewrite the runner in Go, does it work exactly the same as bash?
- If you extend the YAML format for your Go version, are other teams' configs compatible?
- Who owns the config spec? Is it versioned? How does it evolve?

The document doesn't answer these questions. It's betting on a "loose standard" model where everyone forks and adapts. This works if the core is so simple that forking is cheap. At 500 lines of bash, it's not that cheap.

**Likelihood of failure:** Medium. The pattern-only positioning will create confusion. Teams will extend in incompatible ways. The "composable" claim will break.

---

### Context Management Claims Need More Rigor

The document argues Vector solves context management "indirectly":

> "Through checks alone, Vector forces context availability without owning it."

Example:
- Check: "Does handoff doc exist?" → Forces agent to write docs
- Check: "Is CLAUDE.md current?" → Forces agent to update it
- Result: Right context is available because Vector won't let work proceed without it

This is... partially true but also wishful thinking:

1. **Checks verify existence, not quality.** A check can verify "handoff.md exists" but not "handoff.md contains good information." An agent can write a stub doc that's technically there but useless.
2. **Context availability != context usefulness.** You can force docs to exist without forcing them to be read or used. The agent might generate them and ignore them.
3. **Bootstrapping problem.** On the first commit, the context doesn't exist yet. The check fails. The agent has to figure out what context to create. This is learned behavior, not protocol enforcement.

The document's claim that Vector solves this "indirectly" is too strong. It enforces that documents exist; it doesn't ensure they're useful or used.

**Likelihood of failure:** Low impact, but philosophically loose. This claim might oversell what Vector does.

---

## What's Missing

### No User Research or Validation

The document describes a system that sounds great in theory. But there's no evidence that real teams would actually use it. Questions that would require user research:

1. **Would developers actually write `.vector/config.yaml`?** Or would they copy a template and never customize it?
2. **How many checks would a realistic project have?** The walkthrough shows 4 checks. Real projects might have 20. Does YAML become unwieldy?
3. **Would developers trust non-deterministic checks?** The document acknowledges LLM judges can fail. Would developers add them, or stick to deterministic checks?
4. **How much would retry friction hurt?** The document mentions "every commit runs checks." If that adds 30 seconds, does that kill the vibe coding flow?
5. **What's the actual failure rate of small models?** The document claims small models fail 40% of the time. This is guessed at, not measured.

Without user research, the value proposition is theoretical.

---

### No Failure Mode Analysis

The document doesn't deeply examine what happens when the system breaks:

1. **What if a check is broken (e.g., it segfaults, or produces invalid JSON)?** Vector treats it as a failure, but should it retry? Should it escalate?
2. **What if the agent is stuck in a retry loop?** E.g., a check fails, agent retries, check fails again because it's actually unfixable. After how many retries does Vector give up?
3. **What if the developer misconfigures `.vector/config.yaml`?** E.g., points to a script that doesn't exist, uses wrong YAML syntax. Does Vector fail gracefully?
4. **What if Vector itself crashes?** The hook fails. Does the git commit proceed or block?
5. **What if the harness (Claude Code, GitHub Actions) doesn't support the hook?** Users have to manually run Vector. Does that defeat the purpose?

The document doesn't engage with these failure scenarios.

---

### No Cost Analysis

The document claims Vector enables cheaper models. But:

1. **Retry cost.** If Haiku fails a check 40% of the time and retries 3 times, that's 4 runs per task (1 initial + 3 retries). At 40% failure rate, expected retries = 2.4, so ~3.4 runs average. If Sonnet passes on the first try, you save 3.4x inference cost. But how much does that matter if each run is 30 seconds and people have to wait?

2. **No actual data.** The claim is intuitive but unvalidated. How much do teams actually save by using a cheaper model + Vector vs. using a better model once?

3. **Implicit assumption:** The tasks are homogeneous. If 50% of tasks are too complex for small models to solve (even with retries), you lose the savings for those tasks.

---

### No Threat Model

Who is Vector protecting against?

- **Bad agent outputs?** Yes, checks catch this.
- **Lazy agent that skips steps?** Partly. Checks verify work happened, but not whether it was the *right* work.
- **Adversarial agent that fakes success?** Not really. If an agent can control stderr/stdout and exit codes, it can fake checks. Vector doesn't cryptographically verify check outputs.
- **Developer shortcuts?** No. A developer can disable checks in `.vector/config.yaml` anytime.

The document doesn't articulate a threat model. Who is trying to break this system, and does Vector actually defend against them?

---

### No Migration Path From v1 to v2

The codebase currently has `testRunner.ts`, `coverageValidator.ts`, etc. — Thing 2 (specific implementations). The proposal is to separate Thing 1 (protocol) from Thing 2 (implementations).

But the document doesn't explain how existing projects migrate. Do they:
- Rewrite their checks as `.vector/config.yaml` entries?
- Run both the old system and the new system in parallel?
- Break and rebuild from scratch?

Without a migration path, the proposal is a rewrite, not a refactor. That's a big commitment.

---

### No Backward Compatibility Plan

The document says the config format is "the product" that should be stable. But it also introduces the concept of check registries, parsers, and environment-specific setup.

What happens when:
- A parser is removed (too few projects use it)?
- The YAML format changes (new required fields)?
- A built-in check is deprecated?

The document doesn't mention versioning, deprecation cycles, or compatibility guarantees. This is required for a "pattern" that teams are supposed to adopt and depend on.

---

## Internal Contradictions

### 1. "Pattern Only" vs. "Reference Implementation"

The document says: "Vector is a pattern that every team implements."

But then it also says: `vector init` wires up hooks and creates `.vector/run.sh`.

If it's truly pattern-only, why ship a reference implementation? If you're shipping an implementation, you're committing to support it.

**Resolution:** The document should clarify: Is Vector (a) a spec + reference implementation, or (b) an optional pattern that teams can implement independently?

---

### 2. "Bash Is the Product, Config Is the Product"

Two contradictory statements:

> "The config is the product. The runner is plumbing."
> "Anyone can rewrite the runner in any language — the config format and the protocol are what matter."

These can both be true, but only if the bash runner is truly generic. If it contains project-specific logic or quirks, rewriting it becomes hard.

The walkthrough suggests the bash script does the "heavy lifting" (parsing test output, extracting coverage numbers, formatting reports). That's not plumbing. That's domain logic. If teams rewrite in Go, they have to reimplement all that domain logic.

---

### 3. "Composable Vectors" vs. "Triggers Are Incompatible"

The document claims vectors are composable: "V1 can run V2 checks, V5 can rerun V1–V4."

But the triggers have fundamentally different execution contexts:
- V1 is user-facing, blocking, must complete in seconds
- V4 is background, non-blocking, can take minutes
- V5 is part of a chain, depends on previous outputs

Composing them requires careful orchestration. The document doesn't specify how to do this in the protocol.

**Real problem:** Someone will configure "run V4 (background checks) at V1 (conversation end) trigger" and be surprised that it's slow.

---

### 4. "No Orchestration" vs. "Custom Adapters Control Retry"

The document says: "Vector is not responsible for orchestration. That's the adapter's job."

But then retry logic depends on the adapter:
> "Vector says 'check failed,' the adapter decides whether to retry in the same context or spin up a new agent."

If the adapter controls retry strategy, then the retry engine in Vector is just scaffolding. The real logic lives in the adapter. Why does Vector have a retry engine at all?

**Confusion:** The document doesn't clarify what "Vector's retry" does vs. "adapter's retry strategy."

---

## The Biggest Risk

If someone tried to build this, the most likely failure mode is:

**The bash runner becomes unmaintainable because it has to handle too many special cases.**

Here's why:

1. **Parsing is the hard part.** Coverage parsing, test output parsing, SonarQube parsing — these are fragile. Each tool changes its output format. Each project has custom scripts. The bash runner has to either:
   - Have built-in parsers for 20+ tools (bloat, maintenance burden)
   - Require every project to implement their own parsers (high barrier to entry)
   - Use a plugin system (complexity, fragmentation)

2. **YAML becomes insufficient.** Simple config: `run: npm test`. But when you need to express "run this, parse that, extract this value, compare to threshold, write this detail message on failure" — YAML gets unwieldy. Teams start wanting a DSL or a programming language.

3. **Backward compatibility breaks everything.** Once teams start depending on `.vector/config.yaml`, you can't change the format. But you'll need to. Parsers fail, new checks emerge, config gets complex. The format needs to evolve, but evolution breaks compatibility. Now you have versioning problems.

4. **Debug-ability is terrible.** When a check fails, what happened? Was it the script? The parser? The YAML? The agent might retry 3 times and still fail for a reason it can't understand. Bash doesn't have good error reporting. The report might say "check failed" but not why.

The document assumes the bash runner is simple. It's not. The simplicity is an illusion created by not thinking through the edge cases.

**Concrete example:** A project wants to run `npm test`, parse Vitest output, and extract the coverage number. The bash script has to:
- Spawn npm test
- Capture stdout/stderr
- Parse Vitest's table format (which varies by version)
- Extract the "coverage" line
- Parse the percentage
- Compare to threshold (80)
- Output pass/fail
- Capture any error message for the report

That's 50+ lines of bash for one check. If there are 20 checks and 5 different output formats (Vitest, Jest, Mocha, Cypress, Playwright), the bash script becomes 500+ lines of parsing logic. That's not "plumbing."

---

## Overall Assessment

This is a **solid direction with a weak execution plan.**

### What's Salvageable

- **The protocol abstraction is real.** The `EnforcementReport` + retry engine is reusable across different platforms and check types.
- **The five-vector decomposition is useful.** It's a good framework for thinking about enforcement at different scopes.
- **The separation of concerns (protocol, check registry, adapters) is sound.** This is the right architectural split.
- **The vision of enabling cheaper models is valuable.** If it works, it's powerful.

### What Needs More Work

1. **Unspecify the check abstraction.** Exit codes are not enough. The document needs to specify how parsing works, how to handle non-standard output formats, and what to do when a tool doesn't fit the model.

2. **Build a complete config spec.** The YAML example is too illustrative. There's a full spec hiding in the implementation: parser selection, timeout configuration, environment variable handling, conditional activation, retry strategies.

3. **Validate with users.** Build a prototype, have 3–5 real teams use it, measure the friction, identify the missing pieces. The current design is untested.

4. **Resolve the implementation plan.** Is bash actually viable, or should it be a binary? If bash, how do you avoid accumulating 500 lines of parsing logic? If binary, what language, and why?

5. **Clarify the "pattern vs. product" positioning.** If Vector is a spec, document it formally. If it's a product, commit to backward compatibility. Don't have it both ways.

6. **Think through failure modes.** What happens when checks break? When configuration is invalid? When the agent is stuck retrying? The document glosses over these.

7. **Address the retry problem for non-deterministic checks.** The current retry engine assumes the same check run again will behave differently (which is true for agent-fixable issues, but false for truly non-deterministic checks). You need a different strategy for LLM judges and flaky tests.

### The Confidence Threshold

This is good enough to prototype and validate with users, but not good enough to build as a library/product yet. The core ideas are sound, but too many details are missing. Trying to ship this without user feedback will result in a system that looks right but breaks on edge cases.

**Recommendation:** Build the prototype (refactor the existing code, separate protocol from implementations, wire up the Claude Code adapter), use it internally with a few real tasks, then come back to the design with data. The current document is a strong vision but needs to survive contact with reality.

**Estimated risk of major redesign after first real usage:** 60%. The vision is solid, but the details will surprise you.
