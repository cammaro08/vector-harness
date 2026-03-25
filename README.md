# Vector

An enforcement harness that makes AI coding agents actually finish what they start.

Claude Code builds it. Vector makes sure it's done.

---

## What is Vector?

Vector is a deterministic enforcement harness that sits above your AI agent. It does not trust the agent's word. It runs the tests, checks the coverage numbers, validates the docs — real results, not claims. When the agent falls short, it retries with a specialist. Three attempts, then it escalates to you with full context and a decision — not a mess.

The core insight: right now, you are the enforcement layer. You check, correct, verify. Vector replaces that role.

---

## Why does this need to exist?

### "Claude Code can already iterate and fix things"

Claude Code can get there eventually. Vector gets there without you. The difference is your presence. With Vector, you assign a task and walk away. The harness owns the quality gate.

### "Just copy a good .claude setup — everything-claude-code already exists"

Copying rules tells Claude what to do. Vector verifies it actually did it. A copied folder is someone else's static wisdom. Vector is yours, built from your own failures, calibrated to how you ship. ECC optimises the instruction. Vector validates the outcome. They are complementary — Vector is the orchestration layer above ECC.

### "Models will get better — this won't be needed"

Yes. And what you build with them will get more complex. Capability and reliability are different dimensions. A more capable model can still be confidently wrong. Vector gets lighter as models improve — it does not disappear. And the compound knowledge you accumulate across projects is yours regardless of what Claude can do.

### "Just loop a skill in CI/CD until green"

Right instinct. Missing the retry cap, specialist routing, escalation context, and compound learning. Also — CI/CD catches failures after the push. Vector prevents bad pushes.

### "Just set up CLAUDE.md properly"

CLAUDE.md optimises the question. Vector validates the answer. Rules tell Claude what to do. Vector checks if it actually did it. With CLAUDE.md alone, you are still the validator.

---

## How it compounds

First project: add a few rules. Third project: the harness knows your patterns. Simple app, keep it light. Mission-critical, dial it up. Every failure teaches it something — not about Claude, about how you ship.

---

## How it is built

Vector has two main layers:

### 1. Blueprint Orchestrator

Workflow definitions in YAML executed step-by-step with per-step retry logic.

```
blueprints/
├── orchestrator.ts          # Executes blueprints with retry and escalation
├── implement-feature.yaml   # Full feature workflow: setup → implement → test → review → PR
├── fix-bug.yaml             # Bug fix workflow: setup → fix → test → PR
└── refactor.yaml            # Refactor workflow: baseline → refactor → regression → PR
```

Each blueprint step is either deterministic (runs a tool, returns facts) or agent-based (calls a specialist). Deterministic steps sandwich agent steps — agents implement, tools verify. If verification fails, the agent retries. After 3 attempts, the harness escalates with full attempt history, timestamps, and suggested next actions.

### 2. Deterministic Tools

Tools that return facts, not opinions. The agent cannot self-report success.

```
tools/
├── testRunner.ts        # Runs the test suite, returns pass/fail counts
├── coverageValidator.ts # Checks coverage against 80% threshold
├── docValidator.ts      # Verifies required docs exist
└── progressLog.ts       # Structured audit trail of every attempt
```

### 3. PI Enforcer

A Claude Code extension that hooks into git tool calls at commit time.

```
.pi/extensions/enforcer/
├── index.ts                        # Intercepts git commit/add events
└── validators/
    ├── commit-validator.ts         # Enforces commit message format
    ├── test-validator.ts           # Blocks commits without test files
    └── doc-validator.ts            # Blocks commits without doc updates
```

The enforcer registers handlers via the extension API. When a git tool call fires, the enforcer runs all validators. If any gate fails, the commit is blocked with a clear message. The agent cannot proceed without meeting the quality bar.

---

## Status

V1 is built and tested against a sample CRUD app. Manual verification in progress.

Built on a Brompton, between stations. 🫡
