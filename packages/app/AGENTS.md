<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/

## Purpose

Tauri 2.x desktop application combining a React 19 frontend (with Vite, Tailwind, Zustand state) and Rust backend (tokio async, adb integration, scrcpy stream handling, internal HTTP API). Detects connected Android phones via USB, streams screen in real-time via H.264 WebCodecs, and exposes device controls to both UI and MirrorMind MCP server.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | App workspace; defines `dev`, `build:frontend`, `tauri dev`, `tauri build` commands |
| `tsconfig.json` | TypeScript config for React frontend |
| `vite.config.ts` | Vite bundler config (React, Tailwind, port 5173) |
| `public/assets/scrcpy-server.jar` | scrcpy v3.1 binary pushed to phone for screen capture |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | React frontend TypeScript/JSX (see `src/AGENTS.md`) |
| `src-tauri/` | Rust backend (see `src-tauri/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Frontend changes**: Edit `src/**/*.tsx` or `src/**/*.ts`; use `pnpm dev:frontend` to test in isolation
- **Rust changes**: Edit `src-tauri/src/**/*.rs`; Rust code must be `async` and return `Result<T, String>`
- **Full dev mode**: `pnpm dev` from root builds MCP server, then launches Tauri (frontend + Rust together)
- **Build output**: `pnpm tauri build` creates installer in `src-tauri/target/release/bundle/`
- **Tauri events**: Rust backend emits `video-frame`, `stream-status`, `stream-error` events; frontend listens via `useEffect` + `window.__TAURI__.event.listen()`
- **Security critical**: The internal HTTP API (`src-tauri/src/internal_api/`) must validate all inputs with Zod and enforce bearer token auth

### Common Patterns

- **Feature structure**: Each feature in `src/features/<name>/` has `domain/` (types), `data/` (services), `presentation/` (components, stores)
- **State management**: Zustand stores in `presentation/stores/` (one store per feature)
- **Rust <-> Frontend bridge**: Tauri `invoke()` calls Rust commands; Rust emits events back
- **ADB operations**: Rust backend only; never call `adb` from frontend JavaScript
- **Stream protocol**: Rust reads H.264 frames from scrcpy server via TCP, forwards to frontend as events; frontend uses WebCodecs VideoDecoder for hardware-accelerated decoding

## Dependencies

### Internal
- `packages/shared/` — imports DeviceInfo types, API constants
- Tauri frontend ↔ Rust backend via commands and events

### External
- **Frontend**: React 19, TypeScript 5.8, Vite 7, Tailwind 4, Zustand 5, Zod
- **Rust**: Tauri 2.x, tokio, serde, reqwest (HTTP client), regex
- **Shared**: scrcpy-server.jar (v3.1) in `public/assets/`

<!-- MANUAL: Add manual notes below this line -->
