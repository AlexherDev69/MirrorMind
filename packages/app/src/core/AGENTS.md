<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/core/

## Purpose

Centralized location for shared utilities, types, constants, custom hooks, and base components used across all features. Includes logging utility, device polling hook, stream event listener, and reusable UI components.

## Key Files

| File | Description |
|------|-------------|
| `logger.ts` | Scoped logger utility; creates loggers with fixed tags; suppresses debug/info in production |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `components/` | Reusable UI components (Icon, Button, Toast, etc.) (see `components/AGENTS.md`) |
| `constants/` | Frontend constants (not API-level; feature-specific) (see `constants/AGENTS.md`) |
| `hooks/` | Custom React hooks (useDevicePolling, useStreamEvents, etc.) (see `hooks/AGENTS.md`) |
| `types/` | Frontend-only type definitions (see `types/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Shared utilities only** — code used by multiple features goes here; single-use code stays in feature
- **No feature-specific logic** — core directory must be feature-agnostic
- **Export via wildcard or named exports** — consumers import from `core/` paths directly (e.g., `from "./core/hooks"`)
- **Max 200 lines per file** — this directory handles foundational code; large files indicate misplaced logic
- **Test custom hooks thoroughly** — hooks are tested via components that use them

## Dependencies

### External
- React 19, Tauri 2.x, Zustand 5

### Used By
- All features in `src/features/`
- App root (`App.tsx`)

<!-- MANUAL: Add manual notes below this line -->
