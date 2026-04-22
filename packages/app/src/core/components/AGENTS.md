<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# packages/app/src/core/components/

## Purpose

Reusable base UI components used across features (Icon, Button, Toast notifications, FadeTransition, etc.). These are dumb/presentational components with no business logic.

## For AI Agents

### Working In This Directory

- **Dumb components only** — no Zustand state, no custom hooks, no API calls
- **Props-driven** — all behavior controlled via props (onClick, disabled, variant, etc.)
- **Compose from Tailwind classes** — use `className` strings, not styled-components
- **Accessibility first** — use semantic HTML (button, nav, main, etc.); add aria labels where needed
- **Max 100 lines per component** — if larger, split into smaller composable pieces

## Dependencies

### External
- React 19, Tailwind 4

### Used By
- All features and pages
- App root (`App.tsx`)

<!-- MANUAL: Add manual notes below this line -->
