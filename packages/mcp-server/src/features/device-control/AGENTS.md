<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/features/device-control/

## Purpose

Device input control tools: `tap`, `swipe`, `type_text`, `press_key`, and `batch`. Converts percentages or absolute coordinates to phone native coords and sends input to adb or scrcpy control socket.

## For AI Agents

### Working In This Directory

- **Coordinates**: Accept as percentages (0-100) or absolute pixels; convert based on phone resolution
- **Tap tool**: Single touch, optional with modifier keys (shift, ctrl, alt)
- **Swipe tool**: Press, move, release over specified duration
- **Type tool**: Keyboard input; supports special keys (Return, Escape, Tab, etc.)
- **Press key tool**: Sends single key presses or key combinations
- **Batch tool**: Executes multiple actions in sequence (tap, type, key, swipe, wait, screenshot)
- **Rate limiting**: May respect rate limits to avoid overwhelming phone

## Dependencies

### External
- @modelcontextprotocol/sdk, Zod

### Uses
- Tauri bridge HTTP client

<!-- MANUAL: Add manual notes below this line -->
