# Minions Approach Prototype

**Goal:** Test whether mixing deterministic code with agent-driven steps in a "blueprint" orchestration improves reliability and feedback loops compared to pure agent autonomy.

**Core Hypothesis:** Agents are most effective when constrained to specific subtasks within a deterministic workflow. Deterministic steps handle validation, linting, and testing; agent steps handle creative problem-solving.

---

## What We're Testing

1. Can we define reusable "blueprints" that mix code and agent steps?
2. Do isolated sandboxes (worktrees/containers) enable safe parallel task execution?
3. Does structured feedback from CI improve agent self-correction?
4. Can agents handle 2+ rounds of feedback and iterate to success?

---

## Minimum Viable Implementation (MVP Scope)

### Phase 1: Blueprint Engine (2-3 hours)

Create a simple orchestrator that executes a sequence of steps:

**Core abstraction (TypeScript example):**

```typescript
type Step = DeterministicStep | AgentStep;

interface DeterministicStep {
  type: 'deterministic';
  name: string;
  run: () => Promise<{ success: boolean; output: string; error?: string }>;
}

interface AgentStep {
  type: 'agent';
  name: string;
  prompt: string;
  tools?: string[];  // MCP tools available
}

interface Blueprint {
  name: string;
  description: string;
  steps: Step[];
}

class BlueprintExecutor {
  async execute(blueprint: Blueprint, context: any): Promise<BlueprintResult> {
    for (const step of blueprint.steps) {
      if (step.type === 'deterministic') {
        const result = await step.run();
        if (!result.success) {
          throw new Error(`Step ${step.name} failed: ${result.error}`);
        }
      } else {
        // Agent step - call Claude with step.prompt + context
        const agentResult = await callAgent(step.prompt, context);
        context.lastAgentOutput = agentResult;
      }
    }
    return context;
  }
}
```

**Example blueprints:**

**Blueprint 1: "Fix a Bug"**
```typescript
const fixBugBlueprint: Blueprint = {
  name: 'Fix Bug',
  steps: [
    {
      type: 'deterministic',
      name: 'Create isolated worktree',
      run: () => createWorktree(taskId),
    },
    {
      type: 'agent',
      name: 'Investigate and fix',
      prompt: 'Bug report: {{ bugDescription }}. Investigate and fix.',
      tools: ['git', 'npm', 'code-search'],
    },
    {
      type: 'deterministic',
      name: 'Run linters',
      run: () => runLinters(repoPath),
    },
    {
      type: 'agent',
      name: 'Fix linter violations',
      prompt: 'Linter errors found: {{ linterOutput }}. Fix them.',
      tools: ['code-search'],
    },
    {
      type: 'deterministic',
      name: 'Run tests',
      run: () => runTests(repoPath),
    },
    {
      type: 'agent',
      name: 'Fix test failures',
      prompt: 'Test failures: {{ testOutput }}. Fix them.',
      tools: ['code-search'],
    },
    {
      type: 'deterministic',
      name: 'Create PR',
      run: () => createPR(branch, title),
    },
  ],
};
```

**Blueprint 2: "Implement Feature"**
```typescript
const implementFeatureBlueprint: Blueprint = {
  name: 'Implement Feature',
  steps: [
    {
      type: 'deterministic',
      name: 'Create worktree',
      run: () => createWorktree(taskId),
    },
    {
      type: 'agent',
      name: 'Design and implement',
      prompt: 'Feature spec: {{ spec }}. Design and implement.',
      tools: ['code-search', 'git'],
    },
    {
      type: 'deterministic',
      name: 'Type check',
      run: () => runTypeCheck(repoPath),
    },
    {
      type: 'agent',
      name: 'Fix type errors',
      prompt: 'Type errors: {{ typeCheckOutput }}. Fix them.',
    },
    {
      type: 'deterministic',
      name: 'Lint',
      run: () => runLinters(repoPath),
    },
    {
      type: 'deterministic',
      name: 'Test',
      run: () => runTests(repoPath),
    },
    {
      type: 'deterministic',
      name: 'Create PR + assign review',
      run: () => createPR(branch, spec),
    },
  ],
};
```

### Phase 2: Agent Sandbox (2-3 hours)

Create isolated execution environments:

**Approach A: Git Worktrees (Simpler, local)**
```bash
# Create a new worktree for each task
git worktree add .claude/worktrees/task-123 -b feature/task-123

# All agent work happens in this directory
cd .claude/worktrees/task-123
# ... agent writes code here
git push

# Cleanup
git worktree remove .claude/worktrees/task-123
```

**Approach B: Docker Containers (More robust, slower)**
```dockerfile
FROM node:18-alpine

WORKDIR /repo
COPY . .

RUN npm ci
RUN npm run build

ENTRYPOINT ["/bin/sh"]
```

```typescript
// Spawn container for each task
const container = await docker.run(
  'myrepo-agent:latest',
  [],
  { cwd: '/repo/task-123' }
);
// Agent runs inside container
// Container torn down after task completes
```

**MVP recommendation:** Use git worktrees (no Docker overhead)

**Implementation:**
```typescript
class AgentSandbox {
  async create(taskId: string): Promise<string> {
    const branchName = `task/${taskId}`;
    const worktreePath = `.claude/worktrees/${taskId}`;

    // Create isolated worktree
    await exec(`git worktree add ${worktreePath} -b ${branchName}`);

    return worktreePath;
  }

  async cleanup(taskId: string): Promise<void> {
    const worktreePath = `.claude/worktrees/${taskId}`;
    await exec(`git worktree remove ${worktreePath}`);
  }
}
```

### Phase 3: CLI Entry Point (1-2 hours)

Simple command to trigger a blueprint:

```bash
# Usage
minion --blueprint fix-bug --task "Button click doesn't work"
minion --blueprint implement-feature --spec "docs/features/user-auth.md"

# Output
minion
├─ Creating worktree: task-2024-03...
├─ Running Agent: Investigate and fix
│  └─ Agent output: Found the issue in handler.js...
├─ Running: Linters
│  └─ 2 violations found
├─ Running Agent: Fix linter violations
│  └─ Agent output: Fixed naming issues...
├─ Running: Tests
│  └─ ✓ All tests passed
├─ Creating PR
│  └─ PR #456 created
└─ Done
```

**Implementation sketch:**
```typescript
import yargs from 'yargs';
import { BlueprintExecutor } from './executor';
import { AgentSandbox } from './sandbox';

yargs
  .command(
    'run <blueprint> [options]',
    'Run a blueprint',
    (yargs) => {
      return yargs
        .option('task', { describe: 'Task description' })
        .option('spec', { describe: 'Specification file' });
    },
    async (argv) => {
      const taskId = generateTaskId();
      const sandbox = new AgentSandbox();

      try {
        const sandboxPath = await sandbox.create(taskId);
        const blueprint = loadBlueprint(argv.blueprint);
        const executor = new BlueprintExecutor();

        await executor.execute(blueprint, {
          sandboxPath,
          taskDescription: argv.task,
          specFile: argv.spec,
        });
      } finally {
        await sandbox.cleanup(taskId);
      }
    }
  )
  .parse();
```

### Phase 4: Feedback Loop (2 hours)

Implement 2 CI checks that agents can iterate on:

**Check 1: Linting**
```typescript
async function runLintCheck(worktreePath: string) {
  const result = await exec('npm run lint', { cwd: worktreePath });

  return {
    success: result.exitCode === 0,
    output: result.stdout,
    violations: parseLintOutput(result.stdout),
  };
}
```

**Check 2: Tests**
```typescript
async function runTestCheck(worktreePath: string) {
  const result = await exec('npm test', { cwd: worktreePath });

  return {
    success: result.exitCode === 0,
    output: result.stdout,
    failures: parseTestOutput(result.stdout),
  };
}
```

**Agent feedback mechanism:**
```typescript
// After deterministic step fails, provide context to agent
if (!lintResult.success) {
  agentContext.lintFailures = {
    count: lintResult.violations.length,
    violations: lintResult.violations.slice(0, 5), // Top 5
    suggestion: 'Review linting errors and fix them',
  };

  // Agent runs again with this context
  await executeAgentStep(
    'Fix linter violations',
    `Linter found ${lintResult.violations.length} issues:\n${formatViolations(lintResult.violations)}`
  );
}
```

**Max 2 iterations per step** (matching Stripe's cost constraint):
```typescript
let attempts = 0;
const maxAttempts = 2;

while (attempts < maxAttempts) {
  const checkResult = await runCheck(step);

  if (checkResult.success) {
    break;
  }

  attempts++;
  if (attempts < maxAttempts) {
    // Give agent another chance with feedback
    await executeAgentStep(step.fixPrompt, checkResult.feedback);
  } else {
    // Escalate to human
    await escalateToHuman(step, checkResult);
  }
}
```

### Phase 5: Blueprint Definition Format (1 hour)

Make blueprints easy to write and modify:

**YAML format option:**
```yaml
name: Fix Bug
description: Investigate and fix a reported bug

steps:
  - type: deterministic
    name: Create worktree
    command: git worktree add .claude/worktrees/{taskId} -b fix/{taskId}

  - type: agent
    name: Investigate and fix
    prompt: |
      Bug report: {bugDescription}
      Investigate the codebase and implement a fix.
    tools:
      - git
      - code-search

  - type: deterministic
    name: Run linters
    command: npm run lint

  - type: agent
    name: Fix linter violations
    prompt: |
      Linter errors found:
      {lintOutput}
      Fix all violations.
    tools:
      - code-search

  - type: deterministic
    name: Run tests
    command: npm test

  - type: deterministic
    name: Create PR
    command: gh pr create --title "{title}" --body "{description}"
```

---

## MVP Test Scenario

**Task:** "Implement a simple authentication feature"

**Execution flow:**

```
1. Create worktree (deterministic)
   └─ Created: .claude/worktrees/task-auth-01

2. Agent step: "Implement basic auth"
   └─ Agent writes: auth.service.ts, auth.repo.ts, LoginUI.tsx

3. Type check (deterministic)
   └─ ❌ 3 type errors found

4. Agent step: "Fix type errors"
   └─ Agent reads errors, fixes them
   └─ ✓ All types check

5. Linting (deterministic)
   └─ ❌ 2 linting violations

6. Agent step: "Fix linter violations"
   └─ Agent reads violations, fixes them
   └─ ✓ All linting passed

7. Tests (deterministic)
   └─ ✓ All tests passed

8. Create PR (deterministic)
   └─ PR #123 created
```

**Success criteria:**
- Agent completes task without human intervention
- Agent handles 2 feedback loops (type check + linting)
- Worktree properly isolated and cleaned up
- PR created with correct changes

---

## Timeline

- Phase 1: 2-3 hours
- Phase 2: 2-3 hours
- Phase 3: 1-2 hours
- Phase 4: 2 hours
- Phase 5: 1 hour
- **MVP test:** 1-2 hours

**Total: 9-14 hours**

---

## Success Metrics

✅ Blueprint executes deterministic steps successfully
✅ Agent responds to feedback and iterates
✅ Linters/tests fail, agent fixes them, then passes
✅ Worktree properly isolated and cleaned up
✅ PR created with correct code and proper attribution
✅ Max 2 iterations per feedback loop respected

---

## Key Differences from Codex Approach

| Aspect | Codex | Minions |
|--------|-------|---------|
| **Control** | Agent has full autonomy | Deterministic+Agent mix |
| **Feedback** | Implicit (logs/tests) | Explicit CI feedback loops |
| **Iteration** | Agent self-corrects | Defined max 2 attempts |
| **Parallelization** | Via multiple agents | Worktree per task |
| **Complexity** | High context management | Low, structured blueprints |

---

## Next Steps (Post-MVP)

If MVP succeeds:
- Add more blueprints (refactoring, API changes, docs updates)
- Implement "tool shed" meta-tool for selecting from 20+ MCP tools
- Test parallel execution (3+ concurrent minions)
- Add web UI dashboard (showing minion progress)
- Implement escalation to human for unresolvable failures
- Measure success rate across 20+ real tasks
