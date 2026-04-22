<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/features/

## Purpose

MCP tool implementations grouped by feature. Each feature exports a `register<Name>Tool()` function called in `index.ts`. Tools communicate with phone via Tauri internal API HTTP endpoints.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `screen-capture/` | `phone_screenshot`, `screenshot_grid`, `wait_for_change` tools (see `screen-capture/AGENTS.md`) |
| `device-control/` | `tap`, `swipe`, `type_text`, `press_key`, `batch` tools (see `device-control/AGENTS.md`) |
| `device-info/` | `list_devices`, `get_info` tools (see `device-info/AGENTS.md`) |
| `ocr/` | `find_text`, `wait_for_text` tools (see `ocr/AGENTS.md`) |
| `navigation/` | `current_activity`, `run_app`, `ui_tree`, `deep_link` tools (see `navigation/AGENTS.md`) |
| `macros/` | `list_macros`, `replay_macro` tools (see `macros/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Tool registration**: Each feature exports `register<Name>Tool(server, client)` function
- **Tool validation**: Validate all inputs with Zod before calling Tauri API
- **Error handling**: Catch HTTP errors and return user-friendly messages
- **Async handlers**: All tool handlers are async; return promises naturally
- **Naming convention**: Tool names are snake_case (e.g., `phone_screenshot`, `wait_for_change`)

## Dependencies

### Internal
- `packages/shared/` — types and constants
- `tauri-bridge/` — HTTP client for Tauri API
- `core/` — logger, utilities

### External
- Node.js, TypeScript, @modelcontextprotocol/sdk, Zod

### Provides
- MCP tools to Claude Code

<!-- MANUAL: Add manual notes below this line -->
