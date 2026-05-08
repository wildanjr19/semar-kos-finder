# ROADMAP: Semar Kos Finder — Search & Filter Prototype

## Overview

| Item | Value |
|------|-------|
| Granularity | Coarse |
| Mode | Yolo |
| Phases | 3 |
| v1 Coverage | 14/14 requirements |

## Phases

- [x] **Phase 1: Prototype Foundation** — Map renders with real kos data at /prototype/clean-map (2026-05-03)
- [ ] **Phase 2: Filter Panel UI** — All KosClean filter controls visible and grouped
- [ ] **Phase 3: Responsive UX Scaffolding** — Active filter chips, result count, and adaptive layout

## Phase Details

### Phase 1: Prototype Foundation
**Goal**: User can open the prototype and see a map populated with real kos data.
**Depends on**: Nothing
**Requirements**: UX-06
**Success Criteria** (what must be TRUE):
  1. User can navigate to /prototype/clean-map and see a working map.
  2. User sees kos markers on the map representing real listings from /api/kos.
  3. User can pan and zoom the map; markers remain visible and correctly positioned.
**Plans**: 4 plans

Plans:
- [x] `01-01-PLAN.md` — Extract shared types and helpers (✓)
- [x] `01-02-PLAN.md` — Decompose prototype presentational components + Sidebar (✓)
- [x] `01-03-PLAN.md` — Extract MapView container + wire page composition with lifted state (✓)
- [x] `01-04-PLAN.md` — Refactor production Map.tsx to use shared types/helpers and CSS modules (✓)
**UI hint**: yes

### Phase 2: Filter Panel UI
**Goal**: User sees all filter controls for KosClean fields grouped in a filter panel.
**Depends on**: Phase 1
**Requirements**: FILT-01, FILT-02, FILT-03, FILT-04, FILT-05, FILT-06, FILT-07, FILT-08, UX-03
**Success Criteria** (what must be TRUE):
   1. User sees and can interact with gender, price, AC, and facilities filter controls.
   2. User sees and can interact with rules, payment, text search, and location filter controls.
   3. Filter controls are organized into expandable/collapsible accordion sections.
**Plans**: 3 plans

Plans:
- [ ] `02-01-PLAN.md` — Foundation: shadcn/Tailwind setup, StatsBar removal, filter state scaffolding (Wave 1)
- [ ] `02-02-PLAN.md` — Core FilterPanel: SearchBar, LocationSelector, Room + Billing accordion sections wired to page (Wave 2)
- [ ] `02-03-PLAN.md` — Facilities + Rules accordion sections, complete all 8 filter controls (Wave 3)

**Wave dependencies:**
- **Wave 1** *(foundation)*
- **Wave 2** *(blocked on Wave 1: requires shadcn components)*
- **Wave 3** *(blocked on Wave 2: requires FilterPanel shell)*

**Cross-cutting constraints:**
- All filter controls are visual-only UI mock — no data mutation (per PROJECT.md scope)
- All copy in Bahasa Indonesia (per UI-SPEC §Copywriting Contract)
- Components live in `frontend/app/prototype/clean-map/components/` (per D-14)
- Filter state lifted to page level via props drilling (per D-13)
- Relative imports (no @/*) for existing prototype code; @/* alias for shadcn components only

**UI hint**: yes

### Phase 3: Responsive UX Scaffolding
**Goal**: Filter panel adapts to screen size and displays active filters with result count.
**Depends on**: Phase 2
**Requirements**: UX-01, UX-02, UX-04, UX-05
**Success Criteria** (what must be TRUE):
  1. User sees applied filters displayed as removable chips with a "Clear all" button.
  2. User sees a live result count indicator (e.g., "X kos ditemukan").
  3. On desktop, the filter panel renders as a collapsible left sidebar.
  4. On mobile, the filter panel renders as a bottom sheet keeping the map visible.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Prototype Foundation | 4/4 | Complete | 2026-05-03 |
| 2. Filter Panel UI | 0/3 | Planned | - |
| 3. Responsive UX Scaffolding | 0/2 | Not started | - |
