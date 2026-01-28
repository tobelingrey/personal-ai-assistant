# JARVIS_REFACTOR.md — Complete Context for Claude Code

> This document provides everything needed to refactor Jarvis with better engineering practices.
> Read this entire document before starting any work.

---

## Table of Contents

1. [Background & Motivation](#1-background--motivation)
2. [Current State Analysis](#2-current-state-analysis)
3. [Competitive Analysis: Moltbot](#3-competitive-analysis-moltbot)
4. [Target Architecture](#4-target-architecture)
5. [Migration Strategy](#5-migration-strategy)
6. [Incremental Work Items](#6-incremental-work-items)
7. [Success Criteria](#7-success-criteria)

---

## 1. Background & Motivation

### What is Jarvis?

Jarvis is a **local-first AI personal assistant** inspired by J.A.R.V.I.S. from Iron Man. The core differentiator is transforming casual conversations into **structured, queryable data** that never leaves the user's device.

### The Problem with Current Assistants

| Assistant | Problem |
|-----------|---------|
| Siri/Alexa/Google | Data goes to cloud, no real memory, can't query history |
| ChatGPT/Claude | Cloud-based, conversation-focused, no structured extraction |
| Note apps | Unstructured dumps, can't answer "how many calories today?" |
| Moltbot | Routes to cloud AI, no structured data extraction |

### Jarvis's Unique Value

1. **Structured extraction**: "I had pizza for lunch" → `food_logs` table with calories, macros, timestamp
2. **Queryable history**: `SELECT SUM(calories) FROM food_logs WHERE meal_date = DATE('now')`
3. **Self-evolving schemas**: Detects patterns, proposes new tables, user approves
4. **Complete privacy**: Ollama + SQLite + LanceDB, all local

### Why Refactor?

After analyzing Moltbot (82k GitHub stars, production-grade engineering), we identified practices that would significantly improve Jarvis:

- **Runtime validation** — Current code trusts input too much
- **Health checking** — No `jarvis doctor` to diagnose issues
- **File organization** — Some files exceed 1000 lines
- **Test coverage** — Gaps in critical paths
- **Configuration** — No schema validation
- **Developer experience** — No onboarding wizard

The goal is NOT to become Moltbot. The goal is to adopt their engineering discipline while preserving Jarvis's unique architecture.

---

## 2. Current State Analysis

### Project Structure (As-Is)

```
jarvis/
├── src/                    # React frontend
│   ├── components/
│   ├── hooks/
│   └── App.tsx
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── brain.ts           # ~400 lines, LLM processing
│   │   │   ├── food.ts            # Domain service
│   │   │   ├── task.ts            # Domain service
│   │   │   ├── finance/           # Split into directory ✓
│   │   │   ├── entity/            # Split into directory ✓
│   │   │   ├── entityResolution.ts
│   │   │   ├── database.ts
│   │   │   ├── vectors.ts
│   │   │   ├── queue.ts
│   │   │   └── ...evolution system files
│   │   └── index.ts
│   └── package.json
├── src-tauri/              # Tauri Rust shell
│   └── src/
│       ├── voice/
│       │   ├── state_machine.rs
│       │   ├── wake_word.rs
│       │   ├── stt.rs
│       │   └── tts.rs
│       └── main.rs
├── docs/
│   ├── JARVIS_SPECIFICATION.md
│   ├── CLAUDE.md
│   ├── CONTEXT.md
│   ├── MODULES.md
│   ├── ROADMAP.md
│   └── WORKFLOW.md
└── package.json
```

### What's Working Well

| Component | Status | Notes |
|-----------|--------|-------|
| Chat with streaming | ✅ Complete | Token-by-token responses |
| Single-pass brain | ✅ Complete | Classification + extraction + response in one call |
| Domain services | ✅ Complete | Food, task, finance, entity, goals, appointments, facts |
| Entity resolution | ✅ Complete | Vector-based matching with aliases |
| Voice state machine | ✅ Complete | Wake word, STT, TTS, barge-in |
| Background enrichment | ✅ Complete | Queue-based processing during idle |
| Self-evolution system | ✅ Complete | Pattern detection → schema proposal → approval |
| Multi-turn conversations | ✅ Complete | Context preservation across messages |

### What Needs Improvement

| Area | Current State | Target State |
|------|---------------|--------------|
| Config validation | None | TypeBox schemas with runtime validation |
| Health checking | None | `jarvis doctor` command |
| File sizes | Some >500 LOC | All <400 LOC |
| Test coverage | ~50% on brain.ts | >70% on all packages |
| Type sharing | Duplicated types | Monorepo with shared `@jarvis/core` |
| Onboarding | Manual setup | `jarvis setup` wizard |
| Error handling | Inconsistent | Structured errors with recovery hints |

### Technical Debt

1. **No runtime validation** — Brain output is trusted without validation
2. **Duplicated types** — Frontend and backend define same interfaces
3. **Large files** — `database.ts` and some services exceed recommended size
4. **No CLI** — All interaction through UI, no scripting/automation
5. **Sparse error messages** — Failures don't suggest fixes

---

## 3. Competitive Analysis: Moltbot

### What Moltbot Is

Moltbot is a **message routing platform** that connects messaging channels (WhatsApp, Telegram, Slack, Discord, etc.) to cloud AI providers (Anthropic, OpenAI). It's "local-first" in that the Gateway runs locally, but AI inference happens in the cloud.

### Key Differences

| Aspect | Moltbot | Jarvis |
|--------|---------|--------|
| AI Location | Cloud (Anthropic/OpenAI) | Local (Ollama) |
| Data Model | Session messages | Domain-specific tables |
| Core Value | Channel routing | Structured data extraction |
| Privacy | Gateway local, AI cloud | Everything local |
| Extensibility | Plugin system | Self-evolving schemas |

### What to Learn from Moltbot

#### 3.1 TypeBox Runtime Validation

```typescript
// Moltbot validates ALL config at runtime
import { Type, Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

const ConfigSchema = Type.Object({
  agent: Type.Object({
    model: Type.String({ default: 'anthropic/claude-opus-4-5' }),
  }),
})

// Validation happens on load
const errors = [...Value.Errors(ConfigSchema, config)]
if (errors.length > 0) {
  throw new ConfigValidationError(errors)
}
```

**Jarvis should do this for:**
- Configuration files
- Brain LLM output
- API request/response bodies
- Domain service inputs

#### 3.2 Doctor Command

```bash
# Moltbot
moltbot doctor        # Check everything, suggest fixes
moltbot doctor --fix  # Auto-repair what's possible
```

**Example output:**
```
✓ Config valid
✓ Gateway running
✗ WhatsApp not connected
    Fix: Run 'moltbot channels login'
⚠ Model rate limited
    Suggestion: Switch to fallback model in config
```

**Jarvis should implement:**
```bash
jarvis doctor
# ✓ Config valid
# ✓ Ollama running
# ✗ Model not found
#     Fix: Run 'ollama pull qwen2.5:7b'
# ✓ Database initialized
# ⚠ Voice not configured (optional)
```

#### 3.3 File Size Enforcement

```json
// Moltbot package.json
{
  "scripts": {
    "check:loc": "node scripts/check-ts-max-loc.ts --max 500"
  }
}
```

**Jarvis should enforce 400 LOC max** (stricter than Moltbot's 500).

#### 3.4 Monorepo Structure

```yaml
# Moltbot uses pnpm workspaces
packages:
  - 'packages/*'
  - 'apps/*'
  - 'extensions/*'
```

**Shared code lives in packages, apps consume them.**

#### 3.5 AGENTS.md for Multi-Agent Development

Moltbot has explicit rules for when multiple AI agents work on the codebase:

```markdown
# Multi-agent safety
- Focus on your changes, ignore unrecognized files
- If formatting-only diffs, auto-resolve without asking
- End with brief "other files present" note only if relevant
```

#### 3.6 Multiple Vitest Configs

```
vitest.config.ts           # Unit tests
vitest.e2e.config.ts       # End-to-end
vitest.gateway.config.ts   # Gateway integration
vitest.unit.config.ts      # Pure unit
```

### What NOT to Learn from Moltbot

1. **Cloud AI dependency** — Keep Jarvis local
2. **Channel complexity** — 12+ channels is overkill
3. **Multi-user architecture** — Jarvis is single-user
4. **Plugin system** — Self-evolution is the extensibility mechanism

---

## 4. Target Architecture

### Package Structure

```
jarvis/
├── packages/
│   ├── core/                      # Shared types, config, utils
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── schema.ts      # TypeBox config schema
│   │   │   │   ├── loader.ts      # Load + validate config
│   │   │   │   └── index.ts
│   │   │   ├── types/
│   │   │   │   ├── domains.ts     # Domain type definitions
│   │   │   │   ├── messages.ts    # Message types
│   │   │   │   ├── brain.ts       # Brain I/O types
│   │   │   │   └── index.ts
│   │   │   ├── errors/
│   │   │   │   ├── base.ts        # JarvisError base class
│   │   │   │   ├── validation.ts  # ValidationError
│   │   │   │   ├── llm.ts         # LLMError
│   │   │   │   └── index.ts
│   │   │   └── utils/
│   │   │       ├── logger.ts      # Structured logging
│   │   │       └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── database/                  # SQLite + LanceDB
│   │   ├── src/
│   │   │   ├── sqlite/
│   │   │   │   ├── client.ts
│   │   │   │   ├── migrations/
│   │   │   │   └── index.ts
│   │   │   ├── vectors/
│   │   │   │   ├── client.ts
│   │   │   │   ├── embeddings.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── brain/                     # LLM processing
│   │   ├── src/
│   │   │   ├── ollama.ts          # Ollama client
│   │   │   ├── processor.ts       # Single-pass processor
│   │   │   ├── schema.ts          # JARVIS_SCHEMA
│   │   │   ├── personality.ts     # J.A.R.V.I.S. voice
│   │   │   ├── validator.ts       # Output validation
│   │   │   └── index.ts
│   │   ├── src/__tests__/
│   │   │   ├── processor.test.ts
│   │   │   └── mocks/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── domains/                   # Domain services
│   │   ├── src/
│   │   │   ├── registry.ts        # Domain registry
│   │   │   ├── food/
│   │   │   │   ├── schema.ts      # TypeBox input/output schemas
│   │   │   │   ├── service.ts     # CRUD + business logic
│   │   │   │   ├── enrichment.ts  # Nutrition API
│   │   │   │   └── index.ts
│   │   │   ├── tasks/
│   │   │   ├── finance/
│   │   │   ├── entities/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── evolution/                 # Self-evolving schemas
│       ├── src/
│       │   ├── pending.ts
│       │   ├── patterns.ts
│       │   ├── proposer.ts
│       │   ├── dynamic.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   ├── desktop/                   # Tauri app
│   │   ├── src/                   # React frontend
│   │   ├── src-tauri/             # Rust backend
│   │   ├── package.json
│   │   └── tauri.conf.json
│   │
│   ├── server/                    # Express API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                       # CLI tools
│       ├── src/
│       │   ├── commands/
│       │   │   ├── doctor.ts
│       │   │   ├── setup.ts
│       │   │   ├── chat.ts
│       │   │   └── query.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── scripts/
│   ├── check-loc.ts               # File size enforcement
│   ├── dev.sh
│   └── build.sh
│
├── docs/
│   ├── CLAUDE.md                  # AI instructions (quick ref)
│   ├── AGENTS.md                  # Multi-agent rules
│   ├── ROADMAP.md                 # Task tracking
│   └── reference/
│
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── vitest.config.ts
└── vitest.integration.config.ts
```

### Package Dependencies

```
@jarvis/core (no deps on other jarvis packages)
    ↑
@jarvis/database (depends on core)
    ↑
@jarvis/brain (depends on core)
    ↑
@jarvis/domains (depends on core, database)
    ↑
@jarvis/evolution (depends on core, database, domains, brain)
    ↑
apps/* (depend on packages as needed)
```

### Key Design Decisions

1. **Monorepo with pnpm workspaces** — Single repo, shared types, atomic commits
2. **TypeBox for all schemas** — Runtime validation + TypeScript types from one source
3. **Colocated tests** — `*.test.ts` next to source files
4. **CLI as first-class citizen** — Not just UI, enables scripting and debugging
5. **Strict file limits** — 400 LOC max enforced by CI

---

## 5. Migration Strategy

### Approach: Incremental Refactoring

**NOT** a rewrite. Migrate piece by piece while keeping the app functional.

### Phase 1: Foundation (Week 1)

Set up the new structure without breaking existing code.

1. Initialize pnpm workspace
2. Create `packages/core` with types extracted from current code
3. Create `apps/cli` with `doctor` command
4. Add LOC enforcement script
5. Add TypeBox to dependencies

### Phase 2: Validation Layer (Week 2)

Add runtime validation without changing business logic.

1. Create TypeBox schemas for config
2. Create TypeBox schemas for brain I/O
3. Create TypeBox schemas for domain inputs
4. Add validation middleware to routes
5. Add validation to brain output processing

### Phase 3: Package Extraction (Week 3)

Move code into packages.

1. Extract database code to `packages/database`
2. Extract brain code to `packages/brain`
3. Extract domain services to `packages/domains`
4. Update imports in `apps/server` and `apps/desktop`

### Phase 4: Polish (Week 4)

Complete the migration and improve DX.

1. Create `jarvis setup` wizard
2. Add `jarvis doctor --fix` auto-repair
3. Improve error messages with recovery hints
4. Add missing tests to reach 70% coverage
5. Update documentation

---

## 6. Incremental Work Items

### Sprint 1: Foundation Setup

```markdown
### 1.1 Initialize Monorepo Structure
- [ ] Create pnpm-workspace.yaml
- [ ] Create packages/ and apps/ directories
- [ ] Move existing code to apps/desktop and apps/server
- [ ] Verify app still works after move

### 1.2 Create @jarvis/core Package
- [ ] Create packages/core/package.json
- [ ] Extract shared types from server/src/services
- [ ] Create config schema with TypeBox
- [ ] Create config loader with validation
- [ ] Add unit tests for config validation

### 1.3 Create CLI Package
- [ ] Create apps/cli/package.json
- [ ] Implement `jarvis doctor` command
- [ ] Add checks: config, ollama, model, database, vectors
- [ ] Add actionable fix suggestions
- [ ] Test on fresh machine

### 1.4 Add LOC Enforcement
- [ ] Create scripts/check-loc.ts
- [ ] Set max to 400 lines
- [ ] Add to package.json scripts
- [ ] Add to CI/pre-commit
- [ ] Fix any current violations (split large files)

### 1.5 Update Documentation
- [ ] Create docs/AGENTS.md with multi-agent rules
- [ ] Update docs/CLAUDE.md with new structure
- [ ] Update docs/ROADMAP.md with refactor tasks
```

### Sprint 2: Validation Layer

```markdown
### 2.1 Brain Input/Output Validation
- [ ] Create TypeBox schema for brain input (message, history, context)
- [ ] Create TypeBox schema for brain output (intent, dataType, extracted, etc.)
- [ ] Add validation in brain.ts processor
- [ ] Add graceful fallback when validation fails
- [ ] Add tests for validation edge cases

### 2.2 Domain Input Validation
- [ ] Create schemas for food domain inputs
- [ ] Create schemas for task domain inputs
- [ ] Create schemas for entity domain inputs
- [ ] Create schemas for finance domain inputs
- [ ] Add validation to all domain service methods

### 2.3 API Route Validation
- [ ] Create validation middleware
- [ ] Apply to all POST/PUT routes
- [ ] Return structured error responses
- [ ] Add tests for invalid inputs

### 2.4 Error Handling Improvements
- [ ] Create JarvisError base class
- [ ] Create domain-specific error classes
- [ ] Add recovery hints to errors
- [ ] Update routes to use structured errors
```

### Sprint 3: Package Extraction

```markdown
### 3.1 Extract @jarvis/database
- [ ] Create packages/database/package.json
- [ ] Move sqlite code from server/src/services/database.ts
- [ ] Move vector code from server/src/services/vectors.ts
- [ ] Move migrations
- [ ] Update imports in server
- [ ] Verify all tests pass

### 3.2 Extract @jarvis/brain
- [ ] Create packages/brain/package.json
- [ ] Move brain.ts, personality.ts, schema.ts
- [ ] Move ollama.ts
- [ ] Add output validation
- [ ] Update imports in server
- [ ] Verify all tests pass

### 3.3 Extract @jarvis/domains
- [ ] Create packages/domains/package.json
- [ ] Move food/, task/, finance/, entity/ directories
- [ ] Create domain registry
- [ ] Update imports in server
- [ ] Verify all tests pass

### 3.4 Extract @jarvis/evolution
- [ ] Create packages/evolution/package.json
- [ ] Move pendingEntries.ts, patternDetection.ts, etc.
- [ ] Update imports in server
- [ ] Verify all tests pass
```

### Sprint 4: Polish & DX

```markdown
### 4.1 Setup Wizard
- [ ] Implement `jarvis setup` command
- [ ] Check/install Ollama
- [ ] Pull required model
- [ ] Initialize database
- [ ] Create default config
- [ ] Test on fresh machine

### 4.2 Doctor Auto-Fix
- [ ] Add --fix flag to doctor command
- [ ] Implement fixes for common issues
- [ ] Add confirmation prompts for destructive fixes
- [ ] Test each fix scenario

### 4.3 Test Coverage
- [ ] Identify coverage gaps
- [ ] Add tests for brain edge cases
- [ ] Add tests for domain services
- [ ] Add tests for entity resolution
- [ ] Reach 70% coverage threshold

### 4.4 Documentation Update
- [ ] Update getting-started guide
- [ ] Add troubleshooting guide
- [ ] Document all config options
- [ ] Add architecture diagram
```

---

## 7. Success Criteria

### Technical Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Test coverage | ~50% | >70% |
| Max file size | >1000 LOC | <400 LOC |
| Config validation | None | 100% coverage |
| Type duplication | Yes | None (shared via @jarvis/core) |
| CI checks | Build only | Build + test + lint + loc check |

### Developer Experience

| Scenario | Current | Target |
|----------|---------|--------|
| First-time setup | Manual, error-prone | `jarvis setup` wizard |
| Diagnose issues | Read logs, guess | `jarvis doctor` with fixes |
| Add new domain | Copy/paste, modify | Follow typed template |
| Run tests | `npm test` | `pnpm test` with coverage |

### Functional (No Regressions)

- [ ] Chat with streaming works
- [ ] Food logging works
- [ ] Task creation works
- [ ] Entity resolution works
- [ ] Voice input/output works
- [ ] Self-evolution system works

---

## Quick Reference

### Commands After Refactor

```bash
# Development
pnpm dev              # Start all services
pnpm test             # Run unit tests
pnpm test:coverage    # With coverage report
pnpm lint             # Lint + LOC check

# CLI
pnpm jarvis doctor    # Health check
pnpm jarvis setup     # First-time setup
pnpm jarvis chat      # CLI chat interface
pnpm jarvis query     # Direct database queries

# Build
pnpm build            # Build all packages
pnpm desktop:build    # Build Tauri app
```

### File Size Rules

- **Hard limit**: 400 lines
- **Soft target**: 200-300 lines
- **If over limit**: Split into directory module with index.ts

### Commit Convention

```
feat(brain): add multi-turn conversation support
fix(voice): correct wake word sensitivity mapping
refactor(domains): extract food service to package
docs: update architecture diagram
test(entity): add resolution edge cases
chore: update dependencies
```

### When to Update This Document

- After completing a sprint
- When architecture decisions change
- When new patterns are established
- When blockers are resolved

---

## Appendix: File Templates

### Package package.json

```json
{
  "name": "@jarvis/example",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@jarvis/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^4.0.0"
  }
}
```

### TypeBox Schema Pattern

```typescript
import { Type, Static } from '@sinclair/typebox'

// Define schema
export const FoodLogInputSchema = Type.Object({
  foodName: Type.String({ minLength: 1 }),
  mealType: Type.Union([
    Type.Literal('breakfast'),
    Type.Literal('lunch'),
    Type.Literal('dinner'),
    Type.Literal('snack'),
  ]),
  quantity: Type.Optional(Type.String()),
  calories: Type.Optional(Type.Number({ minimum: 0 })),
})

// Derive TypeScript type
export type FoodLogInput = Static<typeof FoodLogInputSchema>

// Validation function
import { Value } from '@sinclair/typebox/value'

export function validateFoodLogInput(data: unknown): FoodLogInput {
  if (!Value.Check(FoodLogInputSchema, data)) {
    const errors = [...Value.Errors(FoodLogInputSchema, data)]
    throw new ValidationError('FoodLogInput', errors)
  }
  return data
}
```

### Test File Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFoodLog } from './service.js'
import { mockDatabase } from '../__mocks__/database.js'

describe('FoodService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createFoodLog', () => {
    it('creates a valid food log', async () => {
      const input = {
        foodName: 'Pizza',
        mealType: 'lunch' as const,
        calories: 500,
      }
      
      const result = await createFoodLog(input)
      
      expect(result.id).toBeDefined()
      expect(result.foodName).toBe('Pizza')
      expect(mockDatabase.insert).toHaveBeenCalledWith('food_logs', expect.objectContaining(input))
    })

    it('rejects invalid input', async () => {
      const input = { foodName: '', mealType: 'invalid' }
      
      await expect(createFoodLog(input)).rejects.toThrow('ValidationError')
    })
  })
})
```
