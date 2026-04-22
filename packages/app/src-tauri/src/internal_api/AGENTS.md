<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src-tauri/src/internal_api/

## Purpose

HTTP server (axum-based) exposing device controls and screen capture to the MirrorMind MCP server via `localhost:17395`. Handles authentication (bearer token), input validation (Zod schemas), and delegates to Tauri commands.

## Key Files

| File | Description |
|------|-------------|
| `server.rs` | HTTP server startup, route registration, graceful shutdown |
| `auth.rs` | Bearer token authentication, token generation and validation |
| `screenshot.rs` | Stub; delegates to handler |
| `mod.rs` | Module registration |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `handlers/` | HTTP route handlers (tap, swipe, type_text, screenshot, etc.) (see `handlers/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Security critical**: Validate all inputs with Zod; enforce bearer token on every request
- **Binding**: Server must bind on `127.0.0.1:17395` (localhost only, never `0.0.0.0`)
- **CORS**: Strict CORS allowing Tauri origin only; reject other origins
- **Host header**: Validate Host header to prevent DNS rebinding attacks
- **Rate limiting**: Enforce 100 req/s per security rules
- **Graceful shutdown**: Use `tokio::sync::watch` channel for clean shutdown on app exit
- **Request/response**: JSON over HTTP; use serde for serialization

## Dependencies

### External
- axum (HTTP framework), tokio, serde, zod-like validation

### Provides
- HTTP API to MirrorMind MCP server (localhost:17395)
- Device control endpoints (tap, swipe, type, screenshot, etc.)

<!-- MANUAL: Add manual notes below this line -->
