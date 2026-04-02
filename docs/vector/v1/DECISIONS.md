# Harness Decisions Log

**Purpose:** Record why decisions were made, what alternatives existed, and what changed over time.

**Format:** Each decision shows problem → reasoning → current approach → when it might change

---

## Architecture: Per-Step Retry Instead of Ralph Loops

**Status:** ✅ FINAL
**Date Decided:** 2026-03-08
**Phase:** Architecture Design
**Related Session:** docs/sessions/2026-03-08-orchestration-design-export.md

### Problem
Agent orchestration needs iteration strategy when tasks fail. Two approaches were considered:
1. Ralph Wiggum loops (same agent, full task retry, up to N iterations)
2. Per-step retry (specialist agents, step-level retry, max 3 attempts per step)

### Alternatives Considered
- **Ralph Loops:** Agent iterates on same task until success
  - Pro: Simpler (one agent, one loop)
  - Con: Inefficient (retry whole task for one failure), agent must be generalist
  - Con: Harder to troubleshoot (which step failed?)

- **Per-Step Retry (CHOSEN):** Specialist agents, retry fails at step level
  - Pro: Efficient (retry only failing step)
  - Pro: Allows specialist agents (Implementer, TestFixer, Reviewer)
  - Pro: Clear escalation points
  - Con: More agent management complexity

### Reasoning
Per-step is more efficient because:
- Only retry the step that failed (not whole task)
- Different agents can attempt same step (Implementer → TestFixer → different approach)
- Clear handoff points (Agent A output → Deterministic check → Agent B input)
- Faster escalation (after 3 attempts, stop and ask human)

### Current Approach

```
Blueprint sequence:
1. Setup (deterministic) → worktree
2. Implement (agent: Implementer)
3. Test (deterministic) → run tests
4. Fix-Tests (agent: TestFixer) - retry max 3 times
5. Review (agent: CodeReviewer)
6. Validate-Docs (deterministic) → check PROGRESS_LOG.md
7. Create-PR (deterministic)

Retry logic:
- Each step has max retries (usually 3)
- Agent sees real output from deterministic checks
- Can't fake results
- After max retries → escalate to human
```

### When This Might Change
- If you find specialist agents aren't better (consolidate to fewer agents)
- If 3 retries consistently isn't enough (increase to 5)
- If escalation overhead too high (change strategy)

### Decision Log
- Initial discussion: Ralph vs Per-step analysis
- Decision made: Per-step is cleaner, more scalable
- Confirmed by: Testing against 3 failure scenarios

---

## Enforcement: Use Direct Tool Use, Not MCP Tools

**Status:** ✅ FINAL
**Date Decided:** 2026-03-08
**Phase:** Architecture Design
**Related Session:** docs/sessions/2026-03-08-orchestration-design-export.md

### Problem
Agent needs to validate its work deterministically (tests pass, coverage OK, docs updated). Could use:
1. MCP tools (Model Context Protocol - standardized, discoverable)
2. Direct tool use (custom functions, direct API)

### Alternatives Considered
- **MCP Tools:** Separate server, standardized protocol
  - Pro: Standardized (works across agents)
  - Pro: Discoverable (agent can list available tools)
  - Con: Extra server overhead
  - Con: Overkill for single orchestration system
  - Con: More complex setup

- **Direct Tool Use (CHOSEN):** Custom functions that return facts
  - Pro: Simple (direct function calls)
  - Pro: Fast (no server hop)
  - Pro: Agent can't fake results (returns actual test output)
  - Con: Only works with this specific agent

### Reasoning
Direct tool use is sufficient because:
- Single orchestration system (not multi-agent tool marketplace)
- Agent can't bypass (tools execute real checks)
- Returns facts, not agent claims (test results are real)
- Simpler to implement and debug

### Current Approach

```typescript
// Tools agent must use:
tools: {
  testRunner: () => {
    // Returns: {passed: N, failed: N, coverage: X}
    // Agent can't claim "tests pass" if they don't
  },

  coverageValidator: () => {
    // Returns: {current: X, threshold: Y, passes: bool}
    // Fact, not opinion
  },

  docValidator: () => {
    // Returns: {hasProgressLog: bool, hasADR: bool, passes: bool}
    // Real file checks
  },

  progressLog: () => {
    // Enforces structure, returns audit trail
  }
}
```

### When This Might Change
- If you need multiple heterogeneous agents with different capabilities (MCP)
- If tool management becomes unmanageable (MCP marketplace)
- If you need cross-team tool sharing (MCP)

---

## Decision Capture: Git + DECISIONS.md + Docs (Not Honcho for Harness)

**Status:** ✅ FINAL
**Date Decided:** 2026-03-08
**Phase:** Architecture Design
**Related Session:** docs/sessions/2026-03-08-orchestration-design-export.md

### Problem
Need to capture WHY decisions were made so:
- Agents understand the reasoning
- Future decisions build on past learning
- Pattern recognition: "We solved this before"
- Root cause analysis: "Why did we add this rule?"

### Alternatives Considered
- **Honcho for harness decisions:** Long-term memory system
  - Pro: Semantic search
  - Pro: Remembers reasoning
  - Con: Overkill for technical decisions in one codebase
  - Con: Creates redundancy (decision is already in code)
  - Con: Complexity without proportional benefit

- **Git + DECISIONS.md + Docs (CHOSEN):** Version-controlled decision log
  - Pro: Integrated with code (git history shows when rules were added)
  - Pro: Human-readable (DECISIONS.md is plain text)
  - Pro: Low overhead (commit messages, markdown)
  - Con: Less semantic search capability
  - Con: Need to maintain manually

### Reasoning
Git + DECISIONS.md is sufficient because:
- Each decision is localized (fixing async tests, adding coverage rule)
- Pattern repetition is low (won't have 1000 decisions)
- Decisions are in code (git blame shows when rule was added)
- Commit messages explain why (Problem → Solution → Tradeoff)

### Current Approach

```
When escalation occurs (e.g., TestFixer fails 3 times):

1. Human identifies root cause
2. Human decides: Add docs? Add tool? Update prompt?
3. Human commits change with message:
   "fix: add async/await patterns to TestFixer prompt

   Problem: TestFixer failing on async DB tests
   Root cause: Pattern not documented
   Solution: Add context to system prompt
   Tradeoff: Prompt size grows but prevents failures
   Result: Task passed on retry"

4. Human updates DECISIONS.md:
   "## AsyncFix Pattern
    Status: In effect
    Date: 2026-03-16
    Details: See git commit abc123"

5. Next time similar issue: git log shows what was tried before
```

### When This Might Change
- If decision count exceeds 100+ (add structured query system)
- If decisions become contradictory (need conflict resolution)
- If pattern recognition becomes valuable (add semantic layer)

---

## Long-term Memory: Honcho for Claude Code Sessions

**Status:** ✅ FINAL
**Date Decided:** 2026-03-08
**Phase:** Architecture Design
**Related Session:** docs/sessions/2026-03-08-orchestration-design-export.md

### Problem
Claude Code sessions are long (hours of conversation). Current state:
- Close session, lose context
- Next session, re-explain everything
- No reference to "what did we discuss about X?"
- Repeat work due to forgotten context

### Alternatives Considered
- **No session storage:** Continue as-is
  - Pro: No extra tools
  - Con: Constant context loss
  - Con: Repetitive explanations
  - Con: Miss pattern recognition

- **Simple file export:** Save conversation as markdown
  - Pro: Simple
  - Con: Not searchable
  - Con: No semantic understanding
  - Con: Hard to reference

- **Honcho for sessions (CHOSEN):** Long-term memory system
  - Pro: Searchable (semantic + keyword)
  - Pro: Cross-session reasoning ("This is like session X")
  - Pro: Preserves context (full conversation + reasoning)
  - Pro: Built for this use case (agent long-term memory)

### Reasoning
Honcho is designed for agent long-term memory across sessions:
- Conversation history is noisy (lots of back-and-forth)
- You want reasoning, not transcript
- Semantic search is valuable ("Find orchestration decisions")
- Pattern recognition: "Last time you built X, you did Y"

### Current Approach

```
At end of Claude Code session:
1. Export conversation
2. Store in Honcho with metadata:
   - title, date, topics, decisions made
   - links to created files
   - summary of outcomes

At start of next Claude Code session:
1. Query Honcho: "Orchestration system"
2. Get: Previous session context + decisions
3. Claude: "Welcome back, here's where you were..."
4. Continue: No context loss

Connection to harness:
- DECISIONS.md links to Honcho sessions
- "See session 2026-03-08 for full reasoning"
- Harness is concise, session is detailed
```

### When This Might Change
- If session count is low (< 10), manual retrieval OK
- If Honcho pricing becomes prohibitive (use local solution)
- If Claude Code adds built-in session management

---

## Agent Type: Use PI Agents for System Building

**Status:** ✅ READY FOR IMPLEMENTATION
**Date Decided:** 2026-03-08
**Phase:** Architecture Design
**Related Session:** docs/sessions/2026-03-08-orchestration-design-export.md

### Problem
Need to build the orchestration system itself (tools, hooks, blueprints). Options:
1. Manual implementation (you code it)
2. Claude Code (one agent, one session)
3. PI agents (specialized agents, orchestrated)

### Alternatives Considered
- **Manual implementation:** You write code
  - Pro: Direct control
  - Con: Time-intensive
  - Con: Not learning from agent patterns

- **Claude Code:** Use this session to build
  - Pro: Continuous context
  - Con: One shot (build, hope it works)
  - Con: Not testing during build

- **PI Agents (CHOSEN):** 3 specialized agents
  - Pro: Architect → Builder → Validator pipeline
  - Pro: Each agent specialized
  - Pro: Validate before using
  - Con: Setup overhead

### Reasoning
PI agents are good because:
- Architect designs, Builder implements, Validator tests
- Feedback loop: Design → Build → Validate → Iterate
- Each agent expert in their role
- Can iterate if validation fails
- Learn from building your own tools

### Current Approach

```
Phase 2: PI Agent Implementation

3 agents:
1. Harness Architect
   - Reads: Requirements, design principles
   - Outputs: Detailed architecture document

2. Harness Builder
   - Reads: Architecture document
   - Outputs: Working code (tools, hooks, blueprints)

3. System Validator
   - Reads: Implementation
   - Outputs: Test results, issues found, fixes needed

Process:
Architect → Builder → Validator → (if fails) iterate
```

### When This Might Change
- If you realize manual is faster (abandon PI approach)
- If PI agents are overkill (use Claude Code directly)

---

## Review & Maintenance

**Last Reviewed:** 2026-03-08
**Next Review:** After Phase 2 (PI Agent Implementation)
**Maintainer:** (You)

### How to Update This File
When you make a harness decision:
1. Add section with date, status, problem, alternatives, reasoning
2. Link to related session in Honcho
3. Mark as FINAL or READY FOR IMPLEMENTATION
4. Add "When This Might Change" section

When you change a decision:
1. Update Status (FINAL → REVIEWING → CHANGED)
2. Add "Date Changed" and "Reason"
3. Add "Decision Log" showing evolution
4. Keep old decision for history

---

## Index of All Decisions

```
✅ Per-Step Retry Architecture       (FINAL)
✅ Direct Tool Use, Not MCP          (FINAL)
✅ Git + DECISIONS.md, Not Honcho    (FINAL)
✅ Honcho for Claude Code Sessions   (FINAL)
✅ Use PI Agents for Building        (READY FOR IMPL)
```

**Total Decisions:** 5
**Status:** All finalized, ready for Phase 2 implementation
**Next Action:** Run PI Architect agent

---

*This file is the source of truth for harness decisions. Update it as you build and learn.*
