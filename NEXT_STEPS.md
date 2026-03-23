# Next Steps: Implementation Roadmap

**Status:** Ready to begin Phase 2
**Current Date:** 2026-03-08 (after design session)
**Time to Complete:** ~40-50 hours total
**Estimated Timeline:** 2-3 weeks

---

## What You Have Now

✅ Architecture designed (per-step retry, PI agents, git-based decisions)
✅ All decisions documented (DECISIONS.md)
✅ Session exported (docs/sessions/2026-03-08-orchestration-design-export.md)
✅ Analysis docs created (5 investigation files)
✅ Clear roadmap

---

## What You're Building

A deterministic enforcement harness that:
- Prevents agents from lying about test results
- Iterates when agents fail (max 3 attempts)
- Escalates to humans with full context
- Learns from failures (updates harness, not code)
- Stores decisions permanently (git + Honcho)

---

## Phase 2: PI Agent Implementation (Your Next Move)

**Duration:** 10-15 hours
**Outcome:** Working orchestration system

### Step 1: Set Up PI Locally (1-2 hours)

```bash
# Option A: Clone from GitHub
git clone https://github.com/Th0rgal/open-pi-agent.git
cd open-pi-agent
npm install

# Option B: Use pi.dev
# Follow: https://pi.dev/install
```

### Step 2: Create 3 PI Agent Prompts (2-3 hours)

**File:** `pi-agents/harness-architect.md`
```markdown
# Harness Architect Agent

You design the orchestration system.

Read requirements in:
- docs/investigation/harness_engineering_comparison.md
- docs/investigation/pi_agent_build_strategy.md

Design:
1. MCP tool interfaces (testRunner, coverageValidator, etc.)
2. Claude hook integration points
3. Per-step retry logic
4. Blueprint structure
5. Task manifest system

Output: Detailed architecture document that Harness Builder can implement.
```

**File:** `pi-agents/harness-builder.md`
```markdown
# Harness Builder Agent

You implement the architecture.

Read: Architecture document from Harness Architect

Build:
1. /mcp-tools/ - testRunner, coverageValidator, docValidator, progressLog
2. /claude-hooks/ - beforeCommit validation
3. /blueprints/ - implement-feature, fix-bug, refactor
4. /docs/tasks/ - task manifest templates
5. /ci-cd/ - GitHub Actions validation

Output: Working code, ready to test.
```

**File:** `pi-agents/system-validator.md`
```markdown
# System Validator Agent

You test the implementation.

Tests:
1. Can agent commit code without tests? (should fail)
2. Can agent commit without coverage? (should fail)
3. Can agent commit without docs? (should fail)
4. Can agent commit with all passing? (should succeed)
5. Does retry loop work? (agent sees failures, iterates)

Output: Test results, any bugs found, fixes needed.
```

### Step 3: Run the Agents Sequentially (3-5 hours)

```bash
# In PI (or CLI equivalent):

# 1. Architect designs
pi --agent harness-architect \
   --task "Design the orchestration system per these requirements"

# 2. Builder implements (read architect output)
pi --agent harness-builder \
   --task "Implement this architecture: [architect output]"

# 3. Validator tests
pi --agent system-validator \
   --task "Test this implementation: [builder output]"
```

### Step 4: Iterate if Needed (2-5 hours)

If validator finds issues:
- Builder fixes the code
- Validator re-tests
- Repeat until all tests pass

---

## Phase 3: Tool Implementation (After Phase 2)

**Duration:** 5-8 hours
**Outcome:** Functional tools that enforce rules

Create actual implementations:
- `testRunner.ts` - Runs `npm test`, parses results
- `coverageValidator.ts` - Checks coverage %, validates threshold
- `docValidator.ts` - Checks docs/PROGRESS_LOG.md exists
- `progressLog.ts` - Structured logging with audit trail

---

## Phase 4: Blueprint Creation (After Phase 3)

**Duration:** 3-5 hours
**Outcome:** Task orchestration templates

Create:
- `blueprints/implement-feature.yaml` - 7-step workflow
- `blueprints/fix-bug.yaml` - 5-step workflow
- `blueprints/refactor.yaml` - 6-step workflow

Each blueprint:
```yaml
steps:
  - Create worktree (deterministic)
  - Agent works (implement/fix/refactor)
  - Deterministic check (test/lint/validate)
  - Agent refines (fix failures)
  - Deterministic final check
  - Create PR
```

---

## Phase 5: Validation (After Phase 4)

**Duration:** 10-15 hours
**Outcome:** Proof that system works

Test on simple CRUD app:
```
Tasks:
1. Create user endpoint
2. Create user tests
3. Add authentication
4. Add authorization
5. Add error handling

Measure:
- Did task complete? (yes/no)
- How many agent attempts? (1, 2, 3)
- Did it follow rules? (tests pass, coverage OK, docs updated)

Target: 95%+ success rate (at least 4.75/5 tasks)
```

---

## Phase 6: Documentation & Setup

**Duration:** 5-10 hours
**Outcome:** Ready for use

- [ ] Create `CLAUDE.md` with usage instructions
- [ ] Set up Honcho integration
- [ ] Export this session to Honcho
- [ ] Create session index
- [ ] Document common failures and fixes
- [ ] Write README for implementation

---

## Quick Start Command

**Want to start right now?**

```bash
cd /home/talha/dev/vector

# 1. Read what you're building
cat docs/sessions/2026-03-08-orchestration-design-export.md

# 2. Check all decisions
cat DECISIONS.md

# 3. Read the PI agent strategy
cat docs/investigation/pi_agent_build_strategy.md

# 4. Install PI
# (Follow pi.dev installation)

# 5. Create first agent prompt
# (Copy harness-architect.md from above)

# 6. Run architect agent
pi --agent harness-architect --task "Design orchestration system"
```

---

## Files You'll Need to Reference

During implementation, have these open:
- `DECISIONS.md` (why you're doing this)
- `docs/sessions/2026-03-08-orchestration-design-export.md` (full context)
- `docs/investigation/pi_agent_build_strategy.md` (how PI works)
- `docs/investigation/harness_engineering_comparison.md` (principles)

---

## Success Metrics

### Phase 2 (PI Agents): Complete
- [ ] Architect outputs detailed design
- [ ] Builder outputs working code
- [ ] Validator finds no critical issues

### Phase 3 (Tools): Complete
- [ ] All 4 tools implemented
- [ ] Tools return accurate results (not fake)

### Phase 4 (Blueprints): Complete
- [ ] 3 blueprints created
- [ ] Blueprints follow per-step-retry pattern
- [ ] Max 3 retries per step

### Phase 5 (Validation): Complete
- [ ] 5 CRUD tasks tested
- [ ] 95%+ success rate
- [ ] Failures escalate with full context

### Overall: Ready for Use
- [ ] System prevents agent cheating
- [ ] Escalations include decision options
- [ ] Harness improves from failures (docs updated, not code fixed)
- [ ] Decisions tracked in DECISIONS.md + Honcho

---

## When You Get Stuck

**Problem:** "PI agent didn't generate what I expected"
**Solution:** Make your prompt more specific, provide examples, give constraints

**Problem:** "Built tools don't work with agent"
**Solution:** Check tool interface matches what agent expects, add error handling

**Problem:** "Validation finds many issues"
**Solution:** Don't re-run validator yet. Have Builder fix issues first, then re-validate.

**Problem:** "95% target seems high"
**Solution:** It's ambitious but achievable. Failures teach you what harness needs. Each failure = chance to improve.

---

## How to Document Progress

As you implement each phase:

1. Update DECISIONS.md (add implementation notes)
2. Update NEXT_STEPS.md (mark completed phases)
3. Add notes to session in Honcho (if storing there)
4. Create new session export when phase completes

---

## You Are Here 👇

```
Design: ✅ COMPLETE (You are here)
  ↓
Phase 2 (PI Agents): → NEXT
  ↓
Phase 3 (Tools):
  ↓
Phase 4 (Blueprints):
  ↓
Phase 5 (Validation):
  ↓
Phase 6 (Documentation):
  ↓
Ready for use: 🚀
```

**Ready to begin Phase 2? Start with: Set Up PI Locally (above)**

---

## Questions to Answer Before Starting

Before you begin implementation:

1. **Do you have PI installed?** (or will you use pi.dev)
2. **Do you have a test CRUD codebase?** (or will you create one)
3. **Are the 5 investigation docs clear?** (re-read if confused)
4. **Do you understand per-step retry?** (diagram it if not)
5. **Do you want to start with Architect or implement manually?** (Architect is recommended)

Once you answer yes to all → You're ready for Phase 2.

---

**Next update:** After Phase 2 completes, create new export and update timeline.

*Good luck! You've designed a solid system. Now execute it.* 🚀
