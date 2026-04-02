# Vector

An enforcement protocol that makes AI coding agents actually finish what they start.

Claude Code builds it. Vector makes sure it's done.

---

## What is Vector?

Vector is a composable, check-and-enforce protocol for AI-assisted development. Every quality gate is a shell command — exit 0 means pass, non-zero means fail. You define the checks, Vector runs them, retries on failure, and escalates when retries are exhausted.

The core insight: right now, **you** are the enforcement layer. You check, correct, verify. Vector replaces that role with deterministic, configurable verification.

---

## Quick Start

```bash
# Initialize Vector in your project
npx vector init

# Run checks for a vector
npx vector run v1

# Add a custom check
npx vector check add --name lint --run "npm run lint"

# Toggle checks per task
npx vector activate --check test-pass --on --vector v2

# View the latest report
npx vector report
npx vector report --format json
npx vector report --format markdown
```

---

## How It Works

### Check Registry

Every check is a shell command registered in `.vector/config.yaml`:

```yaml
checks:
  test-pass:
    run: "npm test"
    description: "All tests pass"
  no-ts-errors:
    run: "npx tsc --noEmit"
    description: "No TypeScript errors"
  lint:
    run: "npm run lint"
    description: "Linter passes"

vectors:
  v1:
    checks: [test-pass]
  v2:
    checks: [test-pass, no-ts-errors]
  v3:
    checks: [test-pass, no-ts-errors, lint]
```

### Task-Level Overrides

Toggle checks on or off for specific tasks via `.vector/active.yaml` — without changing the project config.

### Retry & Escalation

When a check fails, Vector retries with attempt history. After max retries, it escalates to you with full context — not a mess.

---

## Architecture

```
src/
├── config/     # Schema, loader, defaults for .vector/*.yaml
├── protocol/   # Engine that runs checks → EnforcementReport
├── cli/        # CLI commands (init, run, activate, report, check add)
├── adapters/   # Claude Code hook integration
└── reporters/  # Terminal, JSON, PR comment output
```

The protocol core is **platform-agnostic**. Claude Code integration is an adapter — Vector can work with any AI agent that speaks shell commands.

---

## Why does this need to exist?

**"Claude Code can already iterate and fix things"**
Claude Code can get there eventually. Vector gets there without you. The difference is your presence. With Vector, you assign a task and walk away.

**"Just copy a good .claude setup"**
Copying rules tells Claude what to do. Vector verifies it actually did it. Rules optimise the instruction. Vector validates the outcome.

**"Models will get better — this won't be needed"**
Capability and reliability are different dimensions. A more capable model can still be confidently wrong. Vector gets lighter as models improve — it does not disappear.

**"Just loop a skill in CI/CD until green"**
Right instinct. Missing the retry cap, specialist routing, escalation context, and compound learning. Also — CI/CD catches failures after the push. Vector prevents bad pushes.

---

## Documentation

All documentation lives under [`docs/vector/`](docs/vector/):

| Folder | Description |
|--------|-------------|
| [`docs/vector/v2/`](docs/vector/v2/) | **Current** — V2 CLI implementation plan, reviews, sessions |
| [`docs/vector/v1/`](docs/vector/v1/) | **Legacy** — V1 harness guide, decisions, orchestrator summary |

See [`docs/vector/README.md`](docs/vector/README.md) for the full index.

---

## Status

V2 CLI is implemented and merged. Config schema, protocol engine, CLI commands, reporters, and Claude Code adapter are all built and tested.

Built on a Brompton, between stations.
