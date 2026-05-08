---
phase: 02-filter-panel-ui
plan: 02
subsystem: ui
tags: shadcn, react, accordion, chip-group, combobox, filter-panel
requires:
  - phase: 02-filter-panel-ui
    plan: 01
    provides: shadcn components, Tailwind setup, filter state scaffolding, StatsBar removal
provides:
  - FilterPanel component with SearchBar + LocationSelector standalone bar
  - ChipGroup reusable chip/toggle component (radio + multi-select modes)
  - RoomSection (Kamar) accordion with gender + AC chip groups
  - BillingSection (Pembayaran) accordion with price inputs + period select + payment chips
  - Shared filter-types for FilterState type and DEFAULT_FILTER_STATE
affects:
  - 02-03: will wire FacilitiesSection and RulesSection into existing accordion slots
affects_frontend: true
tech-stack:
  added:
    - shadcn button component
  patterns:
    - Filter components in frontend/app/prototype/clean-map/components/
    - Shared filter state type extracted to filter-types.ts
    - Relative imports for prototype components, @/* alias for shadcn imports
key-files:
  created:
    - frontend/app/prototype/clean-map/components/ChipGroup.tsx
    - frontend/app/prototype/clean-map/components/SearchBar.tsx
    - frontend/app/prototype/clean-map/components/LocationSelector.tsx
    - frontend/app/prototype/clean-map/components/FilterPanel.tsx
    - frontend/app/prototype/clean-map/components/RoomSection.tsx
    - frontend/app/prototype/clean-map/components/BillingSection.tsx
    - frontend/app/prototype/clean-map/components/filter-types.ts
  modified:
    - frontend/app/prototype/clean-map/page.tsx
    - frontend/app/prototype/clean-map/components/index.ts
key-decisions:
  - "FilterState type extracted to shared filter-types.ts for reuse across FilterPanel and page.tsx"
  - "Button shadcn component installed for LocationSelector combobox trigger"
  - "Accordion uses type='multiple' to allow multiple sections open simultaneously"
  - "ChipGroup component handles both radio and multi-select modes via mode prop"
patterns-established:
  - "Filter sub-components in clean-map/components/ with barrel exports"
  - "filter-types.ts provides FilterState type and DEFAULT_FILTER_STATE"
  - "Relative imports for prototype components, @/* alias for shadcn imports"
  - "@/components/ui/* imports via shadcn path alias"
requirements-completed: [FILT-01, FILT-02, FILT-03, FILT-06, FILT-07, FILT-08, UX-03]
duration: 12min
completed: 2026-05-08
---

# Phase 2 Plan 2: Core FilterPanel — SearchBar, LocationSelector, Room + Billing Accordion Sections

**FilterPanel component with standalone search bar, campus combobox, and Kamar + Pembayaran accordion sections wired into page.tsx Sidebar**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-08T07:56:56Z
- **Completed:** 2026-05-08T08:08:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- ChipGroup component with radio (single-select) and multi (multi-select) modes for chip/toggle controls
- SearchBar with Indonesian placeholder "Cari nama atau alamat kos..." and teal focus ring
- LocationSelector using shadcn Command+Popover for searchable campus combobox
- FilterPanel shell with SearchBar + LocationSelector as standalone bar above Accordion
- RoomSection (Kamar) accordion with gender chip group (Putra/Putri/Campuran) + AC chip group (AC/Non-AC/Keduanya) — both radio mode
- BillingSection (Pembayaran) accordion with price min/max inputs, period dropdown (Mingguan/Bulanan/Per 3 Bulan/Semesteran/Tahunan), and payment type chip group (multi-select)
- Fasilitas and Peraturan accordion placeholders for Plan 03
- Shared filter-types.ts with FilterState type and DEFAULT_FILTER_STATE
- page.tsx wired: imports FilterState from filter-types, renders FilterPanel as first Sidebar child
- All copy in Bahasa Indonesia per UI-SPEC §Copywriting Contract
- TypeScript build passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ChipGroup, SearchBar, LocationSelector, FilterPanel shell** — `23815df` (feat)
2. **Task 2: Create RoomSection and BillingSection** — `dbf10ca` (feat)
3. **Task 3: Wire FilterPanel into page.tsx** — `b08ee3a` (feat)

**Plan metadata:** (committed alongside Task 3 files)

## Files Created/Modified

- `frontend/app/prototype/clean-map/components/ChipGroup.tsx` — Reusable chip/toggle component with radio and multi modes
- `frontend/app/prototype/clean-map/components/SearchBar.tsx` — Text input for search with teal focus ring
- `frontend/app/prototype/clean-map/components/LocationSelector.tsx` — Searchable campus combobox via Command+Popover
- `frontend/app/prototype/clean-map/components/FilterPanel.tsx` — Main filter panel shell with Accordion + standalone bar
- `frontend/app/prototype/clean-map/components/RoomSection.tsx` — Kamar accordion: gender + AC chip groups
- `frontend/app/prototype/clean-map/components/BillingSection.tsx` — Pembayaran accordion: price inputs + period select + payment chips
- `frontend/app/prototype/clean-map/components/filter-types.ts` — Shared FilterState type and DEFAULT_FILTER_STATE
- `frontend/app/prototype/clean-map/page.tsx` — Updated imports, added FilterPanel as first Sidebar child
- `frontend/app/prototype/clean-map/components/index.ts` — Barrel exports for all new components + filter-types
- `frontend/components/ui/button.tsx` — Installed shadcn button for LocationSelector trigger

## Decisions Made

- Extracted FilterState type to shared filter-types.ts for clean imports across FilterPanel and page.tsx (avoids duplication)
- Used `Accordion type="multiple"` to let users expand multiple sections simultaneously
- ChipGroup unified component with `mode` prop: radio for gender/AC, multi for payment type
- Installed shadcn `button` component (required by LocationSelector trigger) — not previously present

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **shadcn button component missing:** LocationSelector references `@/components/ui/button` which didn't exist. Installed via `npx shadcn@latest add button` as noted in the plan's task 1 action step 3. Not a deviation — the plan anticipated this.

## Self-Check: PASSED

- All 6 component files exist: ChipGroup ✓ SearchBar ✓ LocationSelector ✓ FilterPanel ✓ RoomSection ✓ BillingSection ✓
- filter-types.ts exists with FilterState + DEFAULT_FILTER_STATE ✓
- page.tsx imports FilterPanel from ./components ✓
- page.tsx renders `<FilterPanel>` as first Sidebar child ✓
- page.tsx no inline FilterState type ✓
- FilterPanel imports from ./filter-types ✓
- index.ts exports all components + filter-types ✓
- `cd frontend && npx tsc --noEmit` — TypeScript compilation completed (0 errors) ✓
- `cd frontend && npx next build` — Errors: 0 | Warnings: 0 ✓

## Next Phase Readiness

- Ready for Plan 02-03 (Facilities + Rules accordion sections)
- FilterPanel has placeholder accordion items for Fasilitas and Peraturan awaiting Plan 03
- All 4 accordion items exist, 2 populated (Kamar, Pembayaran), 2 placeholders (Fasilitas, Peraturan)

---

*Phase: 02-filter-panel-ui*
*Completed: 2026-05-08*
