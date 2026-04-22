<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# PhoneStream: Root

## Purpose

PhoneStream is a monorepo (pnpm workspaces) containing three integrated packages: a Tauri desktop application with React frontend for real-time Android phone screen streaming, a Node.js MCP server ("MirrorMind") for Claude Code integration, and shared TypeScript types/constants. The desktop app detects Android phones via USB, streams H.264 video via scrcpy protocol, and exposes device control to Claude Code through HTTP endpoints.

## Key Files

| File | Description |
|------|-------------|
| `pnpm-workspace.yaml` | Workspace configuration linking three packages |
| `tsconfig.base.json` | Root TypeScript configuration shared by all packages |
| `package.json` | Root scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck` |
| `CLAUDE.md` | Project conventions, architecture, security rules, tech stack |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `packages/app/` | Tauri desktop app (React + Rust) (see `packages/app/AGENTS.md`) |
| `packages/mcp-server/` | MirrorMind MCP server (Node.js/TS) (see `packages/mcp-server/AGENTS.md`) |
| `packages/shared/` | Shared types and constants (see `packages/shared/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Never use `npm` or `yarn`** — always use `pnpm` (workspaces configured for pnpm only)
- **Always read CLAUDE.md first** — contains architecture, security rules, code conventions, and MirrorMind data flows
- **Workspace commands apply everywhere**: `pnpm lint`, `pnpm typecheck`, `pnpm build` run on all packages
- **Each package has its own lifecycle** — `dev` starts the full Tauri app (frontend + Rust backend); `build` creates the exe
- **Check git status** — the repo uses conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, etc.) and enforces English commit messages

### Common Patterns

- **Architecture**: Clean architecture (domain/data/presentation) applied to all features
- **State**: Zustand for frontend state; no Redux or Context API
- **Validation**: Zod used consistently across all packages
- **Logging**: Custom scoped logger (`createLogger(tag)`) in both frontend and backend (no `console.log` in production)
- **TypeScript strict**: `any` forbidden, all parameters and returns typed, max 1000 lines/file
- **Feature structure**: Each feature in `src/features/<name>/` follows domain/data/presentation pattern

## Dependencies

### Internal
- `packages/app/` → imports `packages/shared/` types and constants
- `packages/mcp-server/` → imports `packages/shared/` types and constants
- Tauri frontend ↔ Rust backend via Tauri commands and events

### External
- **Frontend**: React 19, TypeScript 5.8, Vite 7, Tailwind 4, Zustand 5, Zod
- **Backend**: Tauri 2.x, @modelcontextprotocol/sdk
- **Rust**: tokio (async runtime), adb via shell commands, no direct USB access
- **Node.js MCP**: TypeScript, Zod, HTTP client for Tauri bridge

<!-- MANUAL: Add manual notes below this line -->
