<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/shared/src/types/

## Purpose

TypeScript type definitions and interfaces used across the entire PhoneStream system. Includes device information types, API request/response schemas, and configuration types.

## For AI Agents

### Working In This Directory

- **No runtime code** — types only; no implementations, functions, or side effects
- **Use Zod schemas where runtime validation is needed** — pair TypeScript types with `z.object()`
- **Export all types via parent `index.ts`** — this directory's exports must be re-exported upward
- **Max 1000 lines per file** — split large type files into logical modules
- **Descriptive names** — type names should clearly indicate their purpose (e.g., `DeviceInfo`, `TauriStreamStartRequest`)

## Dependencies

### External
- TypeScript (types only)
- Zod (for runtime validation schemas)

<!-- MANUAL: Add manual notes below this line -->
