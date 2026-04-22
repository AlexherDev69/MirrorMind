<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/core/hooks/

## Purpose

Custom React hooks providing reusable logic across features. Includes device polling (useDevicePolling), stream event listeners (useStreamEvents), and other hooks.

## For AI Agents

### Working In This Directory

- **Naming convention**: All hooks use `use<Name>` prefix
- **Return destructured state and actions** — e.g., `{ devices, status, connect, ...actions }`
- **Use Zustand internally if needed** — hooks can access stores, but encapsulate that detail
- **No component logic in hooks** — hooks should be domain-focused (device polling, event listening, etc.)
- **Max 100 lines per hook** — if larger, split into smaller composable hooks
- **Document side effects** — explain what the hook does and when cleanup occurs

## Dependencies

### External
- React 19, Tauri 2.x

### Used By
- All features and components

<!-- MANUAL: Add manual notes below this line -->
