<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/shared/src/

## Purpose

Source directory for shared TypeScript exports. Contains type definitions and constant definitions re-exported via `index.ts`.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Entry point; re-exports all types and constants |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `types/` | TypeScript type definitions and interfaces (see `types/AGENTS.md`) |
| `constants/` | Configuration constants and API defaults (see `constants/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **All public exports must go through `index.ts`** — consumers of `@mirror-mind/shared` rely on re-exports
- **Add new types to `types/` subdirectory** — use descriptive filenames and export via `index.ts`
- **Add new constants to `constants/` subdirectory** — use UPPERCASE naming
- **Run `pnpm build:shared` after changes** — packages must be rebuilt for changes to be visible

<!-- MANUAL: Add manual notes below this line -->
