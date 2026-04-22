<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/features/settings/

## Purpose

User preferences and application settings. Manages window position/size persistence, always-on-top toggle, MCP server status, and screenshot capture buttons. Syncs settings to Rust backend and vice versa.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `domain/` | Settings types (window geometry, preferences) |
| `data/` | Settings persistence service |
| `presentation/` | SettingsToggle, CaptureButtons components; settings.store Zustand state |

## For AI Agents

### Working In This Directory

- **Window geometry**: Persists window position (x, y) and size (width, height) to Rust backend
- **Always-on-top**: Toggle persisted in settings; affects Tauri window behavior
- **MCP token storage**: Token persisted at `%APPDATA%/com.phonestream.app/mcp_auth_token`
- **Settings sync**: Changes in settings.store trigger Rust backend updates via Tauri commands
- **Defaults**: Sensible defaults applied if settings file missing (e.g., centered window, 1920x1080)

## Dependencies

### Internal
- `packages/shared/` — settings constants

### External
- React 19, Zustand 5, Tauri 2.x

<!-- MANUAL: Add manual notes below this line -->
