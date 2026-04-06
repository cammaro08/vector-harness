# Vector V2 Documentation

All documentation for the Vector V2 CLI implementation.

## Structure

```
docs/vector/v2/
├── plan/                        # Implementation plan and progress
│   ├── plan.md                  # 6-phase implementation plan
│   └── progress.md              # Phase completion tracking
├── review/                      # Adversarial review process
│   ├── adversarial-review.md    # 22 issues found (Opus agent)
│   ├── verification-report.md   # Fix verification (Opus agent)
│   └── scenario-test-results.md # 10 manual CLI scenario tests
├── sessions/                    # Design discussion sessions
│   ├── 2026-03-31-vector-as-protocol.md
│   ├── 2026-04-01-debate.md
│   └── 2026-04-01-debate-review.md
├── KEY_CONVERSATIONS.md         # Summary of key design decisions
└── SESSION_SUMMARY.md           # Overall session history
```

## Features

The V2 CLI includes:
- **Configurable check registry** — Define checks in `.vector/config.yaml`, every check is a shell command (exit 0 = pass)
- **Interactive mode** — Interactive prompts for `vector init` and `vector check add`
- **Non-interactive mode** — Use `--yes` flag or pass options directly for CI/CD and automation
- **Retry & escalation** — Automatic retry on failure with attempt history, escalation when exhausted
- **Task-level overrides** — Toggle checks on/off per task via `.vector/active.yaml`
- **Multiple reporters** — Terminal, JSON, and GitHub PR comment output formats

## Quick Links

- **What is Vector V2?** See [plan/plan.md](plan/plan.md)
- **Current status:** See [plan/progress.md](plan/progress.md)
- **Adversarial review:** See [review/adversarial-review.md](review/adversarial-review.md)
- **Verification:** See [review/verification-report.md](review/verification-report.md)
- **Scenario tests:** See [review/scenario-test-results.md](review/scenario-test-results.md)
