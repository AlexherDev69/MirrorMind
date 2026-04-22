<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/features/macros/

## Purpose

Macro automation tools: `list_macros` (recorded action sequences), `replay_macro` (play back named macro). Integrates with action-recorder feature in Tauri app.

## For AI Agents

### Working In This Directory

- **list_macros**: Returns array of macro names and descriptions
- **replay_macro**: Takes macro name; executes recorded actions with original timing
- **Action preservation**: Macros preserve timing between actions (delays, etc.)
- **Error handling**: Handle missing macro names, timeout during replay

## Dependencies

### External
- @modelcontextprotocol/sdk, Zod

### Uses
- Tauri bridge HTTP client

<!-- MANUAL: Add manual notes below this line -->
