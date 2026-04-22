<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/

## Purpose

TypeScript source code for MirrorMind MCP server. Initializes MCP server, registers tool endpoints, bridges HTTP communication with Tauri app, and provides logging/utilities.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Entry point; initializes MCP server, parses args, registers all tools, runs stdio transport |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `core/` | Shared utilities (logger, UI tree parser) (see `core/AGENTS.md`) |
| `features/` | Tool implementations (screen-capture, device-control, device-info, ocr, navigation, macros) (see `features/AGENTS.md`) |
| `setup/` | MCP setup and project configuration (see `setup/AGENTS.md`) |
| `tauri-bridge/` | HTTP client for Tauri internal API (see `tauri-bridge/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Tool naming**: Follow MCP spec for tool names (snake_case, descriptive)
- **Tool implementation**: Each tool is a registered endpoint that receives input parameters and returns output
- **Error handling**: Tool handlers catch errors and return structured error messages
- **Input validation**: Use Zod to validate all tool parameters before processing
- **Logging**: Use `createLogger()` for structured logging with tags
- **Async/await**: All I/O is async; use promises naturally

## Dependencies

### External
- Node.js 20+, TypeScript, @modelcontextprotocol/sdk, Zod

### Provides
- MCP tools to Claude Code via stdio

<!-- MANUAL: Add manual notes below this line -->
