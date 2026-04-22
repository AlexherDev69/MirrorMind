<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/

## Purpose

React 19 frontend source code. Contains the UI for device detection, video streaming, input control, onboarding wizard, settings, and integration with MirrorMind MCP server. Also hosts the internal HTTP client that bridges to the Rust backend's internal API.

## Key Files

| File | Description |
|------|-------------|
| `App.tsx` | Root component; polls device status, auto-starts stream, manages app-level error handling and layout |
| `main.tsx` | Entry point; renders App into DOM |
| `index.css` | Tailwind CSS reset and global styles |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `core/` | Shared constants, types, utils, hooks, base components (see `core/AGENTS.md`) |
| `features/` | Feature modules (device-detection, streaming, input-control, etc.) (see `features/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **TypeScript strict**: All files must be `.tsx` or `.ts` (not `.jsx`); `any` forbidden; all parameters and returns typed
- **No `console.log` in production** — use `createLogger(tag)` from `core/logger.ts`
- **Zustand stores only** — no Redux, Context API, or `useState` for global state
- **Max 1000 lines per file** — split large components into smaller modules
- **Tauri invoke and events**: Import from `@tauri-apps/api/core` (`invoke`, `listen`, `emit`)
- **Run `pnpm dev:frontend` to test frontend in isolation** (Vite dev server on port 5173)

### Common Patterns

- **Feature structure**: Each feature has `domain/`, `data/`, `presentation/` subdirectories
- **Hooks**: Reusable logic in `core/hooks/`; custom hooks follow pattern `use<Name>` and return destructured state + actions
- **Components**: React functional, prefer `const` everywhere, destructure props, extract sub-components
- **Error handling**: User-friendly messages in `App.tsx` via `formatStreamError()`; technical errors logged
- **Event handling**: Tauri events (video-frame, stream-status, stream-error) via `useEffect` + `listen()`

## Dependencies

### Internal
- `packages/shared/` — types, constants

### External
- React 19, TypeScript 5.8
- Tauri 2.x (@tauri-apps/api)
- Zustand 5 (state management)
- Zod (validation)
- Tailwind 4 (styling)

<!-- MANUAL: Add manual notes below this line -->
