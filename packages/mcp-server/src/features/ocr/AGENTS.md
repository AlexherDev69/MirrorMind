<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/mcp-server/src/features/ocr/

## Purpose

Optical Character Recognition tools: `find_text` (locate text on screen via OCR), `wait_for_text` (poll until specified text appears). Uses device's native OCR or cloud OCR backend.

## For AI Agents

### Working In This Directory

- **find_text**: Takes search string; returns all matching words with screen coordinates (percentages)
- **wait_for_text**: Polls screenshot and OCR until text appears or timeout; returns screenshot on match
- **Case sensitivity**: Searches are case-insensitive by default
- **Performance**: OCR is CPU/network intensive; consider timeout and polling interval

## Dependencies

### External
- @modelcontextprotocol/sdk, Zod

### Uses
- Tauri bridge HTTP client, screen-capture tools

<!-- MANUAL: Add manual notes below this line -->
