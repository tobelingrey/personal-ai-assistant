# Jarvis Project Context

> This document provides deep context for AI-assisted development.
> Read this when you need to understand the "why" behind decisions.
> CLAUDE.md tells you what to do. This tells you why.

---

## Vision

Jarvis is a **local-first AI personal assistant** that runs entirely on the user's machine. No cloud. No subscriptions. No data leaving the device. It's an always-available assistant that remembers everything about your life and gets smarter the more you use it.

The name and personality are inspired by J.A.R.V.I.S. from Iron Man — a sophisticated, capable assistant with dry British wit who addresses the user as "sir" and maintains professional composure while being genuinely helpful.

### Core Insight

**Your personal data is incredibly valuable, but only if it's structured in a way that makes it queryable and actionable.**

Most note-taking apps and voice assistants create unstructured dumps. "Remind me about the thing" fails because there's no structure. Jarvis transforms casual conversations into structured, searchable knowledge that enables real queries:

- "How many calories did I eat this week?"
- "What tasks are due tomorrow?"
- "When is Mom's birthday?"
- "How much did I spend on groceries this month?"

These queries require structured data, not text search.

---

## Design Philosophy

### 1. Privacy by Design

Every architectural decision prioritizes privacy:

- **All data stored locally** in SQLite and LanceDB files
- **No network requests** except to local Ollama instance
- **No telemetry**, no analytics, no cloud sync
- **User owns their data completely** — it's just files on their disk

This isn't just a feature; it's a constraint that shapes everything. We can't use cloud APIs for better transcription. We can't use GPT-4 for better extraction. The local-only constraint forces us to optimize what runs on consumer hardware.

### 2. Structured Over Unstructured

The wrong approach (and what most apps do):
```
memories: { id, content, type, payload_json }
```

This fails because:
- Can't index JSON fields efficiently
- Can't do `SUM(calories)` or `WHERE due_date < today`
- No type safety or constraints
- Queries are ugly and slow

The right approach (what Jarvis does):
```
food_logs: { id, meal_date, calories, protein_g, ... }
tasks: { id, title, due_date, priority, status, ... }
transactions: { id, amount, category, date, ... }
```

This enables:
- Real database indexes for fast queries
- Proper aggregations: `SELECT SUM(calories) FROM food_logs WHERE meal_date = today`
- Type safety and constraints
- Foreign key relationships
- Clean, fast SQL

**The cost**: We need extraction logic for each domain. The benefit: data that's actually useful.

### 3. Immediate + Deep Processing

Users shouldn't wait for "smart" features. The architecture separates:

**Immediate (during conversation):**
- Acknowledge input instantly
- Stream response tokens
- Store raw data

**Background (when idle):**
- Enrich with nutrition data
- Calculate rollups
- Detect patterns
- Update embeddings

The 30-second idle threshold ensures background work never interrupts conversation.

### 4. Self-Evolving Intelligence (Future)

The planned self-evolution system is the strategic differentiator:

> When Jarvis sees patterns it doesn't recognize, it proposes new schemas.
> User approves, and Jarvis adapts its own structure.

Example: User mentions "morning yoga" 10 times over several weeks. Jarvis notices this doesn't fit existing schemas, tracks the pattern, and proposes: "I've noticed you track exercise regularly. Would you like me to create a dedicated schema for workouts?"

This isn't implemented yet but shapes architectural decisions.

---

## User Scenarios

These scenarios define what "working correctly" means. When implementing features, reference these as acceptance criteria.

### Food & Nutrition

**Input:** "I had 4 slices of pepperoni pizza from Pizza Hut for lunch"

**Expected behavior:**
1. Recognize as food intake (intent: store, dataType: food)
2. Extract: meal type (lunch), food description, source (Pizza Hut), quantity (4 slices)
3. Respond with confirmation in Jarvis voice
4. Store in `food_logs` with enrichment_status: pending
5. Background: Look up nutrition, update calories/macros
6. Enable query: "How many calories did I eat today?"

**Input:** "What did I eat this week?"

**Expected behavior:**
1. Recognize as query (intent: query, dataType: food)
2. Fetch food_logs for past 7 days
3. Calculate totals from daily_nutrition rollups
4. Respond with summary in conversational format

### Tasks & Reminders

**Input:** "Remind me to call the dentist tomorrow at 3pm"

**Expected behavior:**
1. Recognize as task creation
2. Extract: title ("call the dentist"), due date (tomorrow), due time (3pm)
3. Store in `tasks` with status: pending
4. Create entry in `task_reminders` for notification
5. Enable query: "What do I need to do tomorrow?"

**Input:** "I need to buy groceries, pick up dry cleaning, and get gas"

**Expected behavior:**
1. Recognize as multiple task creation
2. Extract three separate tasks
3. Tag all with context: "errands" (inferred)
4. Store each in `tasks`
5. Respond acknowledging all three

### People & Relationships

**Input:** "My brother John's birthday is June 15th"

**Expected behavior:**
1. Recognize as entity information
2. Check if "John" entity exists (entity resolution)
3. If exists: update with birthday and relationship
4. If new: create entity with name, relationship (brother), birthday
5. Enable query: "When is John's birthday?" and "Any birthdays coming up?"

**Input:** "Had lunch with Sarah"

**Expected behavior:**
1. Recognize as food or event mention
2. Resolve "Sarah" to existing entity
3. If multiple Sarahs: ask for disambiguation
4. If one Sarah: link to that entity
5. If no Sarah: optionally create or note as unresolved

### Finance

**Input:** "Spent $47.50 on groceries at Walmart"

**Expected behavior:**
1. Recognize as transaction
2. Extract: amount ($47.50), category (groceries), vendor (Walmart), type (expense)
3. Store in `transactions`
4. Update `monthly_spending` and `category_spending` rollups
5. Enable query: "How much did I spend on groceries this month?"

### Multi-Turn Conversations

**Input sequence:**
1. "I had a sandwich"
2. "For lunch"
3. "Turkey and cheese from Subway"

**Expected behavior:**
1. First message: Recognize food, ask "What meal was this?"
2. Second message: Update partial data with meal type
3. Third message: Complete the food log with all details
4. Conversation state persists across messages (24-hour expiry)

---

## Technical Decisions & Rationale

### Why Single-Pass Brain?

**Alternative considered:** Multi-pass (classifier → extractor → responder)

**Why rejected:**
- 3x latency for every message
- Classifier errors cascade to extractor
- Requires maintaining separate prompts per domain

**Why single-pass works:**
- Modern LLMs handle multi-task prompts well
- Universal schema covers all domains in one prompt
- Extraction and response generation share context
- Single point of optimization

### Why SQLite + LanceDB (Not Postgres)?

**Alternative considered:** PostgreSQL with pgvector

**Why rejected:**
- Requires running a database server
- Complicates installation ("just download and run")
- Overkill for single-user personal data

**Why SQLite + LanceDB works:**
- Single file, no server
- sql.js runs in-process
- LanceDB is disk-based, no server
- Both are battle-tested
- Easy backup (copy files)

### Why Tauri (Not Electron)?

**Alternative considered:** Electron

**Why rejected:**
- 150MB+ bundle size
- Memory hog (Chromium per app)
- Less native feel

**Why Tauri works:**
- 10MB bundle size
- Uses system webview
- Rust backend for performance-critical voice processing
- Native system integration

### Why Piper TTS (Not Cloud)?

**Alternative considered:** ElevenLabs, OpenAI TTS

**Why rejected:**
- Requires internet
- Per-request cost
- Data leaves device
- Latency

**Why Piper works:**
- Fully local
- Fast inference on CPU
- Multiple voice options
- No ongoing cost

### Why qwen2.5:7b (Not Larger)?

**Alternative considered:** llama3:70b, mixtral

**Why rejected:**
- Requires high-end GPU
- Slow inference on consumer hardware
- Most users don't have 48GB VRAM

**Why qwen2.5:7b works:**
- Runs on 8GB VRAM or CPU-only
- Good extraction accuracy for structured tasks
- Fast enough for conversational latency
- Can upgrade per-user via JARVIS_MODEL env var

---

## Personality Guidelines

Jarvis speaks with the voice of J.A.R.V.I.S. from Iron Man:

### Voice Characteristics

- **Formal British English**: "Certainly, sir" not "Sure thing!"
- **Dry wit**: Subtle humor, never slapstick
- **Professional**: Competent and composed
- **Respectful**: Always "sir" (or configured honorific)
- **Concise**: Especially for voice output

### Example Responses

**Good:**
> "I've logged your lunch, sir. Four slices of pepperoni pizza from Pizza Hut — approximately 1,120 calories. Shall I note anything else?"

**Bad:**
> "Got it! 🍕 Pizza logged! Yum! That's a lot of calories though, maybe try a salad next time? 😊"

**Good (query response):**
> "You have three tasks due tomorrow, sir: call the dentist at 3pm, submit the quarterly report, and pick up dry cleaning. The dentist appointment is the only time-sensitive item."

**Bad:**
> "Tomorrow's tasks: 1) Call dentist 2) Submit report 3) Dry cleaning. Don't forget!"

### Handling Errors

**Good:**
> "I'm afraid I couldn't quite parse that, sir. Could you rephrase? I understood something about lunch but missed the specifics."

**Bad:**
> "Error: extraction failed. Please try again with valid input."

---

## Domain Knowledge

### Food & Nutrition

- Meal types: breakfast, lunch, dinner, snack
- Standard serving sizes vary by food type
- Nutrition data can be enriched via USDA database or LLM estimation
- Daily rollups aggregate by date for fast historical queries
- "Calories" is the primary metric users care about

### Tasks

- Priority levels: low, medium, high, urgent
- Status: pending, in_progress, completed, cancelled
- Recurring tasks need separate handling (not yet implemented)
- "Remind me" implies a task with a due date
- Context tags (errands, work, home) are inferred, not required

### Finance

- Transaction types: income, expense
- Categories should be consistent (groceries, not "food shopping" vs "grocery store")
- Bills are recurring with due day (1-31) and frequency
- Monthly rollups enable "spending this month" queries
- Vendor normalization helps ("Walmart" = "WAL-MART" = "Walmart Supercenter")

### Entities

- Types: person, pet, organization, place
- Relationships are from user's perspective ("my brother", "my vet")
- Aliases enable flexible matching ("Mom" = "Mother" = "Mama")
- Birthdays enable proactive "upcoming birthdays" queries
- Entity resolution prevents duplicates

### Voice

- Wake word: "Jarvis" (Porcupine)
- Follow-up window: 90 seconds (no re-trigger needed)
- Barge-in: user can interrupt during speech
- VAD: voice activity detection determines speech boundaries
- STT: Whisper for transcription
- TTS: Piper for synthesis

---

## Constraints & Limitations

### Hardware Constraints

- Must run on consumer hardware (no enterprise GPU required)
- Target: 8GB RAM, integrated GPU or 6GB VRAM
- Storage: SQLite + LanceDB should stay under 1GB for years of data

### Model Constraints

- Local LLM accuracy is lower than GPT-4
- Extraction may miss nuances or misclassify edge cases
- This is acceptable — user can correct and Jarvis learns

### Latency Constraints

- First token should appear within 500ms
- Full response within 3 seconds for simple queries
- Background processing should not impact foreground latency

### Privacy Constraints

- No network calls except localhost
- No telemetry of any kind
- No crash reporting to external services
- All data must be exportable/deletable by user

---

## Success Metrics

How to know if Jarvis is working well:

1. **Extraction accuracy**: >90% of clearly stated information correctly extracted
2. **Query accuracy**: >95% of queries return correct data when data exists
3. **Response latency**: <500ms to first token, <3s to complete response
4. **Voice latency**: <1s from speech end to transcription complete
5. **Entity resolution**: <5% duplicate entities created for same real-world entity

---

## Future Directions

### Self-Evolution (Sprint 2)
Pattern detection → schema proposal → user approval → dynamic table creation

### Multi-Model Routing (Future)
Fast model for classification, better model for deep extraction

### Proactive Intelligence (Future)
"You have a trip coming up and bills due the same week"

### Natural Language Queries (Future)
"Show me a chart of my spending over the last 6 months"

---

## Reference: Jarvis Personality Prompt

This is the system prompt that defines Jarvis's voice:

```
You are J.A.R.V.I.S., an advanced AI assistant inspired by the AI from Iron Man.
You speak with formal British English, dry wit, and professional composure.
Always address the user as "sir" (or their preferred honorific).
Be helpful, concise, and occasionally subtly humorous.
Never use emojis, excessive exclamation marks, or casual slang.
When confirming actions, be specific about what was done.
When asking for clarification, be clear about what's missing.
Maintain the persona consistently across all interactions.
```
