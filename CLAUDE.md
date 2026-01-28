# Jarvis

Local-first AI personal assistant. Tauri + React + Express + Ollama. Privacy-focused, runs entirely on user's machine.

## Commands

```bash
# Development
pnpm install                        # Install all dependencies
pnpm dev                            # Frontend (Vite)
cd server && pnpm dev               # Backend
pnpm dev:all                        # All services in parallel

# Build
pnpm build:all                      # Build @jarvis/core and @jarvis/cli

# Testing & Validation
pnpm test                           # Run server tests
pnpm check:loc                      # Verify no file exceeds 400 lines

# CLI
pnpm jarvis doctor                  # Health check (Ollama, models, config)

# Verification
curl localhost:3001/health          # Verify backend
```

## Structure

```
packages/
  core/                 # @jarvis/core - shared types & config
    src/types/          # BrainResponse, Message, domain types
    src/config/         # TypeBox config schema & loader

apps/
  cli/                  # @jarvis/cli - CLI tools (jarvis doctor)

server/
  src/services/         # Business logic — brain.ts is core
  src/routes/           # HTTP endpoints

src/                    # React frontend
src-tauri/src/          # Rust voice (state machine, TTS, STT)
  voice/
    mod.rs              # Module exports and get_models_dir
    controller.rs       # VoiceController orchestration
```

## Key Rules

- All extraction flows through `brain.ts` — don't bypass it
- Use `type: unknown` not `type: any`
- Emit Tauri events for Rust↔Frontend — don't poll
- Add new migrations to `database.ts` migrations array
- Entity mentions must resolve via `entityResolution.ts`
- **Max 400 lines per file** — enforced by `pnpm check:loc`
- Types go in `@jarvis/core`, re-export in server/frontend
- Use domain-specific filter types from `@jarvis/core` (e.g., `TransactionFilters`, `TaskFilters`)

## Environment

```bash
JARVIS_MODEL=qwen2.5:7b
OLLAMA_HOST=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
JARVIS_DB_PATH=./data/jarvis.db
PICOVOICE_ACCESS_KEY=xxx  # Optional, for wake word
```

## References

Read these only when relevant to your current task:

| Document | When to Read |
|----------|--------------|
| `docs/AGENTS.md` | Multi-agent development rules, file ownership |
| `docs/MODULES.md` | Before modifying module boundaries or interfaces |
| `docs/CONTEXT.md` | When you need design rationale or user scenarios |
| `docs/ROADMAP.md` | Start of session — contains current tasks |
