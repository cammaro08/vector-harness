# Codex Approach Prototype

**Goal:** Test whether a well-structured repository with agent-first legibility enables effective autonomous agent behavior without constant human context injection.

**Core Hypothesis:** Agents perform better when the repository is optimized for agent legibility rather than human readability.

---

## What We're Testing

1. Can agents self-navigate a structured `docs/` directory instead of a monolithic `AGENTS.md`?
2. Do custom linters effectively guide agent behavior without human intervention?
3. Can agents validate their own work via local observability (logs, test output)?
4. Does a rigid layered architecture reduce decision space and improve consistency?

---

## Minimum Viable Implementation (MVP Scope)

### Phase 1: Repository Structure (1 hour)

Create this directory structure:

```
repo/
├── AGENTS.md                    # ~100 lines, purely navigation
├── ARCHITECTURE.md              # High-level layers
├── docs/
│   ├── design-docs/
│   │   ├── index.md
│   │   └── core-beliefs.md
│   ├── product-specs/
│   │   └── index.md
│   ├── references/
│   │   └── api-reference.md
│   ├── DESIGN.md
│   ├── FRONTEND.md
│   └── RELIABILITY.md
├── src/
│   ├── types/
│   ├── config/
│   ├── repo/
│   ├── service/
│   └── ui/
└── tests/
```

**AGENTS.md content (template):**
```markdown
# Agent Navigation Map

Start here. This file points you to the actual system of record.

## Architecture
- Read: [ARCHITECTURE.md](./ARCHITECTURE.md)
- For layering rules: See docs/DESIGN.md

## Before Implementing
1. Check docs/design-docs/core-beliefs.md
2. Validate your change fits architecture in ARCHITECTURE.md
3. Look at examples in src/ for the pattern

## Running Locally
- Tests: `npm test`
- Linting: `npm run lint`
- Type check: `npm run type-check`

## Detailed Guides
- Design decisions: docs/design-docs/
- API reference: docs/references/api-reference.md
- Frontend patterns: docs/FRONTEND.md
```

### Phase 2: Linting & Enforcement (3-4 hours)

Implement 2-3 custom linters that agents must respect:

**Linter 1: Layer Boundary Validation**
- Parse import statements
- Enforce: Types → Config → Repo → Service → UI
- Reject: Service importing UI, Config importing Repo, etc.
- Message to agent: "Services cannot import UI. Move logic to Service layer."

**Linter 2: File Naming Convention**
- `.service.ts` for service layer
- `.repo.ts` for repository layer
- `.ui.tsx` for UI components
- Reject files that don't follow pattern
- Message: "File must follow naming: myFeature.service.ts"

**Linter 3: Structured Logging**
- Require log format: `{ action, context, level }`
- Reject console.log or unstructured logs
- Message: "Use logger.info({action, context}) instead of console.log"

**Implementation approach:**
- Use ESLint + custom rules (for TS/JS)
- Or write a simple Node script that parses files
- Run in CI and fail PR if violations exist

### Phase 3: Agent Legibility Hooks (2-3 hours)

Make your actual app inspectable to agents:

**Approach A: Test Output Parsing**
- Agent runs `npm test`
- Parses test output to JSON: `{ passed: N, failed: N, failures: [{test, reason}] }`
- Can reason about test results directly

**Approach B: Simple Metrics Export**
- Add `/metrics.json` endpoint that returns: `{ buildTime, testCount, coverage }`
- Agent fetches it to validate impact

**Approach C: Log Inspection**
- Write all logs to `./logs/latest.log` in JSON format
- Agent can read and parse: `{ timestamp, action, level, context }`
- Use after running the app

**Pick one for MVP:** Log inspection (simplest)

### Phase 4: Core Architecture Docs (1-2 hours)

Write minimal but definitive docs:

**docs/design-docs/core-beliefs.md:**
```markdown
# Core Beliefs

1. **Explicit over implicit.** Every architectural boundary should be legible in code.
2. **Layer boundaries are sacred.** Cross-layer imports are linting errors, not style preference.
3. **Types first.** Define data shapes before implementing.
4. **Fail loudly.** Validation errors should be specific and actionable.
```

**docs/DESIGN.md:**
```markdown
# Architecture

## Layers (in dependency order)
- **Types**: Data shape definitions. Can import nothing.
- **Config**: Runtime configuration. Can import Types.
- **Repo**: Data access layer. Can import Config, Types.
- **Service**: Business logic. Can import Repo, Config, Types.
- **UI**: Presentation. Can import Service, Types.

## Rules
- Never skip layers (no UI → Config)
- No circular imports (enforced by linter)
- Service can be tested independently of UI
```

**docs/FRONTEND.md:**
```markdown
# Frontend Patterns

All React components follow this structure:
1. Props type definition
2. Helper functions
3. Component definition
4. Export

Example:
\`\`\`tsx
interface UserCardProps {
  userId: string;
  onEdit: (id: string) => void;
}

function UserCard({ userId, onEdit }: UserCardProps) {
  // implementation
}
\`\`\`
```

---

## MVP Test Task

**Scenario:** "Add a user profile page that displays user info from the backend"

**What the agent must do:**
1. Read AGENTS.md (should understand to check docs/ next)
2. Navigate docs/DESIGN.md to understand layer architecture
3. Create files following naming convention
4. Implement: Types → Repo → Service → UI (in correct order)
5. Run linters - see failures
6. Fix violations (e.g., rename files, move imports)
7. Run tests
8. Parse log output to confirm correctness

**Success criteria:**
- Agent completes task without human context
- All linters pass
- Tests pass
- Agent correctly navigated the docs/ structure (not asking for clarification)

---

## Feedback Mechanisms

**For agent iteration:**
1. Linter output (structured error messages)
2. Test failures (which tests failed, why)
3. Log inspection (did the app behave as expected)

**For continuous improvement:**
- Track which docs the agent consulted
- Track which linter errors appeared most
- Update docs/design-docs/ based on what agent got wrong

---

## Timeline

- Phase 1: 1 hour
- Phase 2: 3-4 hours
- Phase 3: 2-3 hours
- Phase 4: 1-2 hours
- **MVP test:** 1-2 hours

**Total: 8-12 hours**

---

## Success Metrics

✅ Agent navigates docs/ correctly
✅ Agent respects linter constraints without human help
✅ Agent validates own work via test output
✅ Linters catch violations consistently
✅ Code follows architecture rules by enforcement, not convention

---

## Next Steps (Post-MVP)

If MVP succeeds:
- Add observability stack (logs, metrics, traces)
- Implement "golden principles" cleanup task
- Test multi-step task (feature with frontend + backend)
- Measure agent success rate across 10+ tasks
