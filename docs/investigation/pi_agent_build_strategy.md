# Using PI Coding Agent to Build Your Orchestration System

**Core insight:** Don't have Claude build the harness. Use PI (the customizable agent framework) to build it. Then use that harness to orchestrate other agents.

---

## Why PI is Perfect for This

From the transcript, PI's core strengths are:

| Capability | Why It Matters for Your System |
|-----------|--------------------------------|
| **Fully customizable agent harness** | Build enforcement rules that agents can't bypass |
| **Extension system (TypeScript)** | Create MCP tools, hooks, custom commands |
| **Till-done workflow** | Agents iterate until rules pass (no shortcuts) |
| **Agent teams/orchestration** | Multi-agent workflows out of the box |
| **Open source** | You control everything, no lock-in |
| **Multi-agent chains/pipelines** | Ralph Wiggum-style iteration built-in |
| **Hooks system (25+ hooks)** | Deterministic enforcement at every stage |

**Compare to Claude Code:**
- Claude Code: Great defaults, harder to customize deeply
- PI: Minimal defaults, infinitely customizable

Your requirements (deterministic enforcement, MCP tools, Ralph loops, task manifests) are **exactly** what PI was built for.

---

## Your PI Customization Strategy

You need 3 custom PI agents to build and maintain your system:

### **Agent 1: Harness Architect**
**Purpose:** Design the orchestration system architecture

**Custom system prompt:**
```
You are the Harness Architect for an agent orchestration system.

Your job is to design deterministic enforcement rules that agents CANNOT bypass.

REQUIREMENTS:
- MCP tools for tests, coverage, docs (agent must use them, can't fake results)
- Hooks that prevent commits without validation
- Ralph Wiggum loop integration (agents iterate until success)
- Task manifest system (docs/tasks/ with status tracking)
- Multi-agent orchestration (blueprints for implement-feature, fix-bug, refactor)

ARCHITECTURE MUST INCLUDE:
1. Deterministic enforcement layer (MCP tools)
   - testRunner: returns {passed, failed, coverage}
   - coverageValidator: returns {current, threshold, passes}
   - docValidator: returns {hasProgressLog, hasADR, isValid}
   - progressLog: enforces structure, returns audit trail

2. Claude hooks layer (agent can't bypass)
   - beforeCommit: validate all MCP tools passed
   - afterPush: notify CI/CD

3. Ralph Wiggum loop
   - Runs until: all MCP tools validate success
   - Max 5 iterations per task
   - Provides real feedback (actual test output, coverage %, doc status)

4. Minions blueprints
   - implement-feature: worktree → Ralph loop → MCP validation → PR
   - fix-bug: same pattern
   - refactor: same pattern

5. Task manifest
   - docs/tasks/ with JSON frontmatter
   - Status: pending/in-progress/complete
   - Acceptance criteria: testable conditions
   - Task completion: MCP tools report success

Output a detailed architecture document that the Builder can execute.
```

### **Agent 2: Harness Builder**
**Purpose:** Implement the system based on architecture

**Custom system prompt:**
```
You are the Harness Builder.

Take the architecture from the Harness Architect and build:

1. /mcp-tools/ directory
   - testRunner.ts (runs npm test, returns JSON results)
   - coverageValidator.ts (checks coverage %, returns JSON)
   - docValidator.ts (validates docs exist, returns JSON)
   - progressLog.ts (enforces PROGRESS_LOG.md structure)

2. /claude-hooks/ directory
   - beforeCommit.ts (validates all MCP tools passed)
   - hook registration configuration

3. /blueprints/ directory
   - implement-feature.yaml (with Ralph loop config)
   - fix-bug.yaml
   - refactor.yaml

4. /pi-extensions/ directory (if using PI as orchestrator)
   - till-done.ts (enforce task lists)
   - mcp-tools-integration.ts
   - progress-tracking.ts

5. /tasks/ directory
   - docs/tasks/index.md
   - docs/tasks/task-template.md

6. /ci-cd/ directory (GitHub Actions or similar)
   - validate.yml (final backstop)

Output: Working code in proper directory structure, ready to test.
```

### **Agent 3: System Validator**
**Purpose:** Test the system, ensure enforcement works

**Custom system prompt:**
```
You are the System Validator.

Test that the orchestration system works:

1. Verification Tests
   - Can agent commit code without tests? (should FAIL)
   - Can agent commit without coverage check? (should FAIL)
   - Can agent commit without docs? (should FAIL)
   - Can agent commit with --no-verify? (should FAIL at CI)
   - Can agent commit with all rules passed? (should SUCCEED)

2. Ralph Loop Tests
   - Agent runs, hits coverage failure
   - Ralph iteration 2: Agent sees failure, iterates
   - Ralph iteration 3: All checks pass → success

3. Task Manifest Tests
   - Can agent see docs/tasks/ list?
   - Does agent avoid one-shotting?
   - Can agent mark task complete only if criteria met?

4. Multi-Agent Tests
   - Can blueprints spawn sub-agents?
   - Do agents coordinate properly?
   - Is audit trail (PROGRESS_LOG) maintained?

Output: Test results, bug reports if found, fixes needed before production.
```

---

## The META Approach: Using PI to Build This

**You have two options:**

### **Option A: Use PI CLI Directly (Simple)**

1. Install PI: `pip install pi-agent` or clone from GitHub
2. Create custom PI agents (3 YAML files):
   ```yaml
   # harness-architect.yaml
   name: Harness Architect
   system_prompt: [see above]
   tools:
     - bash
     - read
     - write
   extensions:
     - damage-control  # prevent dangerous commands

   # harness-builder.yaml
   name: Harness Builder
   system_prompt: [see above]
   tools:
     - bash
     - read
     - write
     - git

   # system-validator.yaml
   name: System Validator
   system_prompt: [see above]
   tools:
     - bash
     - read
   ```

3. Run them sequentially:
   ```bash
   pi --agent harness-architect --task "Design the system"
   pi --agent harness-builder --task "Build from architecture"
   pi --agent system-validator --task "Test the system"
   ```

### **Option B: Use PI Programmatically (Advanced)**

Create a meta-orchestrator that manages all three:

```typescript
// orchestrator.ts
import { PI } from 'pi-agent';

const agents = {
  architect: new PI({
    name: 'Harness Architect',
    systemPrompt: architectPrompt,
    extensions: ['damage-control'],
  }),

  builder: new PI({
    name: 'Harness Builder',
    systemPrompt: builderPrompt,
    extensions: ['damage-control'],
  }),

  validator: new PI({
    name: 'System Validator',
    systemPrompt: validatorPrompt,
    extensions: ['damage-control'],
  }),
};

async function buildOrchestration() {
  // Step 1: Architect designs system
  const architecture = await agents.architect.run(
    'Design deterministic enforcement architecture'
  );

  // Step 2: Builder implements it
  const implementation = await agents.builder.run(
    `Build this architecture:\n${architecture}`
  );

  // Step 3: Validator tests it
  const validation = await agents.validator.run(
    'Test if the system works as designed'
  );

  return { architecture, implementation, validation };
}
```

---

## The Actual Workflow

```
You create:
├── harness-architect.yaml (system prompt for Agent 1)
├── harness-builder.yaml (system prompt for Agent 2)
└── harness-validator.yaml (system prompt for Agent 3)

You run:
$ pi --agent harness-architect \
     --task "Design orchestration system per requirements in /docs/investigation/"

Agent 1 outputs: architecture.md

$ pi --agent harness-builder \
     --task "Build system per architecture:\n$(cat architecture.md)"

Agent 2 outputs: /mcp-tools, /blueprints, /ci-cd, etc.

$ pi --agent system-validator \
     --task "Test if enforcement works"

Agent 3 outputs: validation report + fixes needed

You iterate until: "SYSTEM COMPLETE"
```

---

## What Each Agent Produces

### **Harness Architect Output:**
```markdown
# Orchestration System Architecture

## Layer 1: MCP Tools (Deterministic Enforcement)
- testRunner: Runs npm test, returns {passed, failed, coverage, errors}
- coverageValidator: Checks coverage ≥ 80%, returns {current, threshold, passes}
- docValidator: Validates docs/PROGRESS_LOG.md + ADRs exist
- progressLog: Structured logging with audit trail

## Layer 2: Claude Hooks (Agent Enforcement)
- beforeCommit: All MCP tools must report success
- afterPush: Notify CI

## Layer 3: Ralph Loop (Iteration)
- Config: maxIterations: 5, completionSignal: "TASK COMPLETE"
- Feedback: Real test output, coverage %, doc status
- Success: Exit when all MCP tools pass

## Layer 4: Blueprints (Orchestration)
- implement-feature: 7-step workflow
- fix-bug: 5-step workflow
- refactor: 6-step workflow

## Layer 5: Task Manifest (Scope)
- docs/tasks/ with status tracking
- Prevents one-shotting
- Clear acceptance criteria
```

### **Harness Builder Output:**
```
orchestration-system/
├── mcp-tools/
│   ├── testRunner.ts
│   ├── coverageValidator.ts
│   ├── docValidator.ts
│   └── progressLog.ts
├── claude-hooks/
│   └── beforeCommit.ts
├── blueprints/
│   ├── implement-feature.yaml
│   ├── fix-bug.yaml
│   └── refactor.yaml
├── pi-extensions/
│   ├── till-done.ts
│   ├── task-manager.ts
│   └── progress-tracker.ts
├── docs/tasks/
│   └── index.md
├── ci-cd/
│   └── validate.yml
└── README.md (complete setup guide)
```

### **System Validator Output:**
```
VALIDATION REPORT

✓ Hard block test: Agent cannot commit without tests
✓ Hard block test: Agent cannot commit without coverage
✓ Hard block test: Agent cannot commit without docs
✗ Hard block test: Agent bypassed with --no-verify (CI caught it ✓)
✓ Ralph loop test: Agent iterated successfully
✓ Task manifest test: Agent respected scope
✓ Blueprint test: Multi-agent orchestration works
✓ Audit trail test: PROGRESS_LOG maintained

READY FOR PRODUCTION: Yes
Issues found: 0
```

---

## Your Next Step

**Write this file and give it to PI:**

```markdown
# Build Agent Orchestration System

Use three specialized PI agents to build a deterministic enforcement harness.

## Requirements

### Enforcement Rules
- Tests must exist and pass (checked by MCP tools)
- Coverage ≥ 80% (verified, not claimed)
- docs/PROGRESS_LOG.md must be updated (enforced structure)
- Architecture decision records (ADRs) required for changes

### System Components
1. MCP tools (agent MUST use, can't fake results)
2. Claude hooks (prevent bypass)
3. Ralph Wiggum loop (iteration with feedback)
4. Minions blueprints (orchestration)
5. Task manifest (scope management)
6. CI/CD gates (server-side validation)

## Build Process

### Agent 1: Harness Architect
- Input: These requirements
- Output: Detailed architecture document
- Tasks:
  1. Design MCP tool interfaces
  2. Design hook integration points
  3. Design Ralph loop behavior
  4. Design blueprint structure
  5. Design task manifest system

### Agent 2: Harness Builder
- Input: Architecture from Agent 1
- Output: Working code and configuration
- Tasks:
  1. Implement MCP tools in /mcp-tools/
  2. Implement hooks in /claude-hooks/
  3. Create blueprints in /blueprints/
  4. Create task templates in /docs/tasks/
  5. Create CI/CD pipeline in /ci-cd/

### Agent 3: System Validator
- Input: Implementation from Agent 2
- Output: Test report and fixes
- Tasks:
  1. Test hard blocks work
  2. Test Ralph loop works
  3. Test multi-agent orchestration works
  4. Test audit trail maintained
  5. Report issues and fixes needed

## Success Criteria
- Agent cannot commit code that violates enforcement rules
- Tests, coverage, and docs are mandatory
- Ralph loop allows iteration but prevents unlimited attempts
- Multi-agent blueprints work end-to-end
- Audit trail (PROGRESS_LOG) maintained throughout
```

---

## Why This Approach Works

1. **Agents build the harness** - PI agents write the MCP tools, hooks, and blueprints
2. **Harness enforces itself** - Once built, the system prevents agent cheating
3. **Fully customizable** - PI's extension system lets agents build exactly what's needed
4. **Iterative validation** - Each agent's output feeds to the next, then validator checks
5. **Meta-agentic** - You're using agents to build systems that orchestrate agents

---

## Implementation Timeline

**Week 1: Design + Build**
- Day 1-2: Harness Architect designs system (4-6 hours)
- Day 3-4: Harness Builder implements (8-10 hours)
- Day 5: System Validator tests and fixes (4-6 hours)

**Week 2: Integration + Validation**
- Day 1-2: Integrate with your repo
- Day 3-5: Test on CRUD app (same as before)

**Total: 20-30 hours of agent work + your oversight**

---

## The Beauty of This Approach

Instead of me (Claude) writing code for you, **you let PI agents build a system that enforces deterministic rules on all agents (including themselves).**

This is:
- ✅ More aligned with harness engineering
- ✅ More meta-agentic (agents building for agents)
- ✅ More customizable (you control PI extensions)
- ✅ More trustworthy (enforced, not promised)
- ✅ More scalable (works across any codebase)

You're not building an agent orchestration system. You're building **an enforcement framework that makes agent lying impossible.**
