<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src-tauri/src/commands/

## Purpose

Tauri commands invoked from React frontend. Each command is async and returns `Result<T, String>`. Commands handle device discovery, stream lifecycle, input control, macro recording, logcat streaming, and settings persistence.

## Key Files

| File | Description |
|------|-------------|
| `adb.rs` | `list_devices`, `check_adb_available` commands |
| `scrcpy.rs` | `start_stream`, `stop_stream`, `push_server` commands; H.264 frame reading and event emission |
| `logcat.rs` | `start_logcat`, `stop_logcat`, `clear_logcat` commands |
| `macros.rs` | `start_recording`, `stop_recording`, `save_macro`, `list_macros`, `replay_macro` commands |
| `settings.rs` | `load_settings`, `save_settings`, `get_mcp_token` commands |
| `window.rs` | `save_window_geometry`, `set_always_on_top` commands |
| `mod.rs` | Module registration |

## For AI Agents

### Working In This Directory

- **Command signature**: `#[tauri::command] async fn name(app: AppHandle, ...) -> Result<T, String>`
- **ADB validation**: Device serials validated (alphanumeric + hyphens only); no arbitrary shell input accepted
- **Async/await**: All I/O is async; use `tokio::spawn` for long-running background tasks
- **Error messages**: String errors sent to frontend; include enough context for user-facing messages
- **Emitting events**: Use `app.emit("event-name", payload)` to send updates to frontend during long operations
- **No blocking I/O**: Never use `std::process::Command::output()` (blocks); use `tokio::process::Command`

## Dependencies

### External
- Tauri 2.x, tokio, serde

### Provides
- Commands to React frontend via Tauri IPC

<!-- MANUAL: Add manual notes below this line -->
