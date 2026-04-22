<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/features/navigation/

## Purpose

Phone navigation and app launch tools: `current_activity` (active app/activity), `run_app` (launch app by package name), `ui_tree` (accessibility tree), `deep_link` (open URI or shorthand deep link).

## For AI Agents

### Working In This Directory

- **current_activity**: Returns package name and activity of foreground app
- **run_app**: Takes Android package name (e.g., `com.android.settings`); launches main activity
- **ui_tree**: Returns accessibility tree as JSON with clickable elements, text, roles, bounds
- **deep_link**: Accepts URI (e.g., `twitter://messages`) or shorthand (e.g., `twitter:messages`); opens via `am start`
- **Shorthands**: Pre-configured shortcuts for common apps (Twitter, Instagram, WhatsApp, etc.)

## Dependencies

### External
- @modelcontextprotocol/sdk, Zod

### Uses
- Tauri bridge HTTP client, ui-tree-parser utility

<!-- MANUAL: Add manual notes below this line -->
