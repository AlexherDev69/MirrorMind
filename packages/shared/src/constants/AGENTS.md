<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/shared/src/constants/

## Purpose

Configuration constants and defaults used by both the Tauri app and MCP server. Includes API endpoint paths, default ports, error codes, and timeout values.

## For AI Agents

### Working In This Directory

- **Use UPPERCASE naming for constants** — `DEFAULT_API_PORT`, `MCP_SERVER_NAME`, etc.
- **Export all constants via parent `index.ts`** — no direct imports from this directory
- **No functions or runtime logic** — constants only
- **Document magic numbers** — always explain why a value is what it is (e.g., `RATE_LIMIT_100_REQ_S`)
- **Single source of truth** — if a value is used in multiple packages, define it here

## Dependencies

### External
- TypeScript (types only)

### Imported By
- `packages/app/` frontend (styling constants, API endpoints)
- `packages/mcp-server/` (API endpoints, ports, defaults)

<!-- MANUAL: Add manual notes below this line -->
