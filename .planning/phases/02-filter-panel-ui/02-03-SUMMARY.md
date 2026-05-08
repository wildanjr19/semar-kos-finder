---
phase: 02-filter-panel-ui
plan: 03
subsystem: ui
tags: [shadcn, checkbox, select, chip-group, accordion, react]

# Dependency graph
requires:
  - phase: 02-filter-panel-ui
    plan: 02
    provides: FilterPanel shell with SearchBar, LocationSelector, RoomSection, BillingSection, ChipGroup, FilterState types
provides:
  - FacilitiesSection with 3 checkbox groups (Dalam Kamar, Bersama, Utilitas)
  - RulesSection with jam_malam select + 3 chip groups (Tamu Lawan Jenis, Tamu Menginap, Boleh Hewan)
  - Complete 4-section accordion filter panel (Kamar, Pembayaran, Fasilitas, Peraturan)
affects:
  - Phase 3 (responsive UX scaffolding)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Checkbox groups for multi-select facility categories
    - ChipGroup radio mode with custom tri-state cycle handler
    - Data-[state=checked] override for teal checkbox styling

key-files:
  created:
    - frontend/app/prototype/clean-map/components/FacilitiesSection.tsx
    - frontend/app/prototype/clean-map/components/RulesSection.tsx
  modified:
    - frontend/app/prototype/clean-map/components/FilterPanel.tsx
    - frontend/app/prototype/clean-map/components/index.ts
    - frontend/app/prototype/clean-map/components/RulesSection.tsx

key-decisions:
  - Tri-state chips (Tamu Menginap, Boleh Hewan) use ChipGroup radio mode with custom useTriState cycle handler (Semua → Ya → Tidak → Semua) instead of simple radio deselect-to-null

patterns-established:
  - Facilities: flat string array of checked facility names, grouped by category
  - RulesSection: accepts individual prop + onChange per rule control for clean separation
  - Tri-state: cycle handler prevents null state, always in one of 3 meaningful states

requirements-completed: [FILT-04, FILT-05, UX-03]

# Metrics
duration: 3min
completed: 2026-05-08
---

# Phase 2 Plan 03: Facilities + Rules Accordion Sections Summary

**Complete 4-section filter panel with FacilitiesSection (3 checkbox groups) and RulesSection (jam_malam select + 3 chip groups), replacing all placeholder content**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-08T08:02:47Z
- **Completed:** 2026-05-08T08:05:56Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- FacilitiesSection renders 3 labeled checkbox groups: Dalam Kamar (10 items), Bersama (14 items), Utilitas (7 items) — all using shadcn Checkbox with teal checked state
- RulesSection renders Jam Malam shadcn Select dropdown + 3 ChipGroups: Tamu Lawan Jenis (radio: Dilarang/Terbatas/Bebas), Tamu Menginap (tri-state cycle: Semua/Ya/Tidak), Boleh Hewan (tri-state cycle: Semua/Ya/Tidak)
- FilterPanel: Fasilitas and Peraturan placeholder sections replaced with real components, all Plan 03 TODOs removed
- All 4 accordion sections (Kamar, Pembayaran, Fasilitas, Peraturan) now render with real filter controls
- index.ts exports FacilitiesSection and RulesSection for barrel import
- Custom `useTriState` cycle handler prevents null deselection on tri-state chips

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FacilitiesSection component** - `99f88ab` (feat)
2. **Task 2: Create RulesSection component** - `7dc938c` (feat)
3. **Task 3: Wire both into FilterPanel, update index.ts** - `bc256cc` (feat)

## Files Created/Modified

- `frontend/app/prototype/clean-map/components/FacilitiesSection.tsx` — Created: 3 checkbox groups for Dalam Kamar, Bersama, Utilitas facility categories
- `frontend/app/prototype/clean-map/components/RulesSection.tsx` — Created: Jam Malam select + Tamu Lawan Jenis/Tamu Menginap/Boleh Hewan chip groups
- `frontend/app/prototype/clean-map/components/FilterPanel.tsx` — Modified: wired imports and real components for Fasilitas/Peraturan sections
- `frontend/app/prototype/clean-map/components/index.ts` — Modified: added barrel exports for both new sections

## Decisions Made

- Tri-state chips (Tamu Menginap, Boleh Hewan) use ChipGroup `radio` mode with custom `useTriState` cycle handler. When clicking the already-selected chip, it cycles to the next state (Semua → Ya → Tidak → Semua) instead of deselecting to null. This keeps the filter always in a meaningful state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type narrowing in tri-state chip handlers**
- **Found during:** Task 3 (post-wiring verification)
- **Issue:** ChipGroup `onChange` typed as `(value: string | string[] | null) => void`, but `useTriState` handler expects `(value: string) => void`. The `value ?? "Semua"` expression inside `typeof value === "string"` check didn't narrow correctly for TypeScript strict mode.
- **Fix:** Split null and string branches with explicit checks: `if (value === null) handleTamuMenginap("Semua")` else `if (typeof value === "string") handleTamuMenginap(value)`
- **Files modified:** `frontend/app/prototype/clean-map/components/RulesSection.tsx`
- **Verification:** TypeScript `tsc --noEmit` passes with zero errors
- **Committed in:** `bc256cc` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Required for TypeScript compilation. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 8 filter controls complete across 4 accordion sections
- Phase 2 filter panel UI complete; FILT-01 through FILT-08 + UX-03 all covered
- Ready for Phase 3: responsive UX scaffolding (active filter chips, result count, adaptive layout)

---

*Phase: 02-filter-panel-ui*
*Completed: 2026-05-08*
