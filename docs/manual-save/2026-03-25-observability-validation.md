# Manual Instructions — 2026-03-25

**Session:** Building repeatable validation harness for observability pipeline
**Branch:** feat/observability-validation

## Functional Requests

### 1. Create a repeatable validation harness
**What:** Build a validation system that can grow as new features are added, not a one-off test
**Why:** New observability features will be added over time and each needs verifiable output
**Outcome:** Created scenario-based harness in `tools/validation/` with 6 scenarios, CLI runner, and tag-based filtering

### 2. Use sonnet sub-agents for implementation
**What:** Delegate implementation work to sonnet-level sub-agents rather than doing everything in the main conversation
**Why:** Cost efficiency and parallelization — sonnet handles implementation while opus orchestrates
**Outcome:** 3 parallel sonnet agents built types+registry, runner, and scenarios concurrently

### 3. Clean up redundant tests
**What:** Analyze and remove tests that were testing the same thing multiple times
**Why:** Agent-generated tests had per-scenario duplication (same assertions repeated 6x)
**Outcome:** Reduced from 90 to 41 tests with zero coverage loss

### 4. Add harness instructions to CLAUDE.md
**What:** Document the validation harness in the project's CLAUDE.md so future agents know how to use and extend it
**Why:** Without instructions, future agents won't know the harness exists or how to add scenarios
**Outcome:** Added full section with running commands, adding scenarios guide, and structure reference

### 5. Create manual-instruction-save skill
**What:** Build a skill that captures ad-hoc functional requests from conversations into `docs/manual-save/`
**Why:** Functional decisions made in conversation are lost after the session — this preserves them as a pattern library
**Outcome:** Created skill at `~/.claude/.agents/skills/manual-instruction-save/` and command at `~/.claude/commands/manual-instruction-save.md`

### 6. Document custom skills in CLAUDE.md
**What:** Add documentation for `/talha-style` and `/manual-instruction-save` skills to the project CLAUDE.md
**Why:** Future agents need to know these skills exist and when to use them
**Outcome:** Added "Custom Skills" section to CLAUDE.md with usage docs for both skills

### 7. Merge all open PRs
**What:** Merge the full chain of PRs (#8 into feat/observability, #7 into main)
**Why:** All work is complete — observability pipeline + validation harness ready for main
**Outcome:** Both PRs merged to main

### 8. Move completed plan to archive folder
**What:** Move `docs/active-plan/` to `docs/completed/observability-pipeline/`
**Why:** Work is done — active-plan should only contain in-progress work
**Outcome:** Created `docs/completed/` as archive for finished plans, moved via PR #9

## Process Preferences

- Use sonnet sub-agents for implementation work, opus for orchestration
- Commit after every meaningful change, not just at the end
- Keep tests lean — consolidate rather than duplicate per-scenario
- Document extensibility points in CLAUDE.md for future agents
- Archive completed plans to `docs/completed/<project-name>/` — keep `docs/active-plan/` clean
- Always create PRs even for housekeeping (main branch is protected)

## Patterns to Repeat

- Scenario-based validation pattern: one file per scenario, barrel export, tag filtering
- Parallel sub-agent execution for independent implementation tasks
- Post-implementation cleanup pass to remove agent-generated bloat
- Updating CLAUDE.md when creating new subsystems that future agents need to know about
- Run `/manual-instruction-save` at end of session to capture decisions
- Move completed plans out of active-plan immediately after merging
