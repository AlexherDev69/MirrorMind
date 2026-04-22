<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/features/device-info/

## Purpose

Device information tools: `list_devices` (connected Android phones), `get_info` (detailed phone specs like model, Android version, screen size).

## For AI Agents

### Working In This Directory

- **list_devices**: Returns array of connected devices with serial, status, and model name
- **get_info**: Returns detailed phone info (brand, model, Android version, screen resolution, screen size in inches)
- **Error handling**: Handle adb errors (device offline, not found, etc.)

## Dependencies

### External
- @modelcontextprotocol/sdk, Zod

### Uses
- Tauri bridge HTTP client

<!-- MANUAL: Add manual notes below this line -->
