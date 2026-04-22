<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/features/action-recorder/

## Purpose

Records user interactions (taps, swipes, keyboard) as macros and replays them. Useful for testing and automation workflows. Integrates with MCP server to expose macro list and replay functionality.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `domain/` | Macro types and action definitions |
| `data/` | Recording service, macro persistence |
| `presentation/` | RecorderIndicator, MacrosLibraryModal components; action-recorder.store Zustand state |

## For AI Agents

### Working In This Directory

- **Recording capture**: Subscribes to user input events (taps, swipes, keyboard); timestamps and records actions
- **Macro persistence**: Macros stored in local settings or Rust backend persistent storage
- **MCP exposure**: Macro list and replay available to Claude Code via MCP tools (`list_macros`, `replay_macro`)
- **Playback timing**: Preserves original timing between actions during replay
- **Named macros**: Users can name macros for easy identification

## Dependencies

### Internal
- `packages/shared/` — types

### External
- React 19, Zustand 5, Tauri 2.x

<!-- MANUAL: Add manual notes below this line -->
