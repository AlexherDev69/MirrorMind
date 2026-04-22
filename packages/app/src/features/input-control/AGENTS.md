<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/features/input-control/

## Purpose

Sends user input (touch, keyboard, scroll) to the connected Android phone. Frontend captures mouse/keyboard events, translates them to phone screen coordinates, and sends to Rust backend which forwards to adb. Also provides on-screen touch simulation indicator.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `data/` | Input translation and adb command invocation |
| `presentation/` | Not used (input is canvas event-driven) |

## For AI Agents

### Working In This Directory

- **Coordinate translation**: Desktop canvas coords → phone native resolution coords (aspect ratio dependent)
- **Input methods**: Tap (single touch), swipe (drag), keyboard passthrough, scroll (via `adb input scroll`)
- **scrcpy native coords preferred**: When available, use scrcpy control socket coordinates; fallback to adb input
- **No validation in frontend** — validation handled by Rust backend before executing adb commands
- **Rate limiting**: Input events may be rate-limited to prevent overwhelming the phone

## Dependencies

### Internal
- `packages/shared/` — types

### External
- React 19, Tauri 2.x

<!-- MANUAL: Add manual notes below this line -->
