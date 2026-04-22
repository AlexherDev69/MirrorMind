<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/features/onboarding/

## Purpose

Setup wizard guiding users through USB debugging prerequisites. Detects phone brand via USB vendor ID, displays brand-specific instructions for enabling USB debug, validates prerequisites are met, and auto-advances steps on completion. Persists onboarding completion per device.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `domain/` | Brand types, onboarding step definitions |
| `data/` | Device brand detection, prerequisite checking |
| `presentation/` | OnboardingWizard component; onboarding.store Zustand state |

## For AI Agents

### Working In This Directory

- **Per-brand instructions**: Samsung, Xiaomi, Pixel, OnePlus, Huawei, Oppo, Realme, + generic fallback
- **USB vendor ID detection**: Identifies phone brand from USB device descriptor
- **Auto-advance**: Steps auto-complete when prerequisites are detected (e.g., USB debug enabled, adb authorization granted)
- **Persistence**: Tracks which devices have completed onboarding to avoid repeating wizard
- **No manual steps required**: Users follow on-screen instructions; app detects completion automatically

## Dependencies

### Internal
- `packages/shared/` — types

### External
- React 19, Zustand 5, Tauri 2.x

<!-- MANUAL: Add manual notes below this line -->
