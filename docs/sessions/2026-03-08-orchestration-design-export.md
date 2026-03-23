# Session Export: Orchestration System Design & Harness Engineering

**Date:** 2026-03-08
**Duration:** ~4 hours
**Status:** Active (Ready for Implementation)
**Topics:** #harness #orchestration #blueprint #decisions #agents

---

## Executive Summary

This session focused on designing a deterministic enforcement harness for agent orchestration. We moved from initial prototypes (Codex approach, Minions approach) through harness engineering principles to a final architecture using PI agents with per-step retry logic.

**Key Outcome:** A clear 3-agent sequence model with per-step retry (max 3 attempts) instead of Ralph loops, storing decisions in git + DECISIONS.md.

---

## Decisions Made

### 1. **Architecture Model: Agent Sequencing Over Ralph Loops**
- **Status:** FINAL
- **Rationale:** Per-step retry allows specialist agents, clearer handoff points, more efficient than Ralph iterations
- **Tradeoff:** More agent management complexity vs. better separation of concerns
- **Implementation:** Implementer → TestFixer → Reviewer → PR
- **Max Retries:** 3 attempts per step
- **Escalation:** After 3 attempts, escalate to human with full context

### 2. **No MCP Tools - Use Direct Tool Use Instead**
- **Status:** FINAL
- **Rationale:** Single orchestration system doesn't need MCP overhead. Direct function calls sufficient.
- **Tools Needed:** testRunner, coverageCheck, docValidator, progressLog
- **These are:** Direct functions that return facts (not agent claims)
- **Key Insight:** Agent can't fake test results if tool executes real tests

### 3. **Harness Foundation: Git + DECISIONS.md + Docs**
- **Status:** FINAL
- **Don't use:** Honcho for harness decisions (overkill)
- **Do use:**
  - Git commits with decision context (Problem → Solution → Tradeoff → Result)
  - DECISIONS.md for structured decision log
  - Docs (TESTING.md, etc.) for agent knowledge
- **Pattern:** When escalation occurs, update harness (not manual fixes)

### 4. **Use Honcho for Claude Code Session History**
- **Status:** FINAL
- **Purpose:** Store conversation history across Claude Code sessions
- **Use Case:** Reference previous discussions, pick up context, avoid repetition
- **Implementation:** Export sessions to Honcho with tags/metadata
- **Connection:** Link from DECISIONS.md to Honcho sessions for full context

### 5. **Use PI Agents for System Building**
- **Status:** READY FOR IMPLEMENTATION
- **Approach:**
  - Create 3 specialized PI agents (Architect, Builder, Validator)
  - Architect designs the system
  - Builder implements it
  - Validator tests it
- **Philosophy:** "There are many coding agents, but this one is mine"
- **Benefit:** System optimized for your specific constraints

### 6. **Deterministic Enforcement Model**
- **Status:** FINAL
- **Layers:**
  1. Tool use: testRunner, coverageCheck, docValidator (returns facts)
  2. Claude hooks: beforePush validation
  3. Per-step retry: Agent sees failures, iterates
  4. CI/CD: Server-side final validation
- **Key:** Can't fake results because tools execute real checks

---

## Artifacts Created

### Documentation Files
```
docs/investigation/
├── prototype_codex_approach.md
│   MVP for: Document-first architecture
│   Status: Reference (not implementing directly)
│
├── prototype_minions_approach.md
│   MVP for: Blueprint orchestration
│   Status: Influenced final design
│
├── harness_engineering_comparison.md
│   Comprehensive: Codex vs Minions vs Harness Principles
│   Status: Reference for understanding tradeoffs
│
├── ralph_wiggum_hybrid_integration.md
│   Topic: Why Ralph loops work, how to integrate
│   Status: Research (decided against Ralph)
│
├── pi_agent_build_strategy.md
│   Implementation: Using PI agents to build harness
│   Status: NEXT PHASE - Ready for implementation
│
└── indydev_pi_coding.md
    Reference: PI agent customization possibilities
    Status: Reference for extending harness
```

### Blueprints to Create
```
blueprints/
├── implement-feature.yaml
│   Steps: Setup → Implement → Test → Fix → Review → Docs → PR
│   Max retries: 3 per step
│   Escalation: After step 3, create GitHub issue
│
├── fix-bug.yaml
│   Similar structure, optimized for bug fixes
│
└── refactor.yaml
    Similar structure, optimized for refactoring
```

### System Components to Build
```
orchestration-system/
├── mcp-tools/
│   ├── testRunner.ts
│   ├── coverageValidator.ts
│   ├── docValidator.ts
│   └── progressLog.ts
│
├── claude-hooks/
│   └── beforeCommit.ts
│
├── blueprints/
│   └── (YAML files above)
│
├── pi-extensions/
│   ├── till-done.ts
│   ├── task-manager.ts
│   └── progress-tracker.ts
│
└── docs/tasks/
    └── Task manifest system (index.md + templates)
```

---

## Implementation Roadmap

### Phase 1: Design (COMPLETE ✓)
- [x] Compare Codex, Minions, Ralph approaches
- [x] Understand harness engineering principles
- [x] Design per-step retry architecture
- [x] Decide on PI agents
- [x] Plan decision capture system

### Phase 2: PI Agent Implementation (NEXT)
- [ ] Set up PI agents locally
- [ ] Create Harness Architect prompt
- [ ] Create Harness Builder prompt
- [ ] Create System Validator prompt
- [ ] Run sequentially: Architect → Builder → Validator
- [ ] Validate output

### Phase 3: Tool Implementation (AFTER PHASE 2)
- [ ] Build testRunner tool
- [ ] Build coverageValidator tool
- [ ] Build docValidator tool
- [ ] Build progressLog tool
- [ ] Create Claude hooks

### Phase 4: Blueprint Creation (AFTER PHASE 3)
- [ ] Create implement-feature blueprint
- [ ] Create fix-bug blueprint
- [ ] Create refactor blueprint
- [ ] Test on simple CRUD app

### Phase 5: Validation (AFTER PHASE 4)
- [ ] Test on 5 CRUD tasks
- [ ] Measure success rate
- [ ] Identify failure patterns
- [ ] Update harness based on failures
- [ ] Target: 95%+ success rate

### Phase 6: Documentation & Long-term Memory
- [ ] Export sessions to Honcho
- [ ] Tag with topics
- [ ] Create session index
- [ ] Set up Honcho integration with Claude Code
- [ ] Link decisions to sessions

---

## Key Insights & Decisions

### Why Not Ralph Loops?
- Ralph = same agent iterates until success
- Per-step retry = specialist agents retry specific steps
- Per-step is more efficient (don't retry whole task)
- Allows fallback (if TestFixer fails, try different approach)

### Why Not MCP Tools?
- You don't need inter-agent tool discovery
- Direct tool use is simpler and faster
- MCP overhead not justified for single orchestration system
- Save MCP for when you have true multi-agent tool marketplace

### Why Honcho for Sessions, Not Harness Decisions?
- Honcho excels at: Long-form conversation context, semantic search, reasoning preservation
- DECISIONS.md excels at: Structured facts, version control, clear current state
- They serve different purposes:
  - Honcho: "How did we arrive at this decision?" (journey)
  - DECISIONS.md: "What did we decide?" (destination)

### Why PI Agents?
- Customizable to your exact constraints
- No vendor lock-in
- Can optimize for deterministic enforcement
- Extensions allow building exactly what you need
- Philosophy aligns: "This one is mine"

---

## Open Questions & Future Considerations

### Short-term
- [ ] How many attempts is enough before escalation? (Currently: 3)
- [ ] Should different agents have different retry limits?
- [ ] What triggers a human escalation vs. automatic fallback?

### Medium-term
- [ ] How do you handle task dependencies? (Task B blocked on Task A)
- [ ] Multi-team orchestration? (Multiple agents, multiple codebases)
- [ ] Cross-codebase decisions? (This pattern solved this problem in Project X)

### Long-term
- [ ] How does this scale to 100+ agents?
- [ ] Conflict resolution when decisions contradict?
- [ ] Continuous harness improvement (agents improve the harness itself)?

---

## Honcho Integration Instructions

### Setup
```bash
# Install Honcho
pip install honcho

# Set API key
export HONCHO_API_KEY="your_key"
```

### Store This Session
```python
from honcho import Honcho

honcho = Honcho(api_key="your_key")

# Create session
session = honcho.sessions.create(
  name="claude-code-orchestration-2026-03-08",
  metadata={
    "title": "Orchestration System Design & Harness Engineering",
    "date": "2026-03-08",
    "topics": ["harness", "orchestration", "blueprint", "decisions"],
    "decisions": [
      "per-step-retry-architecture",
      "no-mcp-tools",
      "use-pi-agents",
      "git-based-decision-log",
      "honcho-for-sessions"
    ],
    "status": "active",
    "phase": "ready-for-implementation"
  }
)

# Store conversation in session
# (Full conversation content here)
```

### Retrieve in Future Sessions
```python
# Search for orchestration sessions
results = honcho.search(
  query="orchestration harness",
  metadata_filter={"topics": "orchestration"}
)

# Load previous decisions
previous = honcho.sessions.get("claude-code-orchestration-2026-03-08")
```

---

## Files to Update/Create

### Immediate (Today)
- [ ] `docs/sessions/2026-03-08-orchestration-design-export.md` (this file)
- [ ] `DECISIONS.md` - Add entry linking to this session

### This Week
- [ ] `docs/CLAUDE.md` - Document session management workflow
- [ ] `IMPLEMENTATION_PLAN.md` - Detailed roadmap from Phase 2 onwards

### Next Session
- [ ] Run PI agent Architect
- [ ] Run PI agent Builder
- [ ] Run PI agent Validator

---

## How to Use This Export

### For Next Claude Code Session
```markdown
# Loading from this export:

1. Read: Executive Summary (above)
2. Scan: Decisions Made (what we committed to)
3. Check: Implementation Roadmap (what's next)
4. Reference: Artifacts Created (what exists)
5. Load: Full conversation in Honcho (if you need context)

Then start: Phase 2 (PI Agent Implementation)
```

### For Team Onboarding
```markdown
Send this export to new team member:
- They understand the WHY (decision context)
- They see the WHAT (what was decided)
- They know the NEXT (what comes next)
- They can access FULL CONTEXT (Honcho session)
```

### For Pattern Recognition Later
```markdown
When you encounter similar problem:
- Query Honcho: "Find sessions about X"
- Get: Previous conversation + reasoning
- See: What worked, what didn't
- Apply: Pattern to new problem
```

---

## Related Files in This Repo

```
/home/talha/dev/vector/docs/investigation/
├── minions_indydevdantranscript.md (Reference: Stripe minions)
├── codex_agent.md (Reference: OpenAI Codex approach)
├── indydev_pi_coding.md (Reference: PI agent capabilities)
└── (5 analysis/design files created during session)
```

---

## Session Metadata

```json
{
  "id": "session-2026-03-08-orchestration",
  "title": "Orchestration System Design & Harness Engineering",
  "date": "2026-03-08",
  "duration_hours": 4,
  "status": "active",
  "phase": "ready-for-implementation",
  "topics": ["harness", "orchestration", "blueprint", "agents", "decisions"],
  "decisions_count": 6,
  "artifacts_count": 5,
  "implementation_phases": 6,
  "next_action": "Run PI agent Architect",
  "estimated_implementation_time": "30-40 hours",
  "stored_in": "docs/sessions/2026-03-08-orchestration-design-export.md",
  "honcho_session": "claude-code-orchestration-2026-03-08"
}
```

---

## Summary for Honcho Storage

**What to store in Honcho:**
- Full conversation transcript
- This export (decisions + roadmap)
- Tags: orchestration, harness, blueprint, agents
- Links: To this file + DECISIONS.md

**Purpose:**
- Reference in future sessions
- Search for similar patterns
- Avoid repeating same discussions
- Build institutional memory

---

*Export generated at end of session. Ready for Honcho storage and next phase implementation.*
