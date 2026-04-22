<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/setup/

## Purpose

MCP server setup and project configuration. Handles token generation, project settings file initialization, and CLI setup wizard.

## For AI Agents

### Working In This Directory

- **Token generation**: Creates cryptographically random 32-byte auth tokens
- **Settings file**: Writes `<project>/.claude/settings.local.json` with MCP token and port
- **CLI wizard**: Guides users through first-time setup (validate Tauri app running, test connection, etc.)
- **Idempotent**: Setup can be re-run safely; doesn't overwrite existing settings

## Dependencies

### External
- Node.js, crypto (token generation), fs (file I/O)

<!-- MANUAL: Add manual notes below this line -->
