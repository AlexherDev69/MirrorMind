<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/features/device-detection/

## Purpose

Handles USB Android device detection and lifecycle management. Polls Rust backend for connected devices via `adb devices`, tracks authorization status, and triggers stream auto-start when authorized device is detected. Also manages device disconnection and reconnection.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `data/` | Device polling service; Tauri command invocation |
| `presentation/` | DeviceStatus component; device.store Zustand state |

## For AI Agents

### Working In This Directory

- **Polling strategy**: Frontend polls Rust backend at regular intervals (check `useDevicePolling` in `core/hooks/`)
- **Device serial validation**: Only alphanumeric + hyphens allowed (ADB safety rule)
- **Authorization tracking**: Distinguishes between "detected" and "authorized" devices
- **Auto-stream**: When authorized device detected, stream auto-starts (no manual button needed)
- **Reconnection**: On unplug/replug, stream automatically reconnects if same device

## Dependencies

### Internal
- `packages/shared/` — DeviceInfo types

### External
- React 19, Zustand 5, Tauri 2.x

<!-- MANUAL: Add manual notes below this line -->
