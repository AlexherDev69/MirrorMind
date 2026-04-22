<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/features/logcat/

## Purpose

Displays Android logcat output from connected device. Rust backend streams logcat via `adb logcat`, frontend displays real-time logs in collapsible panel. Useful for debugging app behavior on phone.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `domain/` | Logcat entry types |
| `data/` | Logcat service (start, stop, clear) |
| `presentation/` | LogcatPanel component; logcat.store Zustand state |

## For AI Agents

### Working In This Directory

- **Streaming source**: Rust backend runs `adb logcat` and streams lines to frontend via Tauri events
- **Log filtering**: Can filter by log level (error, warn, info, debug)
- **Panel toggle**: User can collapse/expand logcat panel without stopping stream
- **Clear logs**: User can clear displayed logs (does not stop stream)
- **Performance**: Large log buffers may impact performance; consider limiting buffer size

## Dependencies

### Internal
- `packages/shared/` — types

### External
- React 19, Zustand 5, Tauri 2.x

<!-- MANUAL: Add manual notes below this line -->
