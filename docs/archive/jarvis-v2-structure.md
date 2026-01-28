# Jarvis v2: Project Structure & Best Practices

> A fresh start incorporating lessons from Moltbot while preserving Jarvis's unique value proposition.

---

## Project Structure

```
jarvis-v2/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Lint, test, build
├── packages/
│   ├── core/                      # Shared types, utils, config
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── schema.ts      # TypeBox config schema
│   │   │   │   └── loader.ts      # Config loading + validation
│   │   │   ├── types/
│   │   │   │   ├── domains.ts     # Domain type definitions
│   │   │   │   ├── messages.ts    # Message types
│   │   │   │   └── index.ts       # Re-exports
│   │   │   └── utils/
│   │   │       ├── logger.ts      # Structured logging
│   │   │       └── errors.ts      # Custom error types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── database/                  # SQLite + LanceDB
│   │   ├── src/
│   │   │   ├── sqlite/
│   │   │   │   ├── client.ts      # SQLite connection
│   │   │   │   ├── migrations/    # Numbered migrations
│   │   │   │   │   ├── 001_initial.ts
│   │   │   │   │   ├── 002_food_logs.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── queries/       # Typed query builders
│   │   │   ├── vectors/
│   │   │   │   ├── client.ts      # LanceDB connection
│   │   │   │   └── embeddings.ts  # Embedding generation
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── brain/                     # LLM processing
│   │   ├── src/
│   │   │   ├── ollama.ts          # Ollama client
│   │   │   ├── processor.ts       # Single-pass brain
│   │   │   ├── schema.ts          # JARVIS_SCHEMA definition
│   │   │   ├── personality.ts     # J.A.R.V.I.S. voice
│   │   │   └── index.ts
│   │   ├── src/__tests__/
│   │   │   ├── processor.test.ts
│   │   │   └── mocks/
│   │   │       └── ollama.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── domains/                   # Domain services
│   │   ├── src/
│   │   │   ├── food/
│   │   │   │   ├── schema.ts      # TypeBox schema
│   │   │   │   ├── service.ts     # CRUD + business logic
│   │   │   │   ├── enrichment.ts  # Nutrition lookup
│   │   │   │   └── index.ts
│   │   │   ├── tasks/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── service.ts
│   │   │   │   └── index.ts
│   │   │   ├── finance/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── service.ts
│   │   │   │   └── index.ts
│   │   │   ├── entities/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── service.ts
│   │   │   │   ├── resolution.ts  # Entity resolution
│   │   │   │   └── index.ts
│   │   │   └── index.ts           # Domain registry
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── evolution/                 # Self-evolving schema system
│       ├── src/
│       │   ├── pending.ts         # Unclassified entry tracking
│       │   ├── patterns.ts        # Pattern detection
│       │   ├── proposer.ts        # Schema proposal generation
│       │   ├── dynamic.ts         # Dynamic table creation
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   ├── desktop/                   # Tauri desktop app
│   │   ├── src/                   # React frontend
│   │   │   ├── components/
│   │   │   │   ├── Chat/
│   │   │   │   ├── VoiceIndicator/
│   │   │   │   └── Settings/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── App.tsx
│   │   ├── src-tauri/             # Rust backend
│   │   │   ├── src/
│   │   │   │   ├── voice/
│   │   │   │   │   ├── state_machine.rs
│   │   │   │   │   ├── wake_word.rs
│   │   │   │   │   ├── stt.rs
│   │   │   │   │   └── tts.rs
│   │   │   │   └── main.rs
│   │   │   └── Cargo.toml
│   │   ├── package.json
│   │   └── tauri.conf.json
│   │
│   ├── server/                    # Express API server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── chat.ts
│   │   │   │   ├── domains.ts
│   │   │   │   └── health.ts
│   │   │   ├── middleware/
│   │   │   │   └── validation.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                       # CLI for testing/scripting
│       ├── src/
│       │   ├── commands/
│       │   │   ├── doctor.ts      # Health check
│       │   │   ├── setup.ts       # First-time setup
│       │   │   ├── chat.ts        # CLI chat interface
│       │   │   └── query.ts       # Direct database queries
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── scripts/
│   ├── check-loc.ts               # Enforce file size limits
│   ├── dev.sh                     # Start development
│   ├── build.sh                   # Production build
│   └── release.sh                 # Release automation
│
├── docs/
│   ├── CLAUDE.md                  # AI assistant instructions
│   ├── AGENTS.md                  # Multi-agent safety rules
│   ├── ROADMAP.md                 # Task tracking
│   ├── getting-started.md
│   └── reference/
│       ├── config.md
│       └── domains.md
│
├── pnpm-workspace.yaml
├── package.json                   # Root scripts
├── tsconfig.base.json             # Shared TS config
├── vitest.config.ts               # Unit tests
├── vitest.integration.config.ts   # Integration tests
└── .env.example
```

---

## Root package.json

```json
{
  "name": "jarvis",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:integration": "vitest -c vitest.integration.config.ts",
    "lint": "oxlint --tsconfig tsconfig.base.json .",
    "check:loc": "tsx scripts/check-loc.ts --max 400",
    "check:types": "pnpm -r typecheck",
    "doctor": "pnpm --filter @jarvis/cli doctor",
    "setup": "pnpm --filter @jarvis/cli setup",
    "prepare": "pnpm check:loc && pnpm lint && pnpm check:types"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "oxlint": "^0.15.0",
    "tsx": "^4.7.0",
    "typescript": "^5.7.0",
    "vitest": "^4.0.0",
    "@vitest/coverage-v8": "^4.0.0"
  }
}
```

---

## pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

---

## Key Files

### packages/core/src/config/schema.ts

```typescript
import { Type, Static } from '@sinclair/typebox'

export const LLMConfigSchema = Type.Object({
  model: Type.String({ default: 'qwen2.5:7b' }),
  endpoint: Type.String({ default: 'http://localhost:11434' }),
  temperature: Type.Number({ minimum: 0, maximum: 2, default: 0.7 }),
  maxTokens: Type.Number({ minimum: 1, default: 2048 }),
})

export const VoiceConfigSchema = Type.Object({
  enabled: Type.Boolean({ default: true }),
  wakeWord: Type.Object({
    enabled: Type.Boolean({ default: true }),
    word: Type.String({ default: 'jarvis' }),
    sensitivity: Type.Number({ minimum: 0, maximum: 1, default: 0.5 }),
  }),
  tts: Type.Object({
    enabled: Type.Boolean({ default: true }),
    model: Type.String({ default: 'en_US-ryan-high' }),
  }),
  stt: Type.Object({
    model: Type.String({ default: 'base.en' }),
  }),
})

export const DatabaseConfigSchema = Type.Object({
  path: Type.String({ default: './data/jarvis.db' }),
  vectorPath: Type.String({ default: './data/vectors' }),
})

export const JarvisConfigSchema = Type.Object({
  llm: LLMConfigSchema,
  voice: VoiceConfigSchema,
  database: DatabaseConfigSchema,
  personality: Type.Object({
    honorific: Type.String({ default: 'sir' }),
    name: Type.String({ default: 'Jarvis' }),
  }),
})

export type JarvisConfig = Static<typeof JarvisConfigSchema>
```

### packages/core/src/config/loader.ts

```typescript
import { Value } from '@sinclair/typebox/value'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { homedir } from 'os'
import { JarvisConfigSchema, type JarvisConfig } from './schema.js'

const CONFIG_DIR = join(homedir(), '.jarvis')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

export class ConfigValidationError extends Error {
  constructor(public errors: Array<{ path: string; message: string }>) {
    super(`Config validation failed:\n${errors.map(e => `  ${e.path}: ${e.message}`).join('\n')}`)
    this.name = 'ConfigValidationError'
  }
}

export async function loadConfig(): Promise<JarvisConfig> {
  try {
    const content = await readFile(CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    return validateConfig(parsed)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      // Return defaults if no config file exists
      return Value.Default(JarvisConfigSchema, {}) as JarvisConfig
    }
    throw e
  }
}

export function validateConfig(config: unknown): JarvisConfig {
  const errors = [...Value.Errors(JarvisConfigSchema, config)]
  if (errors.length > 0) {
    throw new ConfigValidationError(
      errors.map(e => ({ path: e.path, message: e.message }))
    )
  }
  return Value.Default(JarvisConfigSchema, config) as JarvisConfig
}

export async function saveConfig(config: JarvisConfig): Promise<void> {
  await mkdir(dirname(CONFIG_FILE), { recursive: true })
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
}
```

### apps/cli/src/commands/doctor.ts

```typescript
import { loadConfig } from '@jarvis/core/config'
import { checkOllama, checkModel } from './checks/ollama.js'
import { checkDatabase, checkVectorStore } from './checks/database.js'
import { checkVoice } from './checks/voice.js'

interface CheckResult {
  name: string
  status: 'ok' | 'warn' | 'error'
  message?: string
  fix?: string
}

export async function doctor(): Promise<void> {
  console.log('🔍 Jarvis Doctor\n')
  
  const results: CheckResult[] = []
  
  // Config
  try {
    await loadConfig()
    results.push({ name: 'Config', status: 'ok' })
  } catch (e) {
    results.push({
      name: 'Config',
      status: 'error',
      message: (e as Error).message,
      fix: 'Run: jarvis setup',
    })
  }
  
  // Ollama
  try {
    await checkOllama()
    results.push({ name: 'Ollama', status: 'ok' })
  } catch (e) {
    results.push({
      name: 'Ollama',
      status: 'error',
      message: 'Ollama not running',
      fix: 'Run: ollama serve',
    })
  }
  
  // Model
  try {
    await checkModel('qwen2.5:7b')
    results.push({ name: 'LLM Model', status: 'ok' })
  } catch (e) {
    results.push({
      name: 'LLM Model',
      status: 'error',
      message: 'Model not found',
      fix: 'Run: ollama pull qwen2.5:7b',
    })
  }
  
  // Database
  try {
    await checkDatabase()
    results.push({ name: 'Database', status: 'ok' })
  } catch (e) {
    results.push({
      name: 'Database',
      status: 'error',
      message: (e as Error).message,
      fix: 'Run: jarvis setup',
    })
  }
  
  // Vector Store
  try {
    await checkVectorStore()
    results.push({ name: 'Vector Store', status: 'ok' })
  } catch (e) {
    results.push({
      name: 'Vector Store',
      status: 'error',
      message: (e as Error).message,
    })
  }
  
  // Voice (optional)
  try {
    await checkVoice()
    results.push({ name: 'Voice', status: 'ok' })
  } catch (e) {
    results.push({
      name: 'Voice',
      status: 'warn',
      message: 'Voice not configured',
      fix: 'Voice is optional. Configure in ~/.jarvis/config.json',
    })
  }
  
  // Print results
  for (const result of results) {
    const icon = result.status === 'ok' ? '✓' : result.status === 'warn' ? '⚠' : '✗'
    const color = result.status === 'ok' ? '\x1b[32m' : result.status === 'warn' ? '\x1b[33m' : '\x1b[31m'
    console.log(`${color}${icon}\x1b[0m ${result.name}`)
    if (result.message) {
      console.log(`    ${result.message}`)
    }
    if (result.fix) {
      console.log(`    Fix: ${result.fix}`)
    }
  }
  
  const hasErrors = results.some(r => r.status === 'error')
  if (hasErrors) {
    process.exit(1)
  }
}
```

### scripts/check-loc.ts

```typescript
import { glob } from 'glob'
import { readFile } from 'fs/promises'
import { parseArgs } from 'util'

const { values } = parseArgs({
  options: {
    max: { type: 'string', default: '400' },
    exclude: { type: 'string', multiple: true, default: [] },
  },
})

const MAX_LOC = parseInt(values.max!, 10)
const ALWAYS_EXCLUDE = [
  'node_modules/**',
  'dist/**',
  '**/generated/**',
  '**/*.d.ts',
]

async function main() {
  const files = await glob('**/*.ts', {
    ignore: [...ALWAYS_EXCLUDE, ...(values.exclude || [])],
  })
  
  const violations: Array<{ file: string; lines: number }> = []
  
  for (const file of files) {
    const content = await readFile(file, 'utf-8')
    const lines = content.split('\n').length
    if (lines > MAX_LOC) {
      violations.push({ file, lines })
    }
  }
  
  if (violations.length > 0) {
    console.error(`\x1b[31mFiles exceeding ${MAX_LOC} lines:\x1b[0m\n`)
    for (const { file, lines } of violations.sort((a, b) => b.lines - a.lines)) {
      console.error(`  ${file}: ${lines} lines`)
    }
    console.error(`\nRefactor these files to improve maintainability.`)
    process.exit(1)
  }
  
  console.log(`\x1b[32m✓\x1b[0m All ${files.length} files under ${MAX_LOC} lines`)
}

main().catch(console.error)
```

### docs/AGENTS.md

```markdown
# AGENTS.md — Multi-Agent Development Rules

> Rules for AI-assisted development when multiple agents may work in parallel.

---

## File Ownership

- Focus on your assigned task
- Don't modify files outside your task scope
- If you see unrecognized changes, continue; don't investigate

## Conflict Resolution

- If staged/unstaged diffs are formatting-only, auto-resolve without asking
- Only ask when changes are semantic (logic/data/behavior)
- When in doubt, commit your changes and note "other edits present"

## File Size

- **Hard limit**: 400 lines per file
- Split when a file exceeds this limit
- Prefer smaller files (~200-300 lines) for new code

## Commit Messages

Follow conventional commits:
- `feat(brain): add multi-turn conversation support`
- `fix(voice): correct wake word sensitivity mapping`
- `refactor(domains): split finance.ts into modules`
- `docs: update API reference`
- `test: add entity resolution tests`

## Testing Requirements

- New features require tests
- Bug fixes require regression tests
- Minimum 70% coverage on modified files

## What NOT To Do

- Don't add dependencies without explicit approval
- Don't modify config schemas without updating validation
- Don't use `any` type without justification comment
- Don't commit console.log statements
- Don't modify migrations after they've been applied
```

---

## vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
      exclude: [
        '**/node_modules/**',
        '**/*.d.ts',
        '**/types/**',
        '**/mocks/**',
        'apps/desktop/src/**',  // UI components tested separately
        'apps/desktop/src-tauri/**',  // Rust
      ],
    },
  },
})
```

---

## Migration from Jarvis v1

If restarting from your current codebase:

1. **Keep**: 
   - Domain schemas and business logic
   - Brain architecture (single-pass)
   - Voice state machine design
   - Self-evolution system design

2. **Refactor**:
   - Split into monorepo packages
   - Add TypeBox validation
   - Add CLI with doctor/setup commands
   - Enforce file size limits

3. **Discard**:
   - Any code that duplicates types between packages
   - Inline validation (replace with TypeBox)
   - Direct database access (go through domain services)

---

## Getting Started

```bash
# Clone and install
git clone https://github.com/yourusername/jarvis-v2
cd jarvis-v2
pnpm install

# First-time setup
pnpm setup

# Health check
pnpm doctor

# Development
pnpm dev

# Run tests
pnpm test
pnpm test:coverage
```
