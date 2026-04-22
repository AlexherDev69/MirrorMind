<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/core/types/

## Purpose

Frontend-specific TypeScript types not shared with other packages. Includes component prop types, hook return types, and internal UI state interfaces.

## For AI Agents

### Working In This Directory

- **No runtime code** — types only
- **Export via `index.ts` or direct file imports** — no wildcard exports from features
- **Use Zod for validation when receiving user input** — pair TypeScript types with runtime schemas
- **Max 200 lines per file** — split large type files into logical modules

## Dependencies

### External
- TypeScript (types only)

### Used By
- Components and hooks in `src/`

<!-- MANUAL: Add manual notes below this line -->
