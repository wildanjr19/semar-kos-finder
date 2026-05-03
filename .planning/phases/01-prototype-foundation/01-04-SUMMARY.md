---
phase: 01-prototype-foundation
plan: 04
subsystem: ui
tags: css-modules, react, maplibre-gl, refactoring, typescript

# Dependency graph
requires:
  - phase: 01-01
    provides: shared types (kos.ts) and helpers (kos-helpers.ts)
provides:
  - Production Map.tsx refactored to use shared types/helpers and CSS modules
affects: phase 2 filter panel, phase 3 responsive UX

# Tech tracking
tech-stack:
  added: CSS Modules (Map.module.css)
  patterns: CSS module classes for static styles, inline styles only for dynamic values

key-files:
  created:
    - frontend/components/Map.module.css
  modified:
    - frontend/components/Map.tsx

key-decisions:
  - "Imported parseContact and normalizeWaHref from kos-helpers.ts (already shared) instead of keeping local copies"
  - "Left createSectionLabel and createChip as local helpers (Map-specific DOM builders)"
  - "Utility helpers (createSectionLabel, createChip) retain inline styles — refactoring them to use CSS modules would change their API without benefit"
  - "Dynamic marker/badge colors (gender-dependent) and route status colors kept as inline styles — CSS modules cannot access runtime variables"

patterns-established:
  - "CSS Module per component file: Map.module.css alongside Map.tsx"
  - "Static layout styles in CSS modules, dynamic/runtime-dependent styles inline"

requirements-completed:
  - UX-06

# Metrics
duration: 5 min (between commits)
completed: 2026-05-03
---

# Phase 01 Plan 04: Map.tsx Shared Types/Helpers + CSS Module Refactor

**Production Map.tsx refactored to use shared types/kos.ts and lib/kos-helpers.ts imports, with 334 lines of static inline styles extracted to a dedicated Map.module.css CSS module preserving the green/natural theme.**

## Performance

- **Duration:** 5h 46m (session total, including reading, analysis, and build troubleshooting)
- **Started:** 2026-05-02T20:50:00Z
- **Completed:** 2026-05-03T02:36:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Removed 255 lines of duplicated type definitions and helper functions from Map.tsx — now imports from `../types/kos` and `../lib/kos-helpers`
- Created 334-line Map.module.css with green/natural theme classes for page layout, welcome dialog, markers, popup content, sections, buttons, and controls
- Converted 14 inline `style={{ }}` JSX objects and ~200 lines of imperative inline styles to CSS module classes
- Kept only genuinely dynamic styles inline: marker gradient colors (gender-dependent), jenis badge colors, route result status colors, destination select focus states
- Green theme preserved: `#2e3c2a`, `#3f4f3c`, `#ecf2e8`, `#c4d1bc` throughout CSS module
- Map-specific utility helpers (createSectionLabel, createChip) retained as local functions with inline styles

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace duplicated types and helpers with shared imports** - `eb026ad` (feat)
2. **Task 2: Convert Map.tsx inline styles to CSS module** - `cec0b5d` (feat)

## Files Created/Modified

- `frontend/components/Map.module.css` (created, 334 lines) — Green/natural theme CSS module with classes for page layout, welcome dialog, marker, popup, sections, buttons, route controls
- `frontend/components/Map.tsx` (modified, 673 lines, -502/+399) — Refactored to import shared types/helpers and use CSS module classes for all static styles

## Decisions Made

- **Imported parseContact and normalizeWaHref from kos-helpers.ts** instead of keeping local copies — these were already extracted to the shared module in a prior plan
- **Kept createSectionLabel and createChip as local helpers** — these are Map-specific DOM element builders with optional style override parameters; converting them to CSS module use would change their API
- **Left utility helper inline styles unchanged** — createSectionLabel and createChip use `element.style.xxx = value` which is idiomatic for their use case
- **Kept dynamic styles inline** — marker gradients, jenis badge colors, route status text colors, and destination select focus states all depend on runtime data and cannot use CSS module classes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's `min_lines: 800` estimate for Map.tsx was pre-refactoring; actual output is 673 lines TSX + 334 lines CSS = 1007 combined. This is the intended outcome of style extraction to CSS modules.
- Pre-existing TypeScript errors in `app/prototype/clean-map/components/PopupContentBuilder.ts` (7 errors, `.ts` file with JSX syntax) unaffected by this plan.

## Known Stubs

None — all data sources are wired to the `/api/kos` and `/api/master-uns` endpoints as before.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Next Phase Readiness

- Production Map.tsx now follows the same code organization as the prototype (shared types, shared helpers, CSS modules)
- Ready for Phase 2 filter panel and Phase 3 responsive UX
- 673-line Map.tsx is leaner and focused on logic only — styles live in the separate CSS module

## Self-Check: PASSED

- ✅ Map.module.css exists
- ✅ Map.tsx imports from ../types/kos
- ✅ Map.tsx imports from ../lib/kos-helpers
- ✅ Zero type definitions (^type = 0)
- ✅ Green theme colors in CSS (≥ 3 matches)
- ✅ Task 1 commit found (eb026ad)
- ✅ Task 2 commit found (cec0b5d)
- ✅ TypeScript check: 0 errors in Map.tsx

---

*Phase: 01-prototype-foundation*
*Completed: 2026-05-03*
