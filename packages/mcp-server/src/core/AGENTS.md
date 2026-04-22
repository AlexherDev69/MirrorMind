<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/core/

## Purpose

Shared utilities for the MCP server. Includes a scoped logger and UI tree parser (for accessibility tree parsing).

## Key Files

| File | Description |
|------|-------------|
| `logger.ts` | Scoped logger utility; creates loggers with fixed tags |
| `ui-tree-parser.ts` | Parses accessibility tree from phone; used by navigation tools |
| `ui-tree-parser.test.ts` | Tests for UI tree parser |

## For AI Agents

### Working In This Directory

- **Logger**: Use `createLogger(tag)` to create loggers; logs to stderr at various levels (debug, info, warn, error)
- **UI tree**: Parser converts phone accessibility tree JSON into structured elements for querying
- **Max 200 lines per file** — utilities should be focused and reusable

## Dependencies

### External
- Node.js, TypeScript, Zod (for validation)

### Used By
- All features in `src/features/`

<!-- MANUAL: Add manual notes below this line -->
