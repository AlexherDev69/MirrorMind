<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/

## Purpose

MirrorMind: a Model Context Protocol (MCP) server exposing phone screen and control tools to Claude Code. Runs as a standalone Node.js process, communicates with Tauri app internal API via HTTP, and registers 15+ tools with the MCP server for screen capture, device control, info queries, OCR, navigation, and macros.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | MCP server package; exports via tsup; entry point `dist/index.js` |
| `tsconfig.json` | TypeScript config for Node.js server |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source code (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Build**: `pnpm --filter mcp-server build` or `pnpm build:mcp` (tsup bundles into `dist/index.js`)
- **Entry point**: `src/index.ts` (executable, starts with `#!/usr/bin/env node`)
- **MCP SDK**: Uses `@modelcontextprotocol/sdk` for server framework and transport
- **Tauri bridge**: HTTP client connects to `localhost:17395` with bearer token auth
- **Tool registration**: Each feature exports `register<Name>Tool()` function called in `index.ts`
- **Error handling**: Tools catch errors and return structured error responses

## Dependencies

### Internal
- `packages/shared/` — types and constants

### External
- Node.js 20+, TypeScript, @modelcontextprotocol/sdk, Zod

### Provides
- MCP tools to Claude Code CLI via stdio protocol

<!-- MANUAL: Add manual notes below this line -->
