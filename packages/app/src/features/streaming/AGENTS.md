<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/features/streaming/

## Purpose

Manages real-time Android screen streaming. Rust backend reads H.264 frames from scrcpy server (running on phone), emits `video-frame` events. Frontend listens to events, decodes H.264 using WebCodecs API (hardware-accelerated), and renders to canvas. Handles stream lifecycle (start, stop, errors, reconnection).

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `data/` | Stream lifecycle service; scrcpy protocol parsing |
| `presentation/` | VideoCanvas component; stream.store Zustand state |

## For AI Agents

### Working In This Directory

- **scrcpy wire protocol**: Frames preceded by [8-byte PTS timestamp + 4-byte size] then H.264 NAL units
- **WebCodecs decoder**: Hardware-accelerated H.264 → RGB conversion; browser must support VideoDecoder
- **Canvas rendering**: Frame data rendered to HTML canvas element via `VideoFrame` and `canvas.getContext("2d")`
- **Stream events**: Rust emits `video-frame` (chunks), `stream-status` (connecting/connected/error), `stream-error` (disconnection)
- **Port forwarding**: Rust backend uses `adb forward tcp:27183 localabstract:scrcpy` for scrcpy server TCP connection
- **Graceful degradation**: If WebCodecs unavailable, fallback behavior (log error, notify user)

## Dependencies

### Internal
- `packages/shared/` — types

### External
- React 19, Zustand 5, Tauri 2.x, WebCodecs API (browser native)

<!-- MANUAL: Add manual notes below this line -->
