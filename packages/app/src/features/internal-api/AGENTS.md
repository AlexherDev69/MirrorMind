<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/features/internal-api/

## Purpose

Frontend integration with MirrorMind MCP server. Manages HTTP client connection to the Tauri app's internal API (`localhost:17395`), displays MCP status indicator, and provides functions for MCP bridge interaction.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `presentation/` | McpStatus component; UI status indicator when MCP server is active |

## For AI Agents

### Working In This Directory

- **Bearer token auth**: All requests include `Authorization: Bearer <token>` header
- **API endpoint**: `http://127.0.0.1:17395` (localhost only, not 0.0.0.0)
- **Host header validation**: Rust backend validates Host header to prevent DNS rebinding
- **CORS strict**: Tauri origin only; other origins rejected
- **Rate limiting**: 100 req/s per security rules
- **Input validation**: All request bodies validated with Zod before sending
- **Error handling**: HTTP errors (401, 403, 5xx) trigger user-facing notifications

## Dependencies

### Internal
- `packages/shared/` — API constants, types

### External
- React 19, Tauri 2.x, Zod

<!-- MANUAL: Add manual notes below this line -->
