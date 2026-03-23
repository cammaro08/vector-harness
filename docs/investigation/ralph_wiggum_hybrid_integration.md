# Ralph Wiggum + Hybrid Approach Integration

**Core Insight:** Ralph Wiggum is the **execution engine** that makes your Codex + Minions hybrid actually work at scale.

---

## What is Ralph Wiggum?

**Simple definition:** A loop that repeatedly runs an agent against the same prompt while the codebase evolves.

```
Iteration 1: Agent sees prompt + empty repo → makes changes
Iteration 2: Agent sees prompt + previous work → sees failures, fixes them
Iteration 3: Agent sees prompt + fixes from iter 2 → refines further
...
Loop exits when: Tests pass OR prompt says "COMPLETE" OR max iterations reached
```

**Key difference from traditional agents:**
- NOT conversational (no "try again" human prompts)
- NOT one-shot (agent gets multiple chances)
- Self-correcting (agent reviews its own git history and test output)
- Cost-effective (same prompt, evolving context)

---

## How Ralph Wiggum Fixes Your MVP Gaps

### Gap 1: Codex "One-Shotting" Problem

**Problem:** Agent might claim feature is done after partial implementation.

**Ralph Wiggum solution:**
```
Iteration 1: Agent implements user profile page
  └─ Commits work, runs tests

Iteration 2: Agent receives SAME prompt + sees test output
  └─ Sees: "UserCard component renders but doesn't fetch data"
  └─ Fixes: Adds service integration
  └─ Re-runs tests

Iteration 3: Agent sees updated tests
  └─ All tests pass → Loop exits
```

**Result:** Agent can't claim victory without actual passing tests.

---

### Gap 2: Minions "2-Iteration Escalation" Problem

**Problem:** When agent fails both iterations, it escalates. But what if agent is close?

**Ralph Wiggum solution:**
```
Blueprint Step: "Implement feature"
  └─ Uses Ralph Wiggum to retry
     ├─ Iteration 1: Agent attempt
     ├─ Iteration 2: Agent sees failures, fixes
     ├─ Iteration 3: Agent refines further
     └─ If still failing after 3, escalate with full context

// Instead of: 2 attempts, then escalate
// You get: N attempts with full feedback, escalate only if truly stuck
```

**Result:** Cost-controlled but not artificially limited.

---

## How to Integrate Ralph Wiggum with Hybrid Approach

### Architecture

```
Hybrid Execution Flow:

┌─────────────────────────────────────────────────┐
│ User: minion --task "Implement user auth"       │
└──────────────┬──────────────────────────────────┘
               │
        ┌──────▼──────┐
        │ Create      │  (Minions: Isolation)
        │ Worktree    │
        └──────┬──────┘
               │
        ┌──────▼────────────────────────────┐
        │ Ralph Wiggum Loop                 │  (Ralph: Iteration)
        │                                    │
        │  while NOT_COMPLETE:               │
        │    • Read prompt                  │
        │    • Read docs/ (Codex nav)       │
        │    • Check task status (Minions)  │
        │    • Agent implements             │
        │    • Run `npm run verify`         │
        │    • Check completion signal      │
        │    • If failed: iterate           │
        │                                    │
        └──────┬────────────────────────────┘
               │
        ┌──────▼──────────┐
        │ Create PR &     │  (Both: Integration)
        │ Document        │
        │ progress        │
        └─────────────────┘
```

### Phase 1: Ralph Wiggum + Codex

**Simple implementation:**

```typescript
import { ralphWiggum } from 'open-ralph-wiggum';

const codexLoop = ralphWiggum({
  agent: 'claude-code',
  prompt: `
You are implementing features in a Node.js backend.

CONTEXT:
- Read docs/AGENTS.md for navigation
- Follow architecture in docs/DESIGN.md (Types → Service → UI)
- Use npm run verify to check your work
- Commit your progress with git

TASK: ${task.description}

COMPLETION SIGNAL:
Say "TASK COMPLETE" when:
- All tests pass (npm test)
- All linters pass (npm run lint)
- Feature works end-to-end
- At least one test proves functionality
  `,

  maxIterations: 5,  // Ralph stops after 5 attempts
  timeoutPerIteration: 300,  // 5 min per iteration

  completionSignal: 'TASK COMPLETE',  // Exit when agent says this

  hooks: {
    beforeEachIteration: async (iteration) => {
      // Could inject midstream guidance if needed
      // E.g., "You're on iteration 3 of 5, consider X"
    },
    afterEachIteration: async (iteration, result) => {
      // Log progress
      console.log(`Iteration ${iteration}: ${result.success ? '✓' : '✗'}`);

      // Could update docs/STATUS.md with progress
      updateProgressLog(iteration, result);
    },
  },
});

await codexLoop.run(worktreePath);
```

**How it works:**
1. Agent reads prompt + sees docs structure (Codex advantage)
2. Agent implements feature
3. Agent runs `npm run verify` (sees linter/test feedback)
4. Ralph checks: "Did agent say 'TASK COMPLETE'?"
5. If no: loop again (agent sees own work + failures)
6. If yes: create PR

**Key:** Ralph automatically provides feedback (test output, linter violations) as context for next iteration. Agent doesn't have to ask—it just sees the evolving codebase.

---

### Phase 2: Ralph Wiggum + Minions Blueprint

**Blueprint with Ralph integration:**

```yaml
name: Implement Feature (with Ralph)
description: Implement a feature with iterative refinement

steps:
  - type: deterministic
    name: Setup
    command: git worktree add .claude/worktrees/{taskId} -b feature/{taskId}

  - type: agent_loop
    name: Implement with self-correction
    # NEW: Instead of single agent step, use Ralph loop
    framework: ralph-wiggum

    prompt: |
      Implement: {featureSpec}

      Context: Read docs/AGENTS.md for navigation
      Architecture: See docs/DESIGN.md

      COMPLETE when:
      - All tests pass
      - All linters pass
      - Feature works end-to-end
      Say "TASK COMPLETE" when done.

    config:
      maxIterations: 5
      completionSignal: 'TASK COMPLETE'
      feedbackSources:
        - command: npm run verify --json
          parseAs: verification_result
        - command: git log --oneline -10
          parseAs: commit_history

    retryPolicy:
      maxAttempts: 2  # Ralph gets 2 separate tries
      resetBetweenAttempts: true

  - type: deterministic
    name: Create PR
    command: gh pr create --title "{featureTitle}" --body "{prBody}"
```

**How it works:**
1. Ralph loop runs inside blueprint (5 iterations max)
2. Each iteration:
   - Agent sees prompt + docs + current code
   - Runs verification command
   - Sees test failures, linter violations
   - Decides: "Do I have enough context to fix this?"
3. If agent can't solve it after 5 iterations → blueprint escalates
4. If solved before 5 iterations → move to next blueprint step

**Benefit:** Cost-controlled (max 5 iterations per attempt) but agent gets real feedback, not artificial iteration limit.

---

### Phase 3: Ralph Wiggum + Full Hybrid

**Complete workflow:**

```
User: minion --blueprint implement-feature --spec docs/features/user-auth.md

1. Read Feature Spec
   └─ Task breakdown from docs/tasks/

2. Create Worktree + Sandbox (Minions)
   └─ Isolated environment

3. Ralph Wiggum Loop (Ralph)
   ├─ Iteration 1: Agent implements basic auth
   │  └─ Runs verification → sees missing password hashing
   │
   ├─ Iteration 2: Agent adds password hashing
   │  └─ Runs verification → sees JWT token issue
   │
   ├─ Iteration 3: Agent fixes JWT implementation
   │  └─ Runs verification → ALL TESTS PASS
   │     Says: "TASK COMPLETE"
   │
   └─ Ralph exits (success before iteration limit)

4. Deterministic Steps
   ├─ Final verification
   ├─ Commit with message
   └─ Create PR

5. Document Progress (Codex)
   └─ Update docs/PROGRESS_LOG.md with:
      - Which iterations succeeded
      - What failures were fixed
      - Final test results
```

---

## Ralph Wiggum's Advantages for Your Hybrid Approach

| Advantage | Codex | Minions | Ralph Wiggum |
|-----------|-------|---------|-------------|
| Self-correction | Manual | Limited (2 attempts) | Built-in (N iterations) |
| Cost control | None | Explicit (2 max) | Implicit (stops when done) |
| Feedback quality | Good (linters) | Good (step feedback) | **Excellent** (full context each loop) |
| Human intervention | Required | Required (escalate) | Not required (unless truly stuck) |
| Context reuse | Hard | Medium | **Easy** (same prompt, evolving code) |

---

## Implementation: Ralph Wiggum Loop Details

### How Ralph Provides Feedback Context

**Iteration 1:**
```
Agent sees:
- Prompt: "Implement user auth with password hashing"
- Codebase: empty
- Recent git: (none)

Agent writes: auth.service.ts (basic implementation, no hashing)
```

**Iteration 2:**
```
Agent sees:
- Prompt: SAME (unchanged)
- Codebase: Now includes auth.service.ts
- Recent git: [commit] Add basic auth service
- Test output: ✗ Password stored as plaintext (critical)
- Linter output: (none)

Agent fixes: Adds bcrypt hashing
```

**Iteration 3:**
```
Agent sees:
- Prompt: SAME
- Codebase: Updated auth.service.ts with bcrypt
- Recent git: [commit] Add password hashing
- Test output: ✗ JWT token invalid format
- Linter output: (none)

Agent fixes: Implements proper JWT signing
```

**Iteration 4:**
```
Agent sees:
- Prompt: SAME
- Codebase: Updated with JWT
- Recent git: [commit] Add JWT signing
- Test output: ✓ ALL TESTS PASS

Agent says: "TASK COMPLETE"
Ralph exits
```

**Key insight:** Agent doesn't need to be prompted "fix the token issue"—it reads the test output and understands what failed.

---

## Ralph Wiggum vs Traditional Loops

### Traditional Agent Loop (Current Minions MVP)
```
Step 1: Agent implements
Step 2: Run tests
Step 3: If failed: "Fix the failures" (explicit re-prompt)
Step 4: Run tests again
Step 5: If still failed: escalate
```

**Problem:** Only 2 attempts. Agent might be 1 iteration away from success.

### Ralph Wiggum Loop
```
Iteration 1: Agent sees prompt + empty code
Iteration 2: Agent sees prompt + test failures from iter 1 → fixes
Iteration 3: Agent sees prompt + test failures from iter 2 → refines
...
Exit when: Tests pass OR max 5 iterations
```

**Advantage:** Agent self-corrects based on actual feedback, not explicit instructions.

---

## Concrete Example: Adding Ralph to Codex MVP

**Before (Codex MVP):**
```bash
# User asks agent to add user profile
# Agent runs once, creates PR
# PR has partial implementation

$ minion --task "Add user profile page"
Agent implements...
PR created: #123 (incomplete)
```

**After (Codex + Ralph):**
```bash
$ minion --task "Add user profile page"

Ralph Iteration 1/5:
  ✓ Agent implements UserCard component
  ✗ Tests fail: Component doesn't fetch data

Ralph Iteration 2/5:
  ✓ Agent adds service layer integration
  ✗ Tests fail: API call not authenticated

Ralph Iteration 3/5:
  ✓ Agent adds auth token to request
  ✓ ALL TESTS PASS
  Agent says: "TASK COMPLETE"

Ralph exits successfully
PR created: #123 (complete)
```

**3 iterations vs 1 attempt = feature is actually usable.**

---

## Configuration for Different Use Cases

### Fast Feedback Loop (Codex Development)
```yaml
ralphConfig:
  maxIterations: 10  # More iterations for complex features
  timeoutPerIteration: 600  # 10 min per iteration
  feedbackCommand: npm run verify --fast  # Quick checks only
  completionSignal: TASK COMPLETE
```

### Cost-Controlled Loop (Minions Production)
```yaml
ralphConfig:
  maxIterations: 3  # Limited iterations for cost
  timeoutPerIteration: 300  # 5 min per iteration
  feedbackCommand: npm run verify --fast  # Don't run full suite each time
  completionSignal: TASK COMPLETE
  escalateAfter: 2  # Escalate if not done after 2 attempts
```

### Aggressive Loop (Prototyping)
```yaml
ralphConfig:
  maxIterations: 20  # Many attempts
  timeoutPerIteration: 120  # Short timeout (fail fast)
  feedbackCommand: npm test  # Minimal feedback
  completionSignal: COMPLETE  # Shorter signal
```

---

## Ralph Wiggum in Hybrid Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│              User Command                               │
│  minion --blueprint implement-feature --spec {...}      │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────▼─────────────┐
        │  Minions: Parse Input    │
        │  - Load blueprint YAML   │
        │  - Read task from docs/  │
        │  - Create worktree       │
        └────────────┬─────────────┘
                     │
        ┌────────────▼───────────────────────────┐
        │  Ralph Wiggum Agent Loop               │
        │                                         │
        │  for iteration in 1..maxIterations:    │
        │    ├─ Load prompt                      │
        │    ├─ Load Codex docs structure        │
        │    ├─ Load previous git history        │
        │    ├─ Load test failures (if any)      │
        │    ├─ Agent makes progress             │
        │    ├─ Run npm run verify               │
        │    ├─ Check: Said "TASK COMPLETE"?    │
        │    └─ if yes: break                    │
        │                                         │
        │  Log: PROGRESS_LOG.md                  │
        └────────────┬───────────────────────────┘
                     │
        ┌────────────▼─────────────┐
        │  Minions: Create PR      │
        │  - Commit final work     │
        │  - Open PR               │
        │  - Cleanup worktree      │
        └─────────────────────────┘
```

---

## Integration with Your Hybrid Docs

**Add to docs/WORKFLOW.md:**
```markdown
## Agent Execution Model

We use Ralph Wiggum loops for iterative self-correction.

### How Ralph Works
1. Agent receives prompt + current codebase state
2. Agent makes changes and runs verification
3. If verification passes and agent says "TASK COMPLETE": done
4. If verification fails: loop again (agent sees failures, fixes them)
5. After N iterations: escalate if still failing

### For Agents
- Don't worry about getting it perfect on first try
- Always run `npm run verify` after changes
- Say "TASK COMPLETE" when all tests pass
- Ralph will keep you honest with feedback

### Completion Signals
Always end your implementation with:
"TASK COMPLETE: [Brief summary of what you implemented]"

Example:
"TASK COMPLETE: Implemented user auth with bcrypt hashing and JWT tokens. All tests passing (42/42)."
```

---

## Quick Start: Ralph Wiggum in Your MVP

**Step 1: Install Ralph**
```bash
npm install open-ralph-wiggum
# or: git clone https://github.com/Th0rgal/open-ralph-wiggum
```

**Step 2: Create `minion-ralph.ts`**
```typescript
import { ralphWiggum } from 'open-ralph-wiggum';

export async function runRalphLoop(task: Task, worktreePath: string) {
  return ralphWiggum({
    agent: 'claude-code',
    prompt: `
You are implementing features in a Node.js/TypeScript backend.

NAVIGATION:
- Read docs/AGENTS.md for the documentation map
- Follow architecture rules in docs/DESIGN.md
- Check docs/tasks/ for this task details

TASK: ${task.spec}

VERIFICATION:
After each change, run: npm run verify --json
This will show you:
- Type checking results
- Linting violations
- Test results
- Architecture rule violations

COMPLETION:
When the task is complete and all checks pass, say:
"TASK COMPLETE: [Summary of implementation]"

Do not claim completion until tests actually pass.
    `,

    maxIterations: 5,
    completionSignal: 'TASK COMPLETE',
    cwd: worktreePath,
  }).run();
}
```

**Step 3: Integrate with Minions**
```yaml
blueprints:
  - name: implement-feature
    steps:
      - type: deterministic
        name: Create sandbox
        command: git worktree add .claude/worktrees/{taskId}

      - type: agent_loop
        name: Ralph Wiggum implementation
        command: node minion-ralph.ts "{task.spec}"

      - type: deterministic
        name: Create PR
        command: gh pr create --title "{task.title}"
```

---

## Why Ralph Wiggum Is The Missing Piece

Your hybrid approach had a gap: **How do agents iterate effectively?**

- **Codex approach:** Good docs, but agent might not self-correct
- **Minions approach:** Good structure, but limited to 2 iterations
- **Ralph Wiggum:** **Enables agents to iterate until completion without human intervention**

Ralph Wiggum is the **execution engine** that makes your architectural foundation (Codex docs + Minions structure) actually work at scale.

It's the difference between:
- Agent: "I implemented the feature" (but it's broken)
- Agent with Ralph: "I implemented the feature, saw tests fail, fixed the auth, tests pass now, TASK COMPLETE"
