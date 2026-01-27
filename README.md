<div align="center">

# J.A.R.V.I.S.

### Local-First AI Personal Assistant

[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange?logo=rust)](https://rust-lang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**Transform casual conversations into structured, searchable personal knowledge—entirely on your machine.**

[Features](#features) • [Architecture](#architecture) • [Quick Start](#quick-start) • [Documentation](#documentation)

</div>

---

## Overview

J.A.R.V.I.S. is a privacy-first AI personal assistant that runs completely locally. No cloud services, no API keys, no data leaving your machine. Powered by Ollama for local LLM inference, it combines natural language understanding with structured data management across multiple life domains.

### Key Differentiators

- **Zero Cloud Dependency** — All processing happens locally via Ollama
- **Voice-First Interface** — Wake word activation, STT, TTS with barge-in support
- **Structured Knowledge** — Extracts and stores data across 7 domains (food, tasks, finance, etc.)
- **Self-Evolving Schema** — Detects patterns and proposes new data structures automatically
- **Single-Pass NLU** — Efficient intent classification, extraction, and response in one LLM call

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Tauri)                 │
│  • Chat interface with streaming responses                  │
│  • Voice state visualization                                │
│  • Self-evolution schema review panel                       │
└─────────────────────────┬───────────────────────────────────┘
                          │ Tauri IPC + HTTP
┌─────────────────────────▼───────────────────────────────────┐
│                 RUST VOICE LAYER (Tauri 2)                  │
│  • Audio capture (cpal) with resampling (rubato)            │
│  • Wake word detection (OpenWakeWord/ONNX)                  │
│  • Voice Activity Detection (VAD)                           │
│  • State machine: Idle → Listening → Processing → Speaking  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP :3001
┌─────────────────────────▼───────────────────────────────────┐
│               BACKEND (Node.js + Express)                   │
│  • Brain module — single-pass NLU pipeline                  │
│  • Domain services (7) with CRUD + validation               │
│  • Entity resolution with vector similarity                 │
│  • SQLite (structured) + LanceDB (embeddings)               │
│  • Background enrichment queue                              │
│  • Self-evolution: pattern detection → schema proposal      │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    OLLAMA (Local LLM)                       │
│  • Default: qwen2.5:7b                                      │
│  • Intent classification, extraction, response generation   │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Natural Language Understanding

- **Single-pass brain architecture** — Intent classification, entity extraction, and response generation in one efficient LLM call
- **Multi-turn conversation state** — 24-hour context window with automatic expiry
- **Streaming responses** — Server-Sent Events for real-time output
- **Entity resolution** — Links mentions to existing entities ("Mom" → stored contact)

### Voice Interface

| Capability | Technology |
|------------|------------|
| Wake Word | OpenWakeWord (ONNX) — "Jarvis" keyword |
| Speech-to-Text | Whisper (local inference) |
| Text-to-Speech | Piper (local inference) |
| Voice Activity Detection | Energy-based VAD |
| Barge-in | Interrupt during TTS playback |
| Follow-up Window | 90-second continuous conversation |

### Structured Data Domains

| Domain | Capabilities |
|--------|-------------|
| **Food & Nutrition** | Meal logging, calorie/macro tracking, nutritional enrichment |
| **Tasks** | Reminders, priorities, status tracking, due dates |
| **Finance** | Expense tracking, bill management, category analytics |
| **Entities** | People, relationships, contact info, aliases |
| **Goals** | Personal objectives with progress tracking |
| **Appointments** | Calendar events, reminders |
| **Facts** | Miscellaneous knowledge storage |

### Self-Evolution System

The assistant learns new data patterns without code changes:

1. **Pattern Detection** — Clusters unclassified messages by semantic similarity
2. **Schema Proposal** — LLM generates table schema for detected patterns
3. **User Approval** — Review and approve proposed structures
4. **Dynamic Creation** — Creates SQLite tables and domain handlers
5. **Reprocessing** — Retroactively processes captured messages

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript 5.3, Vite 5, Tauri 2 |
| **Backend** | Node.js, Express 4.18, TypeScript |
| **Database** | SQLite (sql.js), LanceDB (vectors) |
| **Voice/Audio** | Rust, cpal 0.15, ONNX Runtime, rubato |
| **AI Inference** | Ollama (local), qwen2.5:7b default |
| **Testing** | Vitest with coverage |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Rust 1.70+ with cargo
- [Ollama](https://ollama.ai) installed and running

### Installation

```bash
# Clone the repository
git clone https://github.com/tobelingrey/personal-ai-assistant.git
cd personal-ai-assistant

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..

# Pull the default LLM model
ollama pull qwen2.5:7b
```

### Development

```bash
# Terminal 1: Start the backend
cd server && npm run dev

# Terminal 2: Start the frontend + Tauri
npm run dev
```

### Verify Installation

```bash
# Check backend health
curl http://localhost:3001/health

# Expected response:
# {"status":"ok","timestamp":"...","model":"qwen2.5:7b"}
```

---

## Project Structure

```
jarvis/
├── src/                      # React frontend
│   ├── components/           # UI components
│   │   ├── Chat.tsx          # Main conversation interface
│   │   ├── VoiceIndicator.tsx
│   │   └── evolution/        # Self-evolution UI
│   ├── hooks/                # React hooks
│   │   ├── useChat.ts
│   │   ├── useVoiceState.ts
│   │   └── useEvolution.ts
│   └── services/             # API clients
│
├── server/                   # Express backend
│   └── src/
│       ├── services/
│       │   ├── brain.ts      # NLU pipeline
│       │   ├── database.ts   # SQLite + migrations
│       │   ├── vectors.ts    # LanceDB embeddings
│       │   ├── entityResolution.ts
│       │   └── [domain].ts   # Domain services
│       └── routes/           # HTTP endpoints
│
├── src-tauri/                # Rust backend
│   └── src/
│       ├── voice/            # Audio processing
│       │   ├── wake_word.rs  # ONNX inference
│       │   ├── vad.rs        # Voice activity
│       │   └── state_machine.rs
│       └── commands/         # Tauri IPC
│
├── docs/                     # Documentation
│   ├── MODULES.md            # Module specifications
│   ├── CONTEXT.md            # Design rationale
│   └── ROADMAP.md            # Development roadmap
│
└── migrations/               # SQL schema files
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `JARVIS_MODEL` | `qwen2.5:7b` | Ollama model for inference |
| `PICOVOICE_ACCESS_KEY` | — | Optional: Porcupine wake word |
| `NODE_ENV` | `development` | Environment mode |

---

## Development Commands

```bash
# Frontend + Tauri
npm run dev                   # Development server
npm run build                 # Production build

# Backend
cd server
npm run dev                   # Development with hot reload
npm test                      # Run tests (watch mode)
npm run test:run              # Run tests once
npm run build                 # TypeScript compilation
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [MODULES.md](docs/MODULES.md) | Module boundaries and interfaces |
| [CONTEXT.md](docs/CONTEXT.md) | Design philosophy and decisions |
| [ROADMAP.md](docs/ROADMAP.md) | Current tasks and future plans |
| [CLAUDE.md](CLAUDE.md) | AI development guidelines |

---

## Roadmap

### Completed
- Core chat with streaming responses
- Single-pass brain architecture
- 7 domain services with CRUD
- Voice state machine with barge-in
- Background enrichment queue
- Entity resolution layer
- Self-evolution system (all phases)
- Test coverage with Vitest

### In Progress
- OpenWakeWord integration
- Audio device configuration

### Planned
- Multi-model routing (task-specific models)
- Silero VAD (improved voice detection)
- Dashboard with analytics
- Data export/import
- Plugin system

---

## Contributing

Contributions are welcome! Please read the documentation in `docs/` before submitting PRs.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `cd server && npm test`
5. Submit a pull request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with privacy in mind. Your data stays yours.**

</div>
