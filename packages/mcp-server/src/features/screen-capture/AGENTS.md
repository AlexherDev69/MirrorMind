<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/features/screen-capture/

## Purpose

Screen capture tools for Claude Code. Provides `phone_screenshot` (full native resolution), `screenshot_grid` (with coordinate overlay for debugging), and `wait_for_change` (polls until screen changes). Uses adb screencap for full-resolution captures (not the stream).

## For AI Agents

### Working In This Directory

- **Screenshot source**: Uses `adb screencap -p` for native resolution (not the H.264 stream)
- **Coordinate system**: Percentages (0-100) for X/Y; converted to absolute coords based on phone resolution
- **Grid overlay**: `screenshot_grid` adds visual 10% increment grid with labels for precision
- **Change detection**: `wait_for_change` polls screenshots and detects pixel differences above threshold
- **Error handling**: Catch HTTP errors and return meaningful messages to Claude Code

## Dependencies

### External
- @modelcontextprotocol/sdk, Zod

### Uses
- Tauri bridge HTTP client

<!-- MANUAL: Add manual notes below this line -->
