# Vector Documentation

Documentation for the Vector enforcement protocol — a composable check-and-enforce system for AI-assisted development workflows.

## Structure

```
docs/vector/
├── v2/                          # Current — V2 CLI
│   ├── plan/                    # Implementation plan and progress
│   ├── review/                  # Adversarial review, verification, scenario tests
│   ├── sessions/                # Design discussion transcripts
│   ├── KEY_CONVERSATIONS.md     # Summary of key design decisions
│   └── SESSION_SUMMARY.md       # Overall session history
├── v1/                          # Legacy — V1 Harness
│   ├── VECTOR_HARNESS_GUIDE.md  # Full verification and usage guide
│   ├── DECISIONS.md             # Architecture decision log
│   ├── BLUEPRINT_ORCHESTRATOR_SUMMARY.md  # TDD implementation summary
│   ├── NEXT_STEPS.md            # V1 implementation roadmap
│   └── observability-pipeline/  # Terminal, JSON, PR comment reporters
└── README.md                    # This file
```

## V2 CLI (Current)

The V2 CLI replaces hardcoded checks with a configurable check registry where every check is a shell command (exit 0 = pass).

| Document | Description |
|----------|-------------|
| [v2/plan/plan.md](v2/plan/plan.md) | 6-phase implementation plan |
| [v2/plan/progress.md](v2/plan/progress.md) | Phase completion tracking |
| [v2/review/adversarial-review.md](v2/review/adversarial-review.md) | Adversarial review — 22 issues found and fixed |
| [v2/review/verification-report.md](v2/review/verification-report.md) | Fix verification report |
| [v2/review/scenario-test-results.md](v2/review/scenario-test-results.md) | 10 manual CLI scenario tests |
| [v2/KEY_CONVERSATIONS.md](v2/KEY_CONVERSATIONS.md) | Summary of key design decisions |
| [v2/SESSION_SUMMARY.md](v2/SESSION_SUMMARY.md) | Overall session history |
| [Tutorial](./../.claude/skills/tutorial/SKILL.md) | Hands-on tutorial with 5 exercises |

## V1 Harness (Legacy)

The original Vector harness with hardcoded tool-based checks (`testRunner`, `coverageValidator`, `docValidator`).

| Document | Description |
|----------|-------------|
| [v1/VECTOR_HARNESS_GUIDE.md](v1/VECTOR_HARNESS_GUIDE.md) | Full verification and usage guide |
| [v1/DECISIONS.md](v1/DECISIONS.md) | Architecture decision log |
| [v1/BLUEPRINT_ORCHESTRATOR_SUMMARY.md](v1/BLUEPRINT_ORCHESTRATOR_SUMMARY.md) | TDD implementation summary for the orchestrator |
| [v1/NEXT_STEPS.md](v1/NEXT_STEPS.md) | V1 implementation roadmap |
| [v1/observability-pipeline/plan.md](v1/observability-pipeline/plan.md) | Observability pipeline plan |
| [v1/observability-pipeline/progress.md](v1/observability-pipeline/progress.md) | Observability pipeline progress |
