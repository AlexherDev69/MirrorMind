<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src-tauri/src/internal_api/handlers/

## Purpose

HTTP request handlers for MCP server routes. Each handler validates input, optionally authenticates, and delegates to Tauri commands or internal business logic. Handlers are registered in `server.rs`.

## For AI Agents

### Working In This Directory

- **Handler signature**: `async fn handler(State, req) -> Result<Json<T>, ApiError>`
- **Input validation**: All JSON request bodies validated with Zod or custom validators
- **Error handling**: Return appropriate HTTP status codes (400, 401, 403, 500)
- **Tauri integration**: Handlers invoke Tauri commands via `app.emit()` or direct calls
- **Response serialization**: Use serde for JSON response payloads
- **Logging**: Log all requests at INFO level; errors at ERROR level

## Dependencies

### External
- axum, tokio, serde, zod-like validation

### Calls Into
- Tauri commands and internal business logic

<!-- MANUAL: Add manual notes below this line -->
