<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src-tauri/

## Purpose

Rust backend for the Tauri 2.x desktop application. Handles ADB device communication, scrcpy H.264 streaming, HTTP server for MCP bridge, macros, logcat streaming, and all communication with Android phone. Runs in separate process; communicates with frontend via Tauri commands/events.

## Key Files

| File | Description |
|------|-------------|
| `Cargo.toml` | Rust dependencies and metadata |
| `tauri.conf.json` | Tauri window, permissions, app metadata |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | Rust source code (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Async runtime**: tokio is the async runtime; all I/O is `async`
- **Tauri commands**: Functions in `commands/` module invoked from frontend; must be `async` and return `Result<T, String>`
- **Tauri events**: Rust emits events to frontend (video-frame, stream-status, etc.) via `app.emit()`
- **ADB shell commands**: All ADB operations invoked via Rust `Command`; never construct dynamic shell commands from user input
- **Build**: `cargo build --release` or `pnpm tauri build` from repo root
- **Testing**: Use `#[cfg(test)]` for unit tests; run with `cargo test`

## Dependencies

### External
- Tauri 2.x (app framework, window, event system)
- tokio (async runtime)
- serde (serialization for Tauri IPC)
- reqwest (HTTP client for MCP server)
- regex, chrono (utilities)

### Produced For
- React frontend via Tauri commands and events

<!-- MANUAL: Add manual notes below this line -->
