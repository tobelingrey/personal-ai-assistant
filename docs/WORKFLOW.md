# AI-First Development Workflow

> This guide explains how to use the Jarvis documentation structure with Claude Code.
> Based on spec-driven development (SDD) best practices.

---

## Document Structure

```
CLAUDE.md           # Root instructions (<100 lines) — always loaded
docs/
├── MODULES.md      # Technical reference — read when crossing boundaries
├── CONTEXT.md      # Deep context — read when you need "why"
└── ROADMAP.md      # Task list — tracks state, replaces handoff
```

### When Claude Reads What

| Document | When to Read | Purpose |
|----------|--------------|---------|
| CLAUDE.md | Every session (auto-loaded) | Commands, rules, quick reference |
| MODULES.md | Before modifying a module | Boundaries, interfaces, contracts |
| CONTEXT.md | When confused about intent | Vision, scenarios, rationale |
| ROADMAP.md | Start of session | Current tasks, what's next |

---

## Session Workflow

### Starting a Session

```
Read docs/ROADMAP.md and complete the next unchecked task.
Mark it complete when done. Run verification to confirm.
```

This single prompt:
1. Loads current state from ROADMAP.md
2. Identifies next task
3. Sets success criteria (verification command)
4. Establishes completion protocol

### During a Session

**For straightforward tasks:**
- Work directly from ROADMAP.md task description
- Mark subtasks complete as you go
- Run verification after each task

**For complex tasks:**
- Read MODULES.md for the relevant module
- Check boundary enforcement rules
- Reference CONTEXT.md if unsure about design intent

**If stuck:**
```
Read docs/CONTEXT.md for background on [topic].
Then continue with the current task.
```

### Ending a Session

Claude updates ROADMAP.md Session Notes automatically:
- What was completed
- What's next
- Any blockers

No separate handoff document needed — the task list is the state.

---

## Spec-Driven Development Cycle

For new features (not in current sprint), follow this cycle:

### Phase 1: Specify

Create a spec in natural language describing user experience:

```markdown
## Feature: Recurring Tasks

User says "Remind me to take vitamins every morning at 8am"

Expected behavior:
1. Create task with recurrence rule (daily, 8am)
2. Task appears in "today" query every day
3. Completing it creates next occurrence
4. User can say "stop the vitamins reminder" to cancel recurrence
```

### Phase 2: Plan

Create technical approach (Claude can help):

```markdown
## Recurring Tasks - Technical Plan

1. Add `recurrence` column to tasks table (JSON: frequency, time, end_date)
2. Extend brain.ts schema to extract recurrence patterns
3. Add `createNextOccurrence()` to task.ts service
4. Modify task completion flow to trigger recurrence
5. Add "cancel recurrence" intent to brain.ts
```

### Phase 3: Task

Break into 5-15 minute implementation chunks:

```markdown
- [ ] Migration: Add recurrence column to tasks
- [ ] Update task.ts types for RecurrenceRule
- [ ] Extend JARVIS_SCHEMA with recurrence extraction
- [ ] Implement createNextOccurrence() function
- [ ] Hook completion flow to recurrence check
- [ ] Add tests for recurrence creation
- [ ] Add tests for occurrence generation
- [ ] Test end-to-end: "remind me every day"
```

### Phase 4: Implement

Execute tasks one at a time using the session workflow.

---

## The "What Claude Gets Wrong" Pattern

CLAUDE.md contains a growing list of corrections. Update it when:

**Claude makes a mistake:**
```markdown
## What Claude Gets Wrong

- Don't modify brain.ts schema without updating schema.ts JARVIS_SCHEMA
+ - Don't use console.log in services — use the logger utility
```

**Claude does something correctly without instruction:**
- Remove redundant guidance that's now "obvious" from examples

This creates a self-improving instruction set specific to this project.

---

## Verification: The Force Multiplier

Every task in ROADMAP.md should have a verification command:

```markdown
**Verification:** `cd server && npm test -- --grep "entity"`
```

This closes the feedback loop. Claude runs verification, sees results, and can self-correct.

Good verifications:
- `npm test` — unit tests pass
- `curl http://localhost:3001/health` — server running
- `cargo test state_machine` — Rust tests pass
- "Say 'Jarvis'" — manual test for voice

Bad verifications:
- "Check that it works" — too vague
- "Review the code" — no objective criteria

---

## Module Boundary Enforcement

When Claude needs to modify multiple modules, check MODULES.md first:

```
Before implementing, read docs/MODULES.md section for [Brain Module].
Note the boundary enforcement rules. Proceed with implementation.
```

If a task requires crossing boundaries, either:
1. Split into separate tasks per module
2. Create an explicit integration point
3. Reconsider the design (boundaries exist for a reason)

---

## Context Window Management

### Use `/clear` Between Unrelated Tasks

After completing a task, before starting an unrelated one:
```
/clear
```

Then re-load minimal context:
```
Read CLAUDE.md and docs/ROADMAP.md. Continue with next task.
```

### Save Plans to Files

For multi-session features, write plans to docs:
```
Write this plan to docs/PLAN_recurring_tasks.md so it survives /clear.
```

---

## Common Prompts

### Start of Day
```
Read docs/ROADMAP.md and complete the next unchecked task.
```

### Need Context
```
Read docs/CONTEXT.md for background on [entity resolution].
```

### Before Modifying Module
```
Read docs/MODULES.md section for [Brain Module], then proceed.
```

### After Completing Task
```
Mark the task complete in ROADMAP.md and run verification.
```

### End of Session
```
Update ROADMAP.md Session Notes with what was done and what's next.
```

### Blocked
```
Note the blocker in ROADMAP.md Session Notes and move to next task.
```

---

## Anti-Patterns to Avoid

❌ **Kitchen sink sessions** — accumulating irrelevant context
→ Use `/clear` between unrelated tasks

❌ **Comprehensive CLAUDE.md** — 500+ line instruction manuals
→ Keep under 100 lines, use references for detail

❌ **Parallel branches** — multiple worktrees modifying same files
→ Sequential development produces cleaner results

❌ **Vague tasks** — "improve the system"
→ Specific tasks with verification commands

❌ **Separate handoff docs** — state scattered across files
→ Task list is the state (ROADMAP.md)

---

## Quick Reference

| Need | Document | Section |
|------|----------|---------|
| Build commands | CLAUDE.md | Commands |
| Module interfaces | MODULES.md | [Module] Interface Contract |
| Why decisions were made | CONTEXT.md | Technical Decisions |
| What to work on | ROADMAP.md | Active Tasks |
| How to talk like Jarvis | CONTEXT.md | Personality Guidelines |
| What not to do | CLAUDE.md | What Claude Gets Wrong |
