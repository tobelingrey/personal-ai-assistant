# Multi-Agent Development Rules

This document defines rules for multi-agent development on the Jarvis codebase.

## File Limits

- **Maximum LOC**: 400 lines per source file
- **Enforcement**: `pnpm check:loc` runs on CI and must pass
- **Exceptions**: None. Split large files before merging.

## File Ownership

Each agent should work on distinct files to avoid conflicts:

| Area | Files | Owner Pattern |
|------|-------|---------------|
| Core types | `packages/core/src/**` | Single agent per session |
| Server services | `server/src/services/*.ts` | One agent per service file |
| Server routes | `server/src/routes/*.ts` | One agent per route file |
| Frontend components | `src/components/**` | One agent per component |
| Tauri voice | `src-tauri/src/voice/**` | Single agent |
| CLI | `apps/cli/src/**` | Single agent |

## Conflict Resolution

1. **File locks**: First agent to start editing a file owns it for the session
2. **Review conflicts**: If two agents touch the same file, human review required
3. **Test conflicts**: Run full test suite after merging parallel work

## Commit Conventions

```
<type>(<scope>): <description>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Scopes: `core`, `server`, `frontend`, `cli`, `voice`, `build`

Examples:
- `feat(core): add TypeBox config validation`
- `fix(server): handle null entity in resolution`
- `refactor(voice): extract controller to separate file`

## Testing Requirements

- All new code must have tests
- Test files live next to source: `foo.ts` → `__tests__/foo.test.ts`
- Run `pnpm test` before committing
- Coverage must not decrease

## PR Requirements

1. All checks pass (`pnpm check:loc`, `pnpm test`)
2. No merge conflicts
3. Description includes:
   - What changed
   - Why it changed
   - How to test

## Package Dependencies

```
@jarvis/core (no deps on other internal packages)
    ↑
@jarvis/cli (depends on core)
    ↑
jarvis-server (depends on core)
    ↑
jarvis (frontend, depends on core)
```

Core must remain dependency-free from other internal packages to prevent cycles.
