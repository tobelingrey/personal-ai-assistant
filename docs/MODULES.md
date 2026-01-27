# Jarvis Module Specification

> This document defines module boundaries for AI-assisted development.
> Each module has explicit responsibilities, interfaces, and boundaries.
> Claude should not cross module boundaries without explicit instruction.

---

## Module Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Chat UI   │  │  Voice UI   │  │  Settings   │                 │
│  │  (React)    │  │  (React)    │  │  (React)    │                 │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘                 │
│         │                │                                          │
│         ▼                ▼                                          │
│  ┌─────────────────────────────────┐                               │
│  │      Frontend Services          │  HTTP/SSE to backend          │
│  │   (API clients, state hooks)    │  Tauri events from Rust       │
│  └─────────────┬───────────────────┘                               │
└────────────────┼────────────────────────────────────────────────────┘
                 │
┌────────────────┼────────────────────────────────────────────────────┐
│                │         RUST LAYER (Tauri)                         │
│                │                                                    │
│  ┌─────────────▼───────────────┐  ┌─────────────────────────────┐  │
│  │     Voice State Machine     │  │      Audio Hardware         │  │
│  │  (wake word, VAD, states)   │◄─┤   (capture, playback)       │  │
│  └─────────────┬───────────────┘  └─────────────────────────────┘  │
│                │                                                    │
│  ┌─────────────▼───────────────┐  ┌─────────────────────────────┐  │
│  │         STT Module          │  │        TTS Module           │  │
│  │    (Whisper transcribe)     │  │   (Piper synthesize)        │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                 │
                 │ HTTP (port 3001)
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express)                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Routes Layer                            │   │
│  │   (HTTP endpoints, SSE streaming, request validation)        │   │
│  └─────────────────────────────┬───────────────────────────────┘   │
│                                │                                    │
│  ┌─────────────────────────────▼───────────────────────────────┐   │
│  │                      Brain Module                            │   │
│  │   (classification, extraction, response generation)          │   │
│  └───────┬─────────────────────┬───────────────────────────────┘   │
│          │                     │                                    │
│  ┌───────▼───────┐  ┌─────────▼─────────┐  ┌───────────────────┐   │
│  │ Entity        │  │  Domain Services  │  │  Enrichment       │   │
│  │ Resolution    │  │  (food, task,     │  │  Queue            │   │
│  │               │  │   finance, etc.)  │  │                   │   │
│  └───────┬───────┘  └─────────┬─────────┘  └─────────┬─────────┘   │
│          │                    │                      │              │
│  ┌───────▼────────────────────▼──────────────────────▼─────────┐   │
│  │                      Data Layer                              │   │
│  │   SQLite (structured) + LanceDB (vectors) + Ollama (LLM)    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module 1: Brain

**Location:** `server/src/services/brain.ts`

### Responsibility
Processes user messages through a single LLM call to classify intent, extract structured data, and generate responses. This is the **central intelligence** — all natural language understanding flows through here.

**Does:**
- Classify message intent (store, query, conversation)
- Extract structured data matching domain schemas
- Identify missing required fields
- Generate contextual responses
- Determine confidence scores

**Does NOT:**
- Persist data to database (delegates to domain services)
- Manage conversation state (handled by conversation.ts)
- Perform entity resolution (delegates to entityResolution.ts)
- Handle HTTP concerns (no request/response objects)

### Interface Contract

```typescript
// Input
interface ProcessMessageInput {
  message: string;
  conversationHistory: Message[];
  pendingContext?: PartialConversation;  // For multi-turn
}

// Output
interface BrainResponse {
  intent: "store" | "query" | "conversation";
  dataType: DomainType | null;
  extracted: Record<string, unknown> | null;
  missingFields: string[];
  response: string;
  followUpQuestion: string | null;
  confidence: number;  // 0.0 - 1.0
}

// Domain types
type DomainType = "food" | "task" | "transaction" | "entity" | 
                  "goal" | "bill" | "appointment";
```

### Boundary Enforcement

- **MAY import:** `schema.ts`, `personality.ts`, `ollama.ts`
- **MUST NOT import:** Any route file, database.ts directly, domain services
- **MAY call:** `ollama.chat()`, schema definitions
- **MUST NOT call:** Database operations, HTTP responses

### Verification

```bash
cd server && npm test -- --grep "brain"
# Tests should verify:
# - Correct classification for each domain
# - Extraction accuracy for required fields
# - Missing field detection
# - Multi-turn context handling
```

---

## Module 2: Entity Resolution

**Location:** `server/src/services/entityResolution.ts`

### Responsibility
Links entity mentions in conversation to existing entity records. Prevents duplicate entities and maintains referential integrity across domains.

**Does:**
- Match mentions to existing entities via name/alias
- Perform vector similarity search for fuzzy matching
- Track recently mentioned entities for context
- Return confidence scores for matches
- Suggest disambiguation when uncertain

**Does NOT:**
- Create new entities (returns "new" action for caller to handle)
- Modify existing entity data
- Access domains other than entities

### Interface Contract

```typescript
// Input
interface ResolveEntityInput {
  mention: string;              // "Sarah", "Mom", "my brother"
  conversationContext: string[];  // Recent messages for context boost
  entityType?: EntityType;      // Optional type hint from extraction
}

// Output
interface ResolutionResult {
  entity: Entity | null;
  confidence: number;           // 0.0 - 1.0
  action: "linked" | "ask" | "new";
  candidates?: Entity[];        // For disambiguation UI
}

// Thresholds
const THRESHOLD_AUTO_LINK = 0.8;   // Confidence above: auto-link
const THRESHOLD_ASK = 0.5;         // Confidence above: ask user
// Below 0.5: suggest creating new entity
```

### Boundary Enforcement

- **MAY import:** `entity.ts` (read operations only), `vectors.ts`
- **MUST NOT import:** Other domain services, brain.ts, routes
- **MAY call:** `searchEntityEmbeddings()`, `getEntityByName()`
- **MUST NOT call:** `createEntity()`, `updateEntity()`, database writes

### Verification

```bash
cd server && npm test -- --grep "entityResolution"
# Tests should verify:
# - Exact match returns confidence 1.0
# - Alias match works ("Mom" → "Mother")
# - Vector similarity finds similar names
# - Recent mention boost works
# - Multiple candidates triggers "ask" action
```

---

## Module 3: Domain Services

**Location:** `server/src/services/{food,task,finance,entity,goals,appointment}.ts`

### Responsibility
Each domain service handles CRUD operations and business logic for its specific data type. Domain services are **data stewards** — they own their schema and enforce data integrity.

**Does:**
- Validate incoming data against domain schema
- Perform CRUD operations on domain tables
- Calculate rollups and aggregations
- Enqueue items for background enrichment

**Does NOT:**
- Parse natural language (that's brain.ts)
- Access other domain tables directly
- Handle HTTP concerns
- Perform entity resolution

### Interface Contract (Example: Food)

```typescript
// All domain services follow this pattern
interface DomainService<T, CreateInput, UpdateInput> {
  create(data: CreateInput): Promise<T>;
  getById(id: number): Promise<T | null>;
  getAll(filters?: FilterOptions): Promise<T[]>;
  update(id: number, data: UpdateInput): Promise<T>;
  delete(id: number): Promise<void>;
}

// Food-specific
interface FoodLogCreate {
  foodName: string;
  quantity?: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  mealDate: string;  // ISO date
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface FoodLogEnriched extends FoodLogCreate {
  id: number;
  enrichment_status: "pending" | "complete" | "failed";
  created_at: string;
}
```

### Boundary Enforcement

- **MAY import:** `database.ts`, `queue.ts`, own types
- **MUST NOT import:** Other domain services, brain.ts, routes
- **MAY call:** Database operations for own tables only
- **MUST NOT call:** Other domain tables, LLM directly

### Verification

```bash
cd server && npm test -- --grep "food|task|finance"
# Tests should verify:
# - CRUD operations work correctly
# - Validation rejects invalid data
# - Rollups calculate correctly
# - Enrichment queue integration works
```

---

## Module 4: Voice State Machine

**Location:** `src-tauri/src/voice/state_machine.rs`

### Responsibility
Manages voice assistant state transitions. Coordinates wake word detection, audio capture, STT/TTS, and UI synchronization.

**Does:**
- Maintain current voice state (Idle, Listening, Transcribing, Processing, Speaking)
- Handle state transitions based on events
- Emit Tauri events for frontend synchronization
- Manage follow-up window (90 seconds post-response)
- Support barge-in (interrupt during speech)

**Does NOT:**
- Perform actual audio capture (delegates to audio module)
- Run STT/TTS inference (delegates to stt.rs, tts.rs)
- Make HTTP calls to backend
- Persist state to disk

### Interface Contract

```rust
// States
pub enum VoiceState {
    Idle,
    Listening,
    Transcribing,
    Processing,
    Speaking,
}

// Events (triggers state transitions)
pub enum VoiceEvent {
    WakeWordDetected,
    ManualTrigger,
    VadSpeechEnd,
    TranscriptionComplete(String),
    ResponseReady(String),
    SpeechComplete,
    BargeIn,
    Timeout,
    Error(String),
}

// Tauri events emitted
// "voice-state-changed" → { state: string, timestamp: number }
// "voice-transcription" → { text: string }
// "voice-error" → { error: string }
```

### Boundary Enforcement

- **MAY import:** `audio/*`, `voice/stt.rs`, `voice/tts.rs`, `voice/vad.rs`, `voice/wake_word.rs`
- **MUST NOT import:** Any frontend code, HTTP client code
- **MAY call:** Audio capture/playback, STT/TTS, Tauri event emission
- **MUST NOT call:** Backend API directly (frontend handles that)

### Verification

```bash
cd src-tauri && cargo test state_machine
# Tests should verify:
# - All valid state transitions work
# - Invalid transitions are rejected
# - Barge-in interrupts speaking state
# - Follow-up window extends listening period
# - Timeout returns to idle
```

---

## Module 5: Enrichment Queue

**Location:** `server/src/services/queue.ts`

### Responsibility
Manages background processing of items that need enrichment (nutrition lookup, etc.). Processes during user idle time to avoid blocking interactions.

**Does:**
- Track pending items by domain and status
- Process batches during idle periods (30s threshold)
- Implement retry logic with exponential backoff
- Pause processing when user activity detected

**Does NOT:**
- Determine what needs enrichment (domain services enqueue)
- Perform the actual enrichment logic (calls domain-specific enrichers)
- Block user interactions

### Interface Contract

```typescript
// Queue item
interface QueueItem {
  id: number;
  domain: DomainType;
  reference_id: number;      // ID in domain table
  status: "pending" | "processing" | "complete" | "failed";
  retry_count: number;
  created_at: string;
  processed_at?: string;
  error?: string;
}

// Queue operations
interface EnrichmentQueue {
  enqueue(domain: DomainType, referenceId: number): Promise<void>;
  processNext(): Promise<void>;
  getStatus(): Promise<QueueStatus>;
  recordActivity(): void;      // Reset idle timer
}

// Configuration
const IDLE_THRESHOLD_MS = 30000;    // 30 seconds
const BATCH_SIZE = 3;
const PROCESS_INTERVAL_MS = 10000;  // 10 seconds
const MAX_RETRIES = 3;
```

### Boundary Enforcement

- **MAY import:** `database.ts`, domain-specific enrichers
- **MUST NOT import:** Routes, brain.ts, voice modules
- **MAY call:** Domain enrichment functions, database operations
- **MUST NOT call:** LLM directly (enrichers handle that)

### Verification

```bash
cd server && npm test -- --grep "queue"
# Tests should verify:
# - Items enqueue correctly
# - Processing respects idle threshold
# - Retry logic works with backoff
# - Activity resets idle timer
# - Failed items don't block queue
```

---

## Module 6: Data Layer

**Location:** `server/src/services/database.ts`, `server/src/services/vectors.ts`

### Responsibility
Provides unified data access for SQLite (structured) and LanceDB (vectors). Handles migrations, connection management, and query execution.

**Does:**
- Initialize databases on startup
- Run migrations in order
- Execute parameterized queries
- Manage vector embeddings and similarity search

**Does NOT:**
- Contain business logic (that's domain services)
- Validate domain-specific data
- Make LLM calls

### Interface Contract

```typescript
// SQLite operations
interface Database {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ lastID: number }>;
  migrate(): Promise<void>;
}

// Vector operations
interface VectorStore {
  storeEmbedding(text: string, metadata: Record<string, unknown>): Promise<void>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  storeEntityEmbedding(entityId: number, nameVariant: string): Promise<void>;
  searchEntities(query: string, limit?: number): Promise<EntityMatch[]>;
}
```

### Boundary Enforcement

- **MAY import:** sql.js, lancedb, ollama (for embeddings only)
- **MUST NOT import:** Domain services, routes, brain.ts
- **MAY call:** Raw database operations
- **MUST NOT call:** Business logic, HTTP operations

---

## Cross-Module Communication Rules

### Allowed Communication Paths

```
Routes → Brain → Domain Services → Database
           ↓
    Entity Resolution
           ↓
       Vectors

Voice State Machine → (Tauri events) → Frontend → (HTTP) → Routes
```

### Forbidden Communication Paths

```
❌ Routes → Database (must go through services)
❌ Brain → Database (must go through domain services)
❌ Domain Service A → Domain Service B (no cross-domain calls)
❌ Voice → Backend API (frontend mediates)
❌ Any module → direct LLM (must use ollama.ts or brain.ts)
```

### Event-Based Communication

Frontend ↔ Rust uses Tauri events, never direct calls:

```typescript
// Frontend listens
listen("voice-state-changed", (event) => { ... });

// Rust emits
app_handle.emit("voice-state-changed", payload)?;
```

---

## Adding New Modules

When adding a new module, create a specification with:

1. **Single responsibility statement** (one sentence)
2. **Does / Does NOT** lists
3. **Interface contract** (TypeScript/Rust types)
4. **Boundary enforcement** (MAY/MUST NOT import/call)
5. **Verification method** (test command)

New modules should slot into the existing communication paths. If a module needs to cross boundaries, reconsider the design or create an explicit integration point.
