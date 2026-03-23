# Harness Engineering Comparison: Codex vs Minions Prototypes

**Context:** Both prototypes were evaluated against harness engineering principles from the December 2025+ paradigm shift toward long-running autonomous agents. The key principle: **design systems, not prompts**.

---

## Executive Summary

| Aspect | Codex | Minions | Best For |
|--------|-------|---------|----------|
| **Agent Legibility** | Strong (docs structure) | Strong (blueprint execution) | **Codex** - clearer context navigation |
| **Task Breakdown** | Weak (no task manifest) | Strong (explicit steps) | **Minions** - prevents one-shotting |
| **Progress Tracking** | Moderate (feedback only) | Moderate (isolated state) | Tie - both need better handoff docs |
| **Verification Loops** | Strong (linters + tests) | Strong (2-iteration limit) | **Codex** - more feedback channels |
| **Tool Philosophy** | Strong (generic tools) | Moderate (less flexible) | **Codex** - agents can discover tools |
| **Architecture Enforcement** | Very Strong (programmatic) | Moderate (mostly prompt-based) | **Codex** - hard-enforced rules |
| **Parallelization** | Hard (context collision) | Easy (isolated worktrees) | **Minions** - built-in isolation |
| **Session Context** | Needs runtime state visibility | Needs explicit context format | **Minions** - clearer boundaries |

---

## Deep Dive by Harness Principle

### 1. LEGIBLE ENVIRONMENT

**Codex Approach:**
- ✅ Multi-layered docs (ARCHITECTURE.md → docs/ → specific guides)
- ✅ Progressive disclosure (AGENTS.md as table of contents)
- ❌ No runtime state visibility (agents don't see what's currently broken)
- ❌ Static docs (don't update based on agent failures)

**Minions Approach:**
- ✅ Clear blueprint state definition (YAML format is machine-readable)
- ✅ Explicit execution flow with step outputs
- ❌ Context format not formally specified (agents don't know what data is available)
- ❌ No cross-blueprint knowledge base (each blueprint is isolated)

**Harness Engineering Principle:** Agents starting fresh need to understand current state and available context within seconds, not minutes of reading docs.

**Verdict:** **Codex wins for static knowledge; Minions wins for runtime state.** Ideal solution: Codex's doc structure + Minions's state tracking.

**Critical Gap:** Neither has a system for agents to understand "what should I do next?" or "what failed last time and why?"

---

### 2. FEATURE/TASK LISTS (Preventing One-Shotting)

**Codex Approach:**
- ❌ No task manifest (agent decides scope)
- ❌ No priority tracking
- ❌ No completion tracking
- Single MVP test: "Add a user profile page" (agent could expand to add payment, notifications, etc.)

**Minions Approach:**
- ✅ Blueprint steps explicitly decompose work (7-step fix bug, 9-step feature)
- ✅ Max 2 iterations per step enforced (prevents infinite loops)
- ✅ Step dependencies implicit (linting before tests)
- ⚠️ Human defines steps; agent can't propose breakdowns

**Harness Engineering Principle:** Stripe's breakthrough was feature lists (200+ tasks locked in JSON) that prevent agents from claiming victory prematurely.

**Verdict:** **Minions wins decisively.** Codex needs to implement task/feature manifest immediately (CRITICAL gap).

**Recommended Implementation for Codex:**
```markdown
docs/tasks/
├── index.md (all tasks with status)
├── task-001-user-profile.md (status: pending)
├── task-002-auth-system.md (status: pending, blocked-by: task-001)
└── task-003-payment-integration.md (status: pending)
```

---

### 3. PROGRESS TRACKING (Clean State, Handoff Documentation)

**Codex Approach:**
- ✅ Linter/test feedback shows what failed
- ❌ No decision documentation (why did agent choose approach A?)
- ❌ No agent-to-agent handoff notes
- ❌ No intermediate checkpoints
- Single agent per task; no multi-session state

**Minions Approach:**
- ✅ Git isolation ensures clean state per task
- ✅ Explicit PR creation documents work
- ❌ Max 2 iterations means failures are silent (escalation protocol undefined)
- ❌ No breadcrumbs if task takes 2+ days
- ⚠️ Context passing uses `context: any` (not type-safe)

**Harness Engineering Principle:** When agent A hands off to agent B, agent B must understand "we tried approach X, it failed because Y, consider approach Z."

**Verdict:** **Tie - both need work.**

**Critical Implementation Required (Both):**
```markdown
PROGRESS_LOG.md (auto-generated after each session)
---
## Session 2026-03-08 14:30 UTC
Agent: claude-opus
Task: Add user profile page

### Completed
- Created service layer: user.service.ts ✓
- Implemented UI component: UserCard.tsx ✓

### Attempted & Failed
- Used fetch instead of axios (worked but deprecated in this codebase)
- Fix: Switch to existing http service wrapper

### Decisions Made
- See: docs/decisions/adr-user-service-pattern.md
- Rationale: Matches existing service layer pattern

### Next Steps
- Implement edit modal (blocked on form validation schema - see task-002)

### Warnings for Next Agent
- Make sure to clear browser cache when testing auth flow
- UserProfile API endpoint sometimes returns stale data within 30s
```

---

### 4. VERIFICATION/TESTING (Fast Feedback Loops)

**Codex Approach:**
- ✅ Multiple feedback channels (linters, tests, logs)
- ✅ Structured output (JSON-parseable)
- ✅ Pre-commit linter enforcement (proposed in Phase 2)
- ❌ Separate commands (agents must run `npm test`, `npm run lint` independently)
- ❌ No unified verification output

**Minions Approach:**
- ✅ Explicit feedback cycle (linting → agent fix → tests)
- ✅ Limited iterations (2 max) prevents infinite loops
- ✅ Deterministic checks before agent runs (type-check first)
- ❌ Can't request incremental tests (agents can't skip slow test suite)
- ❌ Escalation feedback format undefined

**Harness Engineering Principle:** Agents need sub-second feedback for simple checks, 10-30s for full verification.

**Verdict:** **Codex wins** - more comprehensive feedback channels.

**Critical Implementation (Both):**
```bash
npm run verify          # Full check: types + lint + tests + arch
npm run verify --fast   # Quick check: types + lint only (30s)
npm run verify --ci     # Include coverage + performance tests

# Output (JSON)
{
  "passed": true,
  "duration_ms": 12000,
  "checks": {
    "types": {"passed": true, "errors": 0},
    "lint": {"passed": true, "violations": 0},
    "tests": {"passed": true, "failed": 0, "coverage": "87%"},
    "architecture": {"passed": true, "violations": 0}
  },
  "recommendations": ["Coverage dropped 2%", "Consider refactoring UserService"]
}
```

---

### 5. GENERIC VS SPECIALIZED TOOLS

**Codex Approach:**
- ✅ Uses standard tools (npm, ESLint, git)
- ✅ Agents naturally understand these
- ✅ No proprietary task management layer
- ❌ Custom linters add complexity
- ❌ Agents need to parse structured output

**Minions Approach:**
- ✅ Common abstractions (Step, Blueprint, Context)
- ✅ Standard execution model (deterministic → agent → deterministic)
- ❌ Tool list is static per step (agents can't discover or request tools)
- ❌ Tool composition not designed
- ❌ "Tool shed" mentioned but not specified (critical for real use)

**Harness Engineering Principle:** From Versel's research: agents perform 3.5x better with ONE generic batch tool than with 10 specialized tools. This is because models understand bash, npm, etc. natively.

**Verdict:** **Codex wins slightly** - fewer abstractions between agent and actual tools.

**Recommended Fix (Minions):**
Add tool discovery and composition:
```typescript
// Instead of: tools: ['git', 'code-search']
// Use:
tools: [
  'shell:batch',     // Can run: git, npm, find, grep, etc.
  'editor:code',     // read, write, refactor
  'system:env'       // Understand environment
]

// Agents request additional tools:
"I need to analyze database schema. Request tool: db:query"
```

---

### 6. ARCHITECTURE ENFORCEMENT (Programmatic Invariants)

**Codex Approach:**
- ✅✅ Custom linters enforce layer boundaries (VERY STRONG)
- ✅ File naming conventions enforced
- ✅ Structured logging enforced
- ✅ Pre-commit hooks proposed
- ✅✅ Type-level enforcement possible (TypeScript opaque types)
- ⚠️ Relies on linters running (could be skipped by agent)

**Minions Approach:**
- ✅ Worktree isolation (clean separation per task)
- ✅ Step ordering pattern enforces structure
- ❌ No linters (task validation is trust-based)
- ❌ No programmatic blueprint validation
- ❌ Uses `context: any` (no type safety)
- ❌ Tool access not restricted programmatically

**Harness Engineering Principle:** Stripe's key insight: architecture rules must be mechanical, not cultural. Enforce at pre-commit level.

**Verdict:** **Codex wins decisively.** Minions needs to add linting and type safety.

**Critical Fix for Minions:**
```typescript
// Add blueprint validator
interface BlueprintStep {
  type: 'deterministic' | 'agent';
  name: string;
  // ... other fields with strict types
}

// Enforce invariants
function validateBlueprint(blueprint: Blueprint) {
  // Check: no two deterministic steps in a row without agent between?
  // Check: all tool references exist?
  // Check: context variables are valid?
}

// Use strict TypeScript
interface StepContext {
  readonly sandboxPath: string;
  readonly previousOutputs: ReadonlyMap<string, unknown>;
  readonly availableTools: ReadonlySet<string>;
}
// Prevents agent from mutating context or accessing undefined fields
```

---

## Side-by-Side: MVP Execution

### Codex MVP Test: "Add user profile page"

```
Agent starts:
1. Read AGENTS.md
2. Navigate to docs/DESIGN.md (layers)
3. Check docs/FRONTEND.md (patterns)
4. Create: types → service → UI (correct order)
5. Run linters → failures
6. Fix violations
7. Run tests → pass
8. Create PR

Success metric: All linters + tests pass, code follows architecture
Time estimate: 15-30 minutes
```

**Strengths:**
- Clear doc navigation
- Immediate linter feedback
- Architecture enforced mechanically

**Risks:**
- Agent might expand scope (add auth, notifications, etc.)
- No way to validate "user profile" is complete vs. partial
- Multi-session work not well-supported

---

### Minions MVP Test: "Fix button click bug"

```
Workflow:
1. Create worktree (isolated)
2. Agent: Investigate and fix
3. Run linters → 2 violations found
4. Agent: Fix violations (attempt 1/2)
5. Run tests → all pass
6. Create PR

Success metric: PR created, all checks pass, max 2 iterations per step
Time estimate: 10-20 minutes
```

**Strengths:**
- Clear step-by-step execution
- Explicit iteration limits (cost control)
- Clean state isolation

**Risks:**
- Escalation protocol undefined (what happens if attempt 2 fails?)
- No async task support (multi-day work)
- Context format not specified (agents might not understand state)

---

## Hybrid Approach: Best of Both

**Recommended combined architecture:**

```
Repository Structure:
├── docs/
│   ├── AGENTS.md (Codex nav map)
│   ├── ARCHITECTURE.md (Codex layer rules)
│   ├── tasks/
│   │   └── index.md (Minions task list)
│   ├── decisions/
│   │   └── adr-*.md (progress tracking)
│   └── [all Codex docs structure]
├── BLUEPRINTS.yaml (Minions orchestration)
├── blueprints/
│   ├── fix-bug.yaml
│   ├── implement-feature.yaml
│   └── refactor.yaml
├── .claude/
│   ├── worktrees/ (Minions isolation)
│   └── tasks/ (task state)
└── [Codex linting + architecture enforcement]

Agent Workflow:
1. Read task from docs/tasks/ (Minions clarity)
2. Navigate docs/ for context (Codex structure)
3. Execute blueprint for task (Minions orchestration)
4. Use Codex linters to enforce architecture
5. Document progress in PROGRESS_LOG.md
6. Verify with `npm run verify` (unified feedback)
```

---

## Critical Implementation Priority

### Phase 1: Foundation (Can't Skip)
1. **Codex:** Implement task manifest (docs/tasks/) - CRITICAL
2. **Minions:** Add blueprint validator + type-safe context - CRITICAL
3. **Both:** Create PROGRESS_LOG.md template - CRITICAL

### Phase 2: Integration
4. **Both:** Implement unified `npm run verify` - IMPORTANT
5. **Codex:** Add pre-commit hook enforcement - IMPORTANT
6. **Minions:** Formalize context/tool discovery - IMPORTANT

### Phase 3: Polish
7. **Codex:** Add runtime state visibility (STATUS.md auto-generation) - NICE-TO-HAVE
8. **Minions:** Build "tool shed" meta-tool - NICE-TO-HAVE
9. **Both:** Implement checkpoint system for multi-day tasks - NICE-TO-HAVE

---

## Recommendation: Which to Build First?

**For testing agent autonomy:** Start with **Codex** approach
- More mature pattern (based on OpenAI's actual experience)
- Better for understanding repo-wide context
- Stronger architectural enforcement
- GAP: Need to add task manifest immediately

**For testing constrained, deterministic workflows:** Start with **Minions** approach
- Better cost control (2 iteration limit)
- Clear success criteria (blueprint completion)
- Better for well-defined tasks
- GAP: Need to add state/context documentation immediately

**Recommendation:** Build **both in parallel** with shared infrastructure:
```
Shared:
- docs/ structure (Codex)
- docs/tasks/ manifest (Minions + Codex)
- PROGRESS_LOG.md (both)
- npm run verify (both)
- Pre-commit linting (Codex)
- Blueprints system (Minions)
- Worktree sandbox (both)
```

This way, you test two different execution models but share the underlying legibility infrastructure.

---

## Measurement Framework

### Codex Success Metrics
- ✓ Agent navigates docs correctly (within 2 reads)
- ✓ Linter violations caught before PR
- ✓ Architecture rules unviolated across 5 test tasks
- ✓ Test pass rate > 90%
- ✓ No human intervention needed

### Minions Success Metrics
- ✓ Blueprint executes deterministic → agent → deterministic pattern
- ✓ Agents iterate max 2x per feedback loop
- ✓ Worktrees properly isolated (no cross-contamination)
- ✓ PRs created with correct attribution
- ✓ Escalation context clear and actionable

### Shared Metrics
- ✓ Agent can resume after interruption (context preserved)
- ✓ Progress is documented and auditable
- ✓ Multiple agents can work on same codebase (no conflicts)
- ✓ Cost per task decreases with each attempt (learning)
