# Vector Project: Comprehensive Summary of Discussions & Decisions

## Project Overview

**Vector** is a deterministic enforcement harness that sits above AI coding agents (specifically Claude Code). It verifies that agents actually complete tasks according to predefined rules—preventing agents from lying about test results, coverage metrics, or documentation completeness. Vector is built to be lightweight initially and scales with project complexity over time.

### North Star Vision

Vector aims to be a **pattern system that works across any coding agent and at different stages of any coding harness**. It's not just for one workflow but adaptable across:
- Anthropic's harnesses
- OpenAI's systems
- Stripe's minions
- Any custom coding agent orchestration

The system compounds learning across projects—first project may be basic, but by the third project, the harness knows your patterns and can be calibrated for your specific needs.

---

## Architecture & Technical Decisions

### 1. Per-Step Retry Instead of Ralph Loops

**Status:** FINAL (Decided 2026-03-08)

**Problem:** How to handle agent failures in orchestration?

**Alternatives Considered:**
- Ralph Wiggum loops: Same agent, full task retry, up to N iterations
  - Pro: Simple
  - Con: Inefficient (retry whole task for one failure), harder to debug

- Per-Step Retry: Specialist agents, retry fails at step level (CHOSEN)
  - Pro: Efficient (retry only failing step)
  - Pro: Allows specialist agents (Implementer → TestFixer → different approach)
  - Pro: Clear escalation points and handoff chains

**Why It Works:** Each step has max retries (usually 3). Different agents can attempt the same step. After 3 attempts → escalate to human with full context.

**Implementation Detail:** Blueprint sequence like:
1. Setup (deterministic) → create worktree
2. Implement (agent: Implementer)
3. Test (deterministic) → run tests
4. Fix-Tests (agent: TestFixer) - max 3 retries
5. Review (agent: CodeReviewer)
6. Validate-Docs (deterministic)
7. Create-PR (deterministic)

---

### 2. Direct Tool Use, Not MCP Tools

**Status:** FINAL (Decided 2026-03-08)

**Problem:** How to validate agent work deterministically?

**Alternatives:**
- MCP Tools: Standardized, discoverable, separate server
  - Con: Overkill for single system, extra overhead

- Direct Tool Use (CHOSEN): Custom functions returning facts
  - Pro: Simple, fast, agent can't fake results
  - Pro: Returns actual test output, not claims
  - Con: Only works with this system

**Current Approach:** Tools that return facts:
- `testRunner()` → Returns: {passed: N, failed: N, coverage: X}
- `coverageValidator()` → Returns: {current: X, threshold: Y, passes: bool}
- `docValidator()` → Returns: {hasProgressLog: bool, passes: bool}
- `progressLog()` → Enforces structure, returns audit trail

---

### 3. Decision Capture: Git + DECISIONS.md (Not Honcho)

**Status:** FINAL (Decided 2026-03-08)

**Problem:** How to capture WHY decisions were made?

**Approach:** Version-controlled decision log
- DECISIONS.md in the codebase documents all harness decisions
- Git history shows when rules were added
- Commit messages explain Problem → Solution → Tradeoff
- When escalation occurs, root cause analysis updates DECISIONS.md

**Example Flow:**
1. TestFixer fails 3 times on async/await patterns
2. Human identifies root cause: pattern not documented
3. Human commits fix to system prompt with message explaining why
4. DECISIONS.md updated with decision details
5. Next similar issue: git log shows what was tried before

---

### 4. Long-term Memory: Honcho for Claude Code Sessions

**Status:** FINAL (Decided 2026-03-08)

**Problem:** Claude Code sessions are long and lose context between sessions.

**Solution:** Use Honcho (agent long-term memory system) to:
- Store complete session context + reasoning (searchable)
- Enable cross-session pattern recognition
- Preserve full conversation when needed
- Link from DECISIONS.md: "See session 2026-03-08 for full reasoning"

---

### 5. PI Agents for System Building

**Status:** READY FOR IMPLEMENTATION (Decided 2026-03-08)

**Approach:** 3 specialized agents
1. **Harness Architect** - Designs the system
2. **Harness Builder** - Implements it
3. **System Validator** - Tests it

Benefits feedback loop: Design → Build → Validate → Iterate

---

## Implementation Status

### Phase 1: Blueprint Orchestrator ✅ COMPLETE

**Files:**
- `/home/talha/dev/vector/blueprints/orchestrator.ts` (366 lines)
- `/home/talha/dev/vector/blueprints/__tests__/orchestrator.test.ts` (669 lines)
- Blueprint YAMLs: `implement-feature.yaml`, `fix-bug.yaml`, `refactor.yaml`

**What It Does:**
- Executes steps sequentially with conditional logic
- Per-step retry logic with configurable max attempts
- Handles step failure actions: continue, block, escalate
- Tracks attempt history for escalation context
- Records timing for performance analysis

**Test Coverage:** 92.6% statements, 89.65% branches, 100% functions

**Key Features:**
- Conditional step execution with operators: >, <, >=, <=, ==, ===
- Context passing between steps for reference by later steps
- Escalation protocol with full attempt history and suggestions
- Non-retryable steps (with explicit failureAction) don't retry

---

### Phase 2: Observability Pipeline ✅ COMPLETE

**Comprehensive Layered Observability System with 5 phases:**

#### Phase 1: Core Data Model (`enforcementReport.ts`)
- Type definitions: `CheckResult`, `RetryInfo`, `EnforcementReport`
- Immutable builders: `createReport()`, `addCheck()`, `addRetry()`, `withEscalation()`, `finalize()`
- Bridge function: `fromOrchestratorResult()` - converts orchestrator output to report
- **Coverage:** 100% statements, 100% functions, 92.3% branches (22 tests)

#### Phase 2: Terminal Reporter (`terminalReporter.ts`)
- ANSI color support with automatic TTY detection
- Formatted report output for human-readable terminal display
- Rich formatting: section headers, colored status indicators, duration display
- **Coverage:** 100% statements, 100% functions (36 tests)

#### Phase 3: JSON Logger (`jsonLogger.ts`)
- Writes reports with `_meta` metadata envelope
- File I/O with error handling
- Structured logging for machine parsing
- **Coverage:** 18 tests

#### Phase 4: PR Commenter (`ghPrCommenter.ts`)
- Detects PR context (3 fallback methods)
- Renders markdown with collapsible retry history
- Posts comments via `gh` CLI
- Supports dry-run mode for testing
- **Coverage:** 16 tests, 98.9% statements

#### Phase 5: Integration (`reporter.ts` + enforcer wiring)
- Orchestrates all 4 renderers
- Wires into enforcer for enforcement workflow
- **Coverage:** 17 tests, full integration verification

**Total Test Count:** 109 new tests across observability pipeline
**All Tests:** Passing ✅

---

### Phase 3: Validation Harness ✅ COMPLETE

**Purpose:** Repeatable test framework for validating the observability pipeline

**Components:**

#### Types & Registry
- `ValidationScenario`: Scenario definition interface
- `ScenarioRegistry`: Register and query scenarios with tag filtering
- **Coverage:** 100% across all components

#### 6 Predefined Scenarios
1. **all-pass.ts** - Happy path, 3 passing checks (tags: pass, basic)
2. **single-failure.ts** - Single failing check (tags: fail, basic)
3. **retry-then-pass.ts** - Initial timeout, then success (tags: pass, retry)
4. **escalation.ts** - Multiple failed retries, triggers escalation (tags: fail, retry, escalation)
5. **all-skipped.ts** - All checks skipped (tags: pass, edge-case)
6. **many-checks.ts** - Stress test: 8 checks, multiple statuses (tags: fail, retry, stress)

#### Validation Runner
- `runScenario()`: Execute single scenario through all 4 renderers
- `runAllScenarios()`: Process multiple scenarios, aggregate results
- `writeOutputArtifacts()`: Write structured output hierarchy
- Renders: plain text, colored ANSI, JSON with metadata envelope, GitHub markdown

#### Test Suite
- **69 tests** validating scenario structure and consistency
- **All tests passing** ✅
- **100% coverage** across all validation modules

**Output Structure:**
```
{outputDir}/
├── summary.txt              # Human summary
├── validation-run.json      # Full machine result
└── scenarios/{id}/
    ├── terminal.txt         # Plain text
    ├── terminal-colored.txt # ANSI colors
    ├── report.json          # JSON envelope
    └── pr-comment.md        # GitHub markdown
```

---

## Project Build & Testing

### Tech Stack
- **Language:** TypeScript (strict mode)
- **Test Framework:** Vitest
- **YAML Parsing:** js-yaml
- **Server:** Express (for potential API layer)

### Test Commands
```bash
npm run test                           # All tests
npm run test:coverage                 # With coverage report
npm run validate                       # Run all 6 scenarios
npm run validate:pass                 # Only passing scenarios
npm run validate:fail                 # Only failing scenarios
npx vitest run tools/validation/      # Harness unit tests (41 tests)
```

### Code Quality Requirements
- **Minimum Coverage:** 80% (statements, branches, functions, lines)
- **Actual Coverage:** Often exceeding 90-100% on core modules
- **TypeScript:** Strict mode, no implicit any

---

## Key Discussions & Counter-Arguments

### "Claude Code Can Already Iterate and Fix Things"

**True, but...**
- Claude Code iterates *with your presence*
- Vector gets there *without you*
- You assign a task and walk away
- The harness owns the quality gate
- Compound learning: rules improve over projects

### "Just Copy a Good .claude Setup (Everything-Claude-Code)"

**ECC is different from Vector:**
- ECC optimizes the instruction (tells Claude what to do)
- Vector validates the outcome (checks it actually did it)
- ECC: Static wisdom from someone else
- Vector: Your own system, calibrated to how you ship

### "Models Will Get Better—This Won't Be Needed"

**True, but...**
- Yes, models improve
- Vector gets lighter as models improve but doesn't disappear
- As you build more complex things, reliability matters more
- Capability ≠ reliability (more capable models can still be confidently wrong)

### "Just Loop a Skill in CI/CD Until Green"

**Missing pieces:**
- Retry cap (3 attempts)
- Specialist routing (different agent per attempt)
- Escalation context (full history for human)
- Compound learning (rules improve, not code)
- Prevention (blocks bad pushes, CI catches them after)

### "Just Set Up CLAUDE.md Properly"

**CLAUDE.md alone:**
- Optimizes the question
- Doesn't validate the answer
- You're still the validator

---

## Roadmap & Next Steps

### Phase 1: Complete ✅
- Per-step retry architecture
- Blueprint orchestrator with YAML configs
- 29 tests, 92%+ coverage

### Phase 2: Complete ✅
- 5-layer observability system
- Terminal, JSON, PR comment rendering
- 109 tests all passing

### Phase 3: Complete ✅
- Validation harness with 6 scenarios
- Registry and runner system
- Full test coverage

### Phase 4: In Progress
- Integration with sample CRUD apps
- Manual verification of enforcement
- Real-world testing against actual workflows

### Phase 5: Documentation & Production-Ready
- `/home/talha/dev/vector/CLAUDE.md` - Usage instructions
- Honcho integration for session memory
- Common failure patterns and fixes
- Full README for implementation

---

## Files & Folder Structure

### Core System
```
/home/talha/dev/vector/
├── blueprints/
│   ├── orchestrator.ts           # Core orchestration engine
│   ├── implement-feature.yaml    # Feature workflow blueprint
│   ├── fix-bug.yaml              # Bug fix workflow
│   ├── refactor.yaml             # Refactoring workflow
│   └── __tests__/
│       └── orchestrator.test.ts  # 29 tests, 92%+ coverage
├── tools/
│   ├── enforcementReport.ts      # Data model (100% coverage)
│   ├── terminalReporter.ts       # Terminal output (36 tests)
│   ├── jsonLogger.ts             # JSON logging (18 tests)
│   ├── ghPrCommenter.ts          # PR commenting (16 tests)
│   ├── progressLog.ts            # Progress tracking
│   ├── testRunner.ts             # Test execution
│   ├── coverageValidator.ts      # Coverage checking
│   ├── docValidator.ts           # Documentation validation
│   ├── reporter.ts               # Integration layer
│   ├── validation/
│   │   ├── types.ts              # Type definitions
│   │   ├── registry.ts           # Scenario registry (100% coverage)
│   │   ├── runner.ts             # Scenario runner (100% coverage)
│   │   ├── run.ts                # CLI entry point
│   │   ├── scenarios/
│   │   │   ├── all-pass.ts       # Happy path scenario
│   │   │   ├── single-failure.ts
│   │   │   ├── retry-then-pass.ts
│   │   │   ├── escalation.ts
│   │   │   ├── all-skipped.ts
│   │   │   ├── many-checks.ts
│   │   │   └── index.ts          # Barrel export
│   │   └── __tests__/            # 69 validation tests
│   └── __tests__/                # Tool unit tests
├── .pi/
│   └── extensions/enforcer/      # Claude Code extension hook
│       ├── index.ts              # Git commit interceptor
│       └── validators/
│           ├── commit-validator.ts
│           ├── test-validator.ts
│           └── doc-validator.ts
├── DECISIONS.md                  # Decision log (5 decisions documented)
├── NEXT_STEPS.md                 # Roadmap (6 phases)
├── README.md                     # Project overview
├── CLAUDE.md                     # Project instructions
└── BLUEPRINT_ORCHESTRATOR_SUMMARY.md # Implementation details
```

---

## Decision Log

All decisions documented in `/home/talha/dev/vector/DECISIONS.md`:

1. **Per-Step Retry Architecture** (FINAL) - Why step-level over full task retry
2. **Direct Tool Use** (FINAL) - Why custom functions over MCP
3. **Git + DECISIONS.md** (FINAL) - Why local docs over Honcho for harness decisions
4. **Honcho for Sessions** (FINAL) - Why long-term memory for Claude sessions
5. **PI Agents for Building** (READY FOR IMPL) - How to build the harness itself

Each decision includes: Problem, Alternatives, Reasoning, Current Approach, When It Might Change.

---

## Talk/Pitch Points

Vector solves a real problem for anyone building with AI agents:

**The Problem:**
- Claude Code can get 80-90% of the way there
- But you become the enforcer layer
- You check test results, verify coverage, validate docs
- You're policing Claude instead of scaling work

**The Solution:**
- Vector is the enforcer layer you can delegate to
- Deterministic checks you can trust
- Learns and improves with your projects
- Lightweight for simple apps, heavyweight for critical systems
- Configurable per-project

**Why It Matters:**
- Scales your leverage (set it and forget it)
- Compounds over projects (rules improve, reuse across systems)
- Works with any agent (Claude, OpenAI, local models)
- Deterministic (can't fake results)

---

## Session References

Key sessions documented:
- **b2bcfbc1** (Mar 27) - Vector observability and social media strategy
- **a12d20e2** (Mar 26) - Talk pitch development and README updates
- **15e30af1** (Mar 26) - Bio and elevator pitch creation
- **97bbc356** (Mar 26) - Social post creation
- **9047d42c** (Mar 25) - Observability implementation (largest session, 2.6M)
- **f9ca9ae1** (Mar 25) - Blueprint orchestrator TDD implementation

---

This summary reflects all major discussions, decisions, implementations, and the current state of the Vector project as of late March 2026.
