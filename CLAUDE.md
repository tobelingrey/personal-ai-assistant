# Jarvis

Local-first AI personal assistant. Tauri + React + Express + Ollama. Privacy-focused, runs entirely on user's machine.

## Commands

```bash
npm run dev                         # Frontend + Tauri
cd server && npm run dev            # Backend
cd server && npm test               # Tests
curl localhost:3001/health          # Verify backend
```

## Structure

```
src/                  # React frontend
src-tauri/src/        # Rust voice (state machine, TTS, STT)
server/src/services/  # Business logic — brain.ts is core
server/src/routes/    # HTTP endpoints
migrations/           # SQL schemas
```

## Key Rules

- All extraction flows through `brain.ts` — don't bypass it
- Use `type: unknown` not `type: any`
- Emit Tauri events for Rust↔Frontend — don't poll
- Add new migrations to `database.ts` array
- Entity mentions must resolve via `entityResolution.ts`

## Environment

```bash
JARVIS_MODEL=qwen2.5:7b
PICOVOICE_ACCESS_KEY=xxx  # Optional, for wake word
```

## References

Read these only when relevant to your current task:

| Document | When to Read |
|----------|--------------|
| `docs/MODULES.md` | Before modifying module boundaries or interfaces |
| `docs/CONTEXT.md` | When you need design rationale or user scenarios |
| `docs/ROADMAP.md` | Start of session — contains current tasks |
