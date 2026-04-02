# Vector Documentation

Documentation for the Vector enforcement protocol — a composable check-and-enforce system for AI-assisted development workflows.

## Documents

### General

| Document | Description |
|----------|-------------|
| [VECTOR_HARNESS_GUIDE.md](VECTOR_HARNESS_GUIDE.md) | Full verification and usage guide for the Vector harness |
| [DECISIONS.md](DECISIONS.md) | Architecture decision log — why choices were made and what alternatives existed |
| [BLUEPRINT_ORCHESTRATOR_SUMMARY.md](BLUEPRINT_ORCHESTRATOR_SUMMARY.md) | TDD implementation summary for the blueprint orchestrator |
| [NEXT_STEPS.md](NEXT_STEPS.md) | Implementation roadmap (post-design session) |

### Observability Pipeline (v1, completed)

| Document | Description |
|----------|-------------|
| [observability-pipeline/plan.md](observability-pipeline/plan.md) | Layered observability plan — terminal, JSON, PR comment reporters |
| [observability-pipeline/progress.md](observability-pipeline/progress.md) | Phase completion tracking |

### Vector V2 CLI

The V2 CLI replaces hardcoded checks with a configurable check registry where every check is a shell command. See [v2/README.md](v2/README.md) for the full index.

| Folder | Contents |
|--------|----------|
| [v2/plan/](v2/plan/) | 6-phase implementation plan and progress tracking |
| [v2/review/](v2/review/) | Adversarial review (22 issues), verification report, scenario test results |
| [v2/sessions/](v2/sessions/) | Design discussion transcripts (protocol debate, pre-merge review) |
| [v2/KEY_CONVERSATIONS.md](v2/KEY_CONVERSATIONS.md) | Summary of key design decisions |
| [v2/SESSION_SUMMARY.md](v2/SESSION_SUMMARY.md) | Overall session history |
