# Vector v2 — CLI Tool for Composable Enforcement Protocol

**Created:** 2026-04-02
**Branch:** `feat/vector-v2-cli`
**Source of truth:** `docs/sessions/2026-03-31-vector-as-protocol.md`

---

## Requirements Restatement

Build a CLI tool (`vector`) that lets developers configure and run the Vector enforcement protocol at **project level** and **per-task level** for Claude Code. This is a full overhaul — v1's hardcoded check implementations (`testRunner.ts`, `coverageValidator.ts`, `docValidator.ts`) are replaced by a **check registry** model where every check is just a shell command with an exit code.

### What the CLI does

1. `vector init` — scaffold `.vector/config.yaml` + wire Claude Code hooks
2. `vector run <vector>` — run checks for a specific vector (v1–v5) against the active config
3. `vector activate` — toggle checks on/off for the current task (writes `.vector/active.yaml`)
4. `vector report` — display the last enforcement report
5. `vector check add` — add a new check to the project registry

### Architecture (from session doc)

```
┌─────────────────────────────────────┐
│         ADAPTER (Claude Code)       │
│  Hooks: PostToolUse → v2            │
│         Stop → v1                   │
├─────────────────────────────────────┤
│         PROTOCOL (core)             │
│  run() → CheckResult[] → retry →   │
│  EnforcementReport                  │
├─────────────────────────────────────┤
│       CHECK REGISTRY (per project)  │
│  .vector/config.yaml                │
│  .vector/active.yaml                │
└─────────────────────────────────────┘
```

### Key constraints

- Every check is a shell command. Exit 0 = pass. Non-zero = fail.
- Vector does NOT own orchestration (retry strategy is the adapter's job beyond max retries)
- Vector does NOT inject context — it only verifies conditions
- The protocol core is platform-agnostic; Claude Code integration is an adapter
- Config format is YAML (`.vector/config.yaml` for project, `.vector/active.yaml` for task)
- Reporters carry over from v1: terminal, JSON, PR comment (same `EnforcementReport` shape)

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking v1 validation harness | HIGH | Keep `EnforcementReport` type unchanged; v2 protocol produces the same shape |
| YAML parsing edge cases | MEDIUM | Use `js-yaml` (already a dependency); validate config schema at load time |
| Shell command injection via config | HIGH | Never interpolate user input into commands; commands come from developer-authored config files only |
| Hook wiring conflicts with existing hooks | MEDIUM | `vector init` merges into existing hooks, doesn't overwrite |
| Retry loop burning tokens on Claude Code | LOW | Default maxRetries=3, configurable per check |

---

## Phase Breakdown

### Phase 1: Config Schema & Loader
**Goal:** Define and validate `.vector/config.yaml` and `.vector/active.yaml` formats

**Files:**
- `src/config/schema.ts` — TypeScript types for config and active YAML
- `src/config/loader.ts` — load, validate, merge project + task configs
- `src/config/defaults.ts` — default starter config for `vector init`

**Types:**
```typescript
interface VectorConfig {
  version: '2';
  checks: Record<string, CheckDefinition>;
  vectors: Record<VectorName, VectorDefinition>;
  defaults: { maxRetries: number; timeout: number };
}

interface CheckDefinition {
  run: string;           // shell command
  expect: 'exit-0';     // exit code expectation
  capture?: 'stdout' | 'stderr' | 'both';
  enabled: boolean;
  timeout?: number;      // ms, overrides default
}

type VectorName = 'v1' | 'v2' | 'v3' | 'v4' | 'v5';

interface VectorDefinition {
  trigger: string;       // human-readable: "conversation end", "git commit", etc.
  checks: string[];      // references to check names in the registry
}

interface ActiveConfig {
  vectors: Partial<Record<VectorName, string[]>>;  // per-task overrides
}
```

**Tests:**
- Valid config loads correctly
- Invalid config (missing fields, bad types) throws descriptive errors
- Active config merges with project config (task overrides project)
- Missing active.yaml falls back to project defaults

---

### Phase 2: Protocol Engine (Core)
**Goal:** Platform-agnostic engine that runs checks and produces `EnforcementReport`

**Files:**
- `src/protocol/runner.ts` — execute a single check (spawn command, capture output, check exit code)
- `src/protocol/engine.ts` — run all active checks for a vector, handle retries, produce report
- `src/protocol/types.ts` — re-export `CheckResult`, `EnforcementReport` from v1 (backwards compatible)

**Behavior:**
1. Takes a list of `CheckDefinition`s to run
2. Spawns each command via `child_process.execSync` (or `exec` with timeout)
3. Maps exit code to `CheckResult` (exit 0 → passed, else → failed)
4. Captures stdout/stderr per `capture` config
5. On failure: retries up to `maxRetries` with the same command
6. After all checks: produces `EnforcementReport` using existing immutable builder functions
7. Returns the report

**Tests:**
- Passing check produces `{ status: 'passed' }`
- Failing check produces `{ status: 'failed' }` with captured output
- Retry on failure, succeed on retry 2 → report shows retry info
- All retries exhausted → report has escalation info
- Timeout kills the process and marks as failed
- Report shape matches v1 `EnforcementReport` exactly

---

### Phase 3: CLI Commands
**Goal:** The `vector` CLI with subcommands

**Files:**
- `src/cli/index.ts` — entry point, argument parsing (no heavy deps — use `process.argv` parsing or minimal arg parser)
- `src/cli/commands/init.ts` — scaffold config + wire hooks
- `src/cli/commands/run.ts` — run a vector's checks
- `src/cli/commands/activate.ts` — toggle checks per task
- `src/cli/commands/report.ts` — display last report
- `src/cli/commands/check-add.ts` — add a check to registry
- `bin/vector` — executable entry point (hashbang + ts-node or compiled JS)

**`vector init`:**
1. Creates `.vector/config.yaml` with starter checks (test-pass, no-ts-errors)
2. Creates `.claude/settings.local.json` hooks (or merges into existing)
3. Prints success message with next steps

**`vector run v1|v2|v3|v4|v5`:**
1. Loads config + active overrides
2. Resolves which checks to run for the given vector
3. Calls protocol engine
4. Outputs report via terminal reporter
5. Writes JSON report to `.vector/reports/`
6. Exit code: 0 if pass, 1 if fail

**`vector activate [--check <name> --on|--off] [--vector <v1-v5>]`:**
1. Reads current `.vector/active.yaml` (or creates it)
2. Toggles the specified check on/off for the specified vector
3. Writes updated active.yaml

**`vector report [--format terminal|json|markdown]`:**
1. Reads latest report from `.vector/reports/`
2. Formats and displays it

**`vector check add --name <name> --run <command>`:**
1. Reads config.yaml
2. Adds new check definition
3. Writes updated config.yaml

**Tests:**
- `vector init` creates expected files
- `vector run v2` executes the right checks
- `vector activate` modifies active.yaml correctly
- `vector report` reads and displays the latest report
- CLI exits with correct codes

---

### Phase 4: Claude Code Adapter
**Goal:** Wire Vector into Claude Code hooks so it runs automatically

**Files:**
- `src/adapters/claude-code.ts` — adapter logic (thin: reads active config, calls engine, formats output)
- Hook configuration generated by `vector init`

**Hook wiring (generated by `vector init`):**
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "tool === 'git' && input.includes('commit')",
      "command": "npx vector run v2"
    }],
    "Stop": [{
      "command": "npx vector run v1"
    }]
  }
}
```

**Behavior:**
- On commit hook: runs v2 checks, blocks commit if fail, feeds report to agent context
- On stop hook: runs v1 checks (full suite), blocks session end if fail
- Output: terminal report to stdout (Claude Code captures this)

**Tests:**
- Adapter calls engine with correct vector
- Hook config format is valid Claude Code settings
- Failure output is structured for agent consumption

---

### Phase 5: Reporters (Carry Forward from v1)
**Goal:** Connect v2 engine output to existing reporters

**Files:**
- `src/reporters/terminal.ts` — wraps existing `terminalReporter.ts`
- `src/reporters/json.ts` — wraps existing `jsonLogger.ts`
- `src/reporters/pr-comment.ts` — wraps existing `ghPrCommenter.ts`

Since the `EnforcementReport` shape is unchanged, reporters should work as-is. This phase is about:
1. Moving reporters into the new `src/` structure
2. Adding a reporter selection mechanism (config-driven)
3. Ensuring the CLI `run` command uses the right reporter

**Tests:**
- Terminal output matches expected format
- JSON output has `_meta` envelope
- PR comment markdown renders correctly

---

### Phase 6: Migration & Cleanup
**Goal:** Remove v1 hardcoded checks, update package.json, update docs

**Tasks:**
- Move v1 `tools/enforcementReport.ts` types into `src/protocol/types.ts` (re-export for backwards compat)
- Delete v1 check implementations: `testRunner.ts`, `coverageValidator.ts`, `docValidator.ts`
- Keep validation harness working (it uses `EnforcementReport` — should still work)
- Update `package.json`: add `bin` field for `vector` CLI
- Update `CLAUDE.md` with v2 usage instructions
- Update `README.md` with v2 overview

**Tests:**
- Validation harness still passes (41 tests)
- `npx vector init` + `npx vector run v2` works end-to-end on a sample project

---

## Dependency Graph

```
Phase 1 (Config) ─────┐
                       ├── Phase 3 (CLI) ── Phase 4 (Adapter)
Phase 2 (Engine) ──────┘        │
                                ├── Phase 5 (Reporters)
                                │
                         Phase 6 (Migration)
```

- Phases 1 and 2 can be done in parallel
- Phase 3 depends on both 1 and 2
- Phase 4 depends on 3
- Phase 5 can start after Phase 2 (reporter wiring) but CLI integration needs Phase 3
- Phase 6 is last (cleanup after everything works)

---

## File Structure (Target)

```
src/
├── config/
│   ├── schema.ts
│   ├── loader.ts
│   └── defaults.ts
├── protocol/
│   ├── types.ts          # re-exports EnforcementReport, CheckResult
│   ├── runner.ts         # single check executor
│   └── engine.ts         # orchestrates checks → report
├── cli/
│   ├── index.ts          # CLI entry point
│   └── commands/
│       ├── init.ts
│       ├── run.ts
│       ├── activate.ts
│       ├── report.ts
│       └── check-add.ts
├── adapters/
│   └── claude-code.ts
└── reporters/
    ├── terminal.ts
    ├── json.ts
    └── pr-comment.ts
bin/
└── vector               # executable entry point
```

---

## Definition of Done

- [ ] `vector init` creates `.vector/config.yaml` and wires Claude Code hooks
- [ ] `vector run v1` executes all active checks and produces an `EnforcementReport`
- [ ] `vector activate --check test-pass --on --vector v2` modifies active.yaml
- [ ] Checks are shell commands — no Vector-owned test runner, coverage tool, or doc checker
- [ ] Retry logic works (fail → retry → pass shows in report)
- [ ] Terminal, JSON, and PR comment reporters produce correct output
- [ ] Validation harness (41 tests) still passes
- [ ] 80%+ test coverage on new code
- [ ] `CLAUDE.md` updated with v2 usage
