<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/tauri-bridge/

## Purpose

HTTP client bridging MCP server to Tauri app internal API. Handles bearer token authentication, connection retry logic, and request/response serialization.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | TauriBridgeClient class; HTTP methods for each Tauri API endpoint |

## For AI Agents

### Working In This Directory

- **Client class**: `TauriBridgeClient(token, port)` encapsulates HTTP communication
- **Methods**: One method per Tauri API endpoint (e.g., `tap()`, `screenshot()`, etc.)
- **Authentication**: All requests include `Authorization: Bearer <token>` header
- **Error handling**: Catch HTTP errors and provide meaningful messages
- **Retry logic**: Can retry on transient failures (503, connection timeout)
- **Timeout**: Set reasonable timeout for each request type

## Dependencies

### External
- Node.js, fetch API (or axios/got), Zod

### Used By
- All feature tools in `features/`

<!-- MANUAL: Add manual notes below this line -->
