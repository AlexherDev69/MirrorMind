<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src-tauri/src/

## Purpose

Rust source code. Integrates Tauri framework, registers commands, emits events, runs internal HTTP API server, and orchestrates ADB/scrcpy communication with Android phone.

## Key Files

| File | Description |
|------|-------------|
| `main.rs` | Entry point; starts the Tauri app |
| `lib.rs` | Tauri builder, command registration, module setup |
| `mcp_config.rs` | MCP token and project configuration persistence |
| `tray.rs` | System tray integration |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `commands/` | Tauri commands: adb, scrcpy, logcat, macros, settings, window (see `commands/AGENTS.md`) |
| `internal_api/` | HTTP server for MCP bridge: auth, handlers, routes (see `internal_api/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Tauri setup**: `lib.rs` invokes `tauri::Builder::default()` to configure window, permissions, and commands
- **Module organization**: One module per concern (commands, internal_api, etc.)
- **Error propagation**: Tauri commands return `Result<T, String>` for error serialization to frontend
- **Event emission**: Use `app.emit("event-name", payload)` to send data to frontend listeners
- **Graceful shutdown**: Internal API server uses `tokio::sync::watch` channel for clean shutdown on app exit
- **Logging**: Use standard Rust `println!`/`eprintln!` (Tauri captures in console); no structured logger in current setup

## Dependencies

### External
- Tauri 2.x, tokio, serde, reqwest, regex, chrono

### Provides
- Tauri commands to frontend (via IPC)
- HTTP API to MCP server (localhost:17395)
- Device and stream events to frontend

<!-- MANUAL: Add manual notes below this line -->
