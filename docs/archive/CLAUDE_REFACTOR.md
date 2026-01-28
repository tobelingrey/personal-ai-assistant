# CLAUDE.md — Jarvis Refactor

> Quick reference for Claude Code sessions during the Jarvis refactoring.
> Full context: Read `JARVIS_REFACTOR.md` at session start.

---

## Session Start Checklist

```
1. Read JARVIS_REFACTOR.md (full context)
2. Check current sprint in Section 6
3. Find next unchecked task
4. Verify app still works after changes
```

---

## Project Goal

Transform Jarvis from a working prototype to production-quality code by adopting best practices from Moltbot while preserving Jarvis's unique architecture (local-first, structured data extraction, self-evolving schemas).

---

## Key Constraints

| Rule | Reason |
|------|--------|
| Files ≤400 LOC | Maintainability |
| TypeBox for all schemas | Runtime validation |
| No type duplication | Shared via @jarvis/core |
| Tests for new code | 70% coverage target |
| No cloud AI | Privacy-first architecture |

---

## Commands

```bash
# Current (before refactor complete)
cd server && npm run dev     # Backend
cd . && npm run dev          # Frontend (Tauri)
cd server && npm test        # Tests

# Target (after refactor)
pnpm dev                     # All services
pnpm test                    # All tests
pnpm jarvis doctor           # Health check
pnpm check:loc               # File size check
```

---

## Package Dependency Order

```
@jarvis/core        → no jarvis deps
@jarvis/database    → core
@jarvis/brain       → core
@jarvis/domains     → core, database
@jarvis/evolution   → core, database, domains, brain
apps/*              → any packages
```

---

## File Size Violations

If a file exceeds 400 lines, split it:

```
# Before
services/bigfile.ts (600 lines)

# After
services/bigfile/
├── types.ts
├── repository.ts
├── logic.ts
└── index.ts (re-exports)
```

---

## Validation Pattern

```typescript
import { Type, Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

// 1. Define schema
const InputSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  value: Type.Number({ minimum: 0 }),
})

// 2. Derive type
type Input = Static<typeof InputSchema>

// 3. Validate
function validate(data: unknown): Input {
  if (!Value.Check(InputSchema, data)) {
    const errors = [...Value.Errors(InputSchema, data)]
    throw new ValidationError(errors)
  }
  return data
}
```

---

## Test Pattern

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('ServiceName', () => {
  describe('methodName', () => {
    it('does the expected thing', async () => {
      // Arrange
      const input = { ... }
      
      // Act
      const result = await method(input)
      
      // Assert
      expect(result).toMatchObject({ ... })
    })

    it('rejects invalid input', async () => {
      await expect(method({})).rejects.toThrow('ValidationError')
    })
  })
})
```

---

## Commit Messages

```
feat(scope): add new feature
fix(scope): fix bug
refactor(scope): restructure without behavior change
test(scope): add or update tests
docs: documentation changes
chore: tooling, deps, config
```

Scopes: `core`, `brain`, `database`, `domains`, `evolution`, `cli`, `desktop`, `server`

---

## What NOT To Do

- Don't add cloud AI dependencies
- Don't duplicate types across packages
- Don't skip validation
- Don't commit console.log
- Don't modify migrations after applied
- Don't exceed 400 LOC
- Don't break existing functionality

---

## Current Sprint Tasks

**Check JARVIS_REFACTOR.md Section 6 for full task list.**

Quick status:
- Sprint 1: Foundation Setup → IN PROGRESS
- Sprint 2: Validation Layer → NOT STARTED
- Sprint 3: Package Extraction → NOT STARTED
- Sprint 4: Polish & DX → NOT STARTED

---

## Verification After Changes

```bash
# Must pass before committing
cd server && npm test        # Tests pass
cd server && npm run build   # Builds
# Manually test: chat still works
```

---

## Getting Help

If stuck:
1. Check JARVIS_REFACTOR.md for context
2. Check MODULES.md for architecture boundaries
3. Check CONTEXT.md for design rationale
4. Note blocker and move to next task

---

## Session End Checklist

```
1. Mark completed tasks in JARVIS_REFACTOR.md Section 6
2. Verify app works
3. Commit with conventional message
4. Note any blockers
```
