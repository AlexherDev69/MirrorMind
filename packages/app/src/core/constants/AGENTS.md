<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/core/constants/

## Purpose

Frontend-specific constants that are not API-level (those go in `packages/shared/constants/`). Includes UI timeouts, retry counts, device polling intervals, and other application behavior constants.

## For AI Agents

### Working In This Directory

- **Use UPPERCASE naming** — `DEVICE_POLL_INTERVAL_MS`, `STREAM_RECONNECT_RETRIES`, etc.
- **Document magic numbers** — explain reasoning in comments (e.g., why 500ms vs 1s)
- **No hardcoded strings in components** — extract to constants here
- **Separate API constants from UI constants** — API-level constants go in `packages/shared/constants/`

## Dependencies

### Used By
- All features and pages in `src/`

<!-- MANUAL: Add manual notes below this line -->
