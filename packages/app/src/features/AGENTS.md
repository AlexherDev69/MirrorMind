<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/features/

## Purpose

Feature modules implementing the core functionality of the PhoneStream app. Each feature is self-contained and follows clean architecture (domain/data/presentation pattern). Features handle device detection, video streaming, input control, MCP integration, onboarding, settings, and logcat streaming.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `device-detection/` | USB device polling, phone connection lifecycle (see `device-detection/AGENTS.md`) |
| `streaming/` | scrcpy H.264 stream, WebCodecs decoder, canvas rendering (see `streaming/AGENTS.md`) |
| `input-control/` | Touch, keyboard, scroll input to phone (see `input-control/AGENTS.md`) |
| `internal-api/` | MirrorMind HTTP client and UI status component (see `internal-api/AGENTS.md`) |
| `onboarding/` | Setup wizard with per-brand USB debug instructions (see `onboarding/AGENTS.md`) |
| `settings/` | User preferences (window position, always-on-top, etc.) (see `settings/AGENTS.md`) |
| `logcat/` | Logcat stream reader from Rust backend (see `logcat/AGENTS.md`) |
| `action-recorder/` | Macro recording and replay (see `action-recorder/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Feature structure pattern**: Each feature has `domain/` (types), `data/` (services), `presentation/` (components + stores)
- **Domain layer**: Only types and interfaces; no implementations or dependencies on other layers
- **Data layer**: Business logic, API calls, services; depends on domain but not presentation
- **Presentation layer**: React components and Zustand stores; depends on data layer
- **Zustand stores**: Each feature has a store in `presentation/stores/`; named `<feature>.store.ts`
- **No circular imports**: Domain → Data → Presentation (one direction only)
- **Isolation**: Features rarely import from each other; cross-feature communication via App.tsx or shared state

### Common Patterns

- **Service functions**: Data layer exports pure functions (e.g., `startStream()`, `pollDevices()`)
- **Hook wrappers**: Features may export custom hooks that use their Zustand stores
- **Component naming**: Descriptive names (DeviceStatus, VideoCanvas, OnboardingWizard, not Card1)
- **Props passing**: Components receive data from stores via hooks; no prop drilling
- **Error handling**: Features handle their own errors; communicate status to App.tsx via stores or callbacks

## Dependencies

### Internal
- `packages/shared/` — API types and constants

### Cross-Feature
- Minimal; mostly through App.tsx coordination
- Some features coordinate with Rust backend (device-detection, streaming, input-control)

### External
- React 19, Zustand 5, Zod, Tauri 2.x

<!-- MANUAL: Add manual notes below this line -->
