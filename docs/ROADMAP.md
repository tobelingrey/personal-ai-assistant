# Jarvis Development Roadmap

> This document tracks active work and replaces separate sprint/handoff docs.
> Claude updates the task list and session notes automatically.
> Start each session: "Read docs/ROADMAP.md and complete the next unchecked task."

---

## Current Focus: Sprint 1 — Foundation Hardening

**Goal:** Address high-priority gaps from best practices review

**Sprint Duration:** 1-2 weeks

---

## Active Tasks

### 1. Wake Word Integration (OpenWakeWord) ✅

**Situation:** Voice state machine exists with OpenWakeWord integration, but multiple frontend bugs prevented it from working.

**Challenge:** Fix frontend integration so wake word detection actually triggers listening.

**Files:** `src-tauri/src/voice/wake_word.rs`, `state_machine.rs`, `src/App.tsx`, `src/components/VoiceIndicator.tsx`, `src/hooks/useVoiceSettings.ts`

**Verification:** Say "Jarvis" → system transitions to LISTENING state

**Note:** Uses OpenWakeWord (not Porcupine) - no API key required.

- [x] OpenWakeWord integration in wake_word.rs (completed earlier)
- [x] Connect wake word detection to state machine (completed earlier)
- [x] Add sensitivity setting slider to VoiceSettings UI
- [x] Add wake word toggle to VoiceSettings UI
- [x] **Fix:** Add VoiceIndicator to App.tsx (was never rendered)
- [x] **Fix:** Add auto-start voice system on app mount
- [x] **Fix:** VoiceIndicator shows "Start Voice" when not running (was returning null)
- [x] **Fix:** Sensitivity mapping (frontend 0-1 → backend 0.5-2.5)
- [x] **Fix:** Enable wake word by default (was disabled)

---

### 2. Entity Resolution Layer ✅

**Situation:** Entity mentions in conversation don't link to existing entities, causing duplicates.

**Challenge:** Create vector-based entity resolution with alias support.

**Files:** `server/src/services/entityResolution.ts`, `chat.ts`, `entity.ts`, `vectors.ts`

**Verification:** "Call Mom" links to existing entity with "Mom" alias

- [x] Create entityResolution.ts with resolveEntity() function
- [x] Add aliases column to entities table (migration 009)
- [x] Add migration to database.ts array
- [x] Implement entity embedding storage in vectors.ts
- [x] Generate embeddings for existing entities on startup
- [x] Integrate resolution into chat.ts routing layer (per MODULES.md, brain.ts must not import domain services)
- [x] Add disambiguation prompt when confidence 0.5-0.8
- [x] Test alias matching ("Mom" → "Mother")
- [x] Test vector similarity for fuzzy names

---

### 3. File Splitting ✅

**Situation:** finance.ts (1034 lines) and entity.ts (972 lines) are too large.

**Challenge:** Split into directory modules while maintaining API compatibility.

**Verification:** All existing endpoints still work after split

#### 3a. Split finance.ts
- [x] Create server/src/services/finance/ directory
- [x] Create index.ts with re-exports
- [x] Extract types.ts for shared interfaces
- [x] Extract repository.ts for data access
- [x] Extract analytics.ts for rollup/analysis logic
- [x] Update imports in routes/finance.ts
- [x] Verify all finance endpoints work

#### 3b. Split entity.ts
- [x] Create server/src/services/entity/ directory
- [x] Create index.ts with re-exports
- [x] Extract types.ts for shared interfaces
- [x] Extract mappers.ts for data mapping
- [x] Extract crud.ts for base CRUD operations
- [x] Extract aliases.ts for alias management
- [x] Extract search.ts for search logic
- [x] Extract person.ts for person-specific logic
- [x] Update imports in routes/entity.ts
- [x] Verify all entity endpoints work

---

### 4. Test Coverage (brain.ts)

**Situation:** Zero automated test coverage on backend.

**Challenge:** Add Vitest and create tests for critical extraction logic.

**Verification:** `cd server && npm test` passes with >50% coverage on brain.ts

- [x] Add vitest and @vitest/coverage-v8 to server/package.json
- [x] Create vitest.config.ts
- [x] Add "test" script to package.json
- [x] Create server/src/services/__tests__/ directory
- [x] Create mocks/ollama.ts with mock responses
- [x] Write classification tests (food, task, transaction, entity, conversation)
- [x] Write extraction tests (dates, amounts, entity mentions)
- [x] Write multi-turn tests (follow-ups, context preservation)
- [x] Write edge case tests (ambiguous input, missing fields)
- [x] Verify coverage >50% on brain.ts

---

### 5. VoiceSettings UI Access

**Situation:** VoiceSettings.tsx exists but is not accessible from main UI.

**Challenge:** Add gear icon to Chat header that opens settings panel.

**Verification:** Click gear → settings panel opens with TTS/wake word toggles

- [x] Add settings icon button to Chat.tsx header
- [x] Create modal or slide-out panel for VoiceSettings
- [x] Ensure TTS toggle works
- [x] Add wake word toggle (disabled if no access key)
- [x] Add wake word sensitivity slider
- [x] Settings persist across sessions
- [x] Close modal returns to chat

---

## Completed

- [x] Core chat with streaming responses
- [x] Single-pass brain architecture
- [x] 7 domain services (food, task, finance, entity, goals, appointment, facts)
- [x] Voice state machine with barge-in
- [x] TTS (Piper) integration
- [x] STT (Whisper) integration
- [x] Background enrichment queue
- [x] Multi-turn conversation state
- [x] Vector memory storage (LanceDB)

### Sprint 2: Self-Evolution System ✅
- [x] Phase 1: Capture unclassified messages (pendingEntries.ts)
- [x] Phase 2: Embed and cluster patterns (patternDetection.ts)
- [x] Phase 3: LLM schema proposal (schemaProposer.ts)
- [x] Phase 4: API routes and UI (evolution.ts, EvolutionPanel.tsx)
- [x] Phase 5: Dynamic table creation (dynamicSchema.ts)
- [x] Phase 6: Brain integration (domainRegistry.ts, dynamicDomainService.ts)
- [x] Phase 7: Reprocessing (reprocessing.ts)

---

## Backlog (Future Sprints)

### Sprint 3: Quality of Life
- [ ] Multi-model routing (fast classifier, better extractor)
- [ ] Silero VAD (replace energy-based)
- [ ] Notification system (task reminders)
- [ ] Data export/import
- [ ] Domain-specific query routes (GET /food/logs, GET /tasks, GET /entities)
- [ ] Move hardcoded thresholds to config (PENDING_ENTRY_THRESHOLD, history max, etc.)

### Future
- [ ] Dashboard views with charts
- [ ] XTTS + RVC voice cloning
- [ ] Plugin system
- [ ] Mobile companion app

---

## Session Notes

> Claude updates this section at the end of each session.
> Format: Date, what was done, what's next, any blockers.

### 2026-01-28 (Session 4)
**Completed:**
- Documentation cleanup and archival:
  - Created `docs/archive/` directory
  - Archived 4 obsolete docs: CLAUDE_REFACTOR.md, JARVIS_REFACTOR.md, jarvis-v2-structure.md, jarvis-vs-moltbot-analysis.md
- Filter system improvements:
  - Created `packages/core/src/types/filters.ts` with domain-specific filter types (BaseFilters, TransactionFilters, TaskFilters, FoodFilters, EntityFilters)
  - Updated finance repository to use TransactionFilters with category/type support
  - Updated finance routes to extract category/type query params
  - Added database migration 002 with missing indexes (idx_transactions_type, idx_food_logs_meal_type, idx_tasks_priority)
- Updated CLAUDE.md with filter type guidance

**Files Modified:**
- `packages/core/src/types/filters.ts` - NEW: Domain-specific filter types
- `packages/core/src/types/index.ts` - Export filters
- `server/src/services/finance/repository.ts` - Use TransactionFilters
- `server/src/routes/finance.ts` - Extract category/type params
- `server/src/services/database.ts` - Add migration 002, runPendingMigrations()
- `CLAUDE.md` - Added filter type rule

**Next:**
- Sprint 3: Quality of Life features
- Add query routes for other domains (food, task, entity)

**Blockers:**
- None

---

### 2026-01-26 (Session 3)
**Completed:**
- Task 1: Wake Word Integration - Fixed critical frontend bugs preventing wake word from working:
  - Added VoiceIndicator component to App.tsx header (was never rendered)
  - Added auto-start voice system on app mount (1 second delay for Tauri init)
  - Fixed VoiceIndicator to show "Start Voice" button when not running (was returning null)
  - Fixed sensitivity mapping: frontend slider 0-1 now maps to backend 0.5-2.5
  - Changed wake word to enabled by default (was disabled)

**Files Modified:**
- `src/App.tsx` - Added VoiceIndicator import/render, auto-start useEffect
- `src/components/VoiceIndicator.tsx` - Added start button when not running
- `src/hooks/useVoiceSettings.ts` - Fixed sensitivity mapping, enabled wake word by default

**Next:**
- Test wake word detection end-to-end
- Sprint 3: Quality of Life features (multi-model routing, Silero VAD, notifications)

**Blockers:**
- None

---

### 2026-01-26 (Session 2)
**Completed:**
- Task 3: File Splitting
  - finance.ts → server/src/services/finance/ (types.ts, repository.ts, analytics.ts, index.ts)
  - entity.ts → server/src/services/entity/ (types.ts, mappers.ts, crud.ts, aliases.ts, search.ts, person.ts, index.ts)
- Sprint 2: Self-Evolution System (all 7 phases)
  - pendingEntries.ts, patternDetection.ts, schemaProposer.ts
  - dynamicSchema.ts, domainRegistry.ts, dynamicDomainService.ts, reprocessing.ts
  - evolution.ts routes, EvolutionPanel.tsx UI

**Next:**
- Task 1: Wake Word Integration
- Sprint 3: Quality of Life features

**Blockers:**
- None (switched from Porcupine to OpenWakeWord - no API key required)

---

### 2026-01-26 (Session 1)
**Completed:**
- Task 4: Test Coverage (vitest setup + brain.ts tests)
- Task 5: VoiceSettings UI (modal with TTS/wake word toggles, localStorage persistence)
- Task 2: Entity Resolution Layer (verified complete - 19 tests passing)

**Next:**
- Task 1: Wake Word Integration
- Task 3: File Splitting (finance.ts and entity.ts)

**Blockers:**
- None

---

### [Session Template]
**Date:** YYYY-MM-DD

**Completed:**
- Task X completed
- Task Y partially completed (steps 1-3 done)

**Next:**
- Continue Task Y from step 4
- Start Task Z

**Blockers:**
- Issue with X: [description]
- (or "None" if no blockers)

---

## How to Use This Document

### Starting a Session
```
Read docs/ROADMAP.md and complete the next unchecked task. 
Mark it complete when done. Run verification to confirm.
```

### During a Session
1. Work on one task at a time
2. Mark subtasks complete as you go
3. Run verification command when task complete
4. If blocked, note in Session Notes and move to next task

### Ending a Session
1. Mark completed tasks with [x]
2. Add entry to Session Notes
3. Note any blockers or decisions made
4. Ensure code compiles and tests pass
5. **Always update ROADMAP.md** — Mark completed subtasks with [x] before ending
