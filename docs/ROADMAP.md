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

### 1. Wake Word Integration (Porcupine)

**Situation:** Voice state machine exists but wake word is stubbed (always returns false).

**Challenge:** Integrate Porcupine SDK with "Jarvis" keyword for hands-free activation.

**Files:** `src-tauri/src/voice/wake_word.rs`, `state_machine.rs`, `server/src/config.ts`

**Verification:** Say "Jarvis" → system transitions to LISTENING state

**Blocker:** Requires `PICOVOICE_ACCESS_KEY` environment variable

- [ ] Add `pv_porcupine` crate to Cargo.toml
- [ ] Implement Porcupine initialization in wake_word.rs
- [ ] Connect wake word detection to state machine
- [ ] Add sensitivity setting (0.0-1.0, default 0.5)
- [ ] Add PICOVOICE_ACCESS_KEY to config.ts
- [ ] Test wake word triggers listening
- [ ] Add wake word toggle to VoiceSettings UI

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

### Future
- [ ] Dashboard views with charts
- [ ] XTTS + RVC voice cloning
- [ ] Plugin system
- [ ] Mobile companion app

---

## Session Notes

> Claude updates this section at the end of each session.
> Format: Date, what was done, what's next, any blockers.

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
- Task 1: Wake Word Integration (requires PICOVOICE_ACCESS_KEY)
- Sprint 3: Quality of Life features

**Blockers:**
- Wake word requires PICOVOICE_ACCESS_KEY environment variable

---

### 2026-01-26 (Session 1)
**Completed:**
- Task 4: Test Coverage (vitest setup + brain.ts tests)
- Task 5: VoiceSettings UI (modal with TTS/wake word toggles, localStorage persistence)
- Task 2: Entity Resolution Layer (verified complete - 19 tests passing)

**Next:**
- Task 1: Wake Word Integration (requires PICOVOICE_ACCESS_KEY)
- Task 3: File Splitting (finance.ts and entity.ts)

**Blockers:**
- Wake word requires PICOVOICE_ACCESS_KEY environment variable

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
- Need PICOVOICE_ACCESS_KEY for wake word
- Issue with X: [description]

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
