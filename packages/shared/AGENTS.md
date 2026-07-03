<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/shared/

## Purpose

Shared TypeScript package containing types, constants, and interfaces used by both the Tauri app frontend and MirrorMind MCP server. Defines API contracts, device info types, and configuration constants.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Package definition; exports `@mirror-mind/shared` |
| `src/index.ts` | Re-exports all types and constants |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/types/` | TypeScript interfaces (DeviceInfo, API requests/responses) (see `src/types/AGENTS.md`) |
| `src/constants/` | Exported constants (API endpoints, defaults, error codes) (see `src/constants/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **This is a library package** — changes here affect both app and mcp-server
- **No external dependencies beyond pnpm/TypeScript** — keep imports minimal
- **Export via `src/index.ts`** — any new types or constants must be re-exported
- **Build command**: `pnpm --filter shared build` (or from root: `pnpm build:shared`)
- **TypeScript strict mode enabled** — `any` forbidden, all exports fully typed
- **No side effects** — this package must be pure types/constants, no runtime logic

## Dependencies

### External
- TypeScript (dev only)
- Zod (for runtime type validation schemas)

### Used By
- `packages/app/` (React frontend imports types and constants)
- `packages/mcp-server/` (Node.js MCP server imports types and constants)

<!-- MANUAL: Add manual notes below this line -->
