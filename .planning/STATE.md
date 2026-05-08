# STATE: Semar Kos Finder — Search & Filter Prototype

## Project Reference

- **Core Value**: Users can quickly narrow down kos listings on the map to find options that match their preferences (price, facilities, rules, room type).
- **Scope**: UI prototype only — no wired filtering logic, no backend changes.
- **Prototype Path**: `frontend/prototype/clean-map`
- **Data Source**: Existing `/api/kos` endpoint, client-side only.

## Current Position

- **Phase**: 3 — Responsive UX Scaffolding
- **Plan**: 2 plans created
- **Status**: Ready to execute
- **Progress**: [66%] ██████░░░░

## Performance Metrics

- **Requirements**: 14 v1, mapped to 3 phases
- **Coverage**: 14/14 ✓

## Accumulated Context

- **Decisions**:
  - Client-side data only; backend filtering deferred to v2.
  - UI mock without wired logic for v1; logic deferred to v2.
  - Prototype-first in isolated folder before production integration.
- **Todos**:
  - Create ROADMAP.md and STATE.md.
  - Begin Phase 1 planning.
- **Blockers**: None.

## Session Continuity

- **Last Action**: Phase 3 planning complete — 2 plans created for active chips/count/badges and responsive sidebar/bottom sheet
- **Next Expected Action**: `/gsd-execute-phase 3`
- **Open Questions**: None.

## Accumulated Context (updated)

- **Decisions**:
  - Client-side data only; backend filtering deferred to v2.
  - UI mock without wired logic for v1; logic deferred to v2.
  - Prototype-first in isolated folder before production integration.
  - Phase 1 context captured in `.planning/phases/01-prototype-foundation/01-CONTEXT.md`.
  - Phase 1 UI design contract approved: `.planning/phases/01-prototype-foundation/01-UI-SPEC.md`.
  - Phase 1 execution complete: shared types/helpers extracted, prototype components decomposed with CSS modules, MapView + page composition with lifted state, Map.tsx refactored to shared imports + CSS modules.
  - Phase 2 context captured in `.planning/phases/02-filter-panel-ui/02-CONTEXT.md`.

### Phase 2 Key Decisions
- Install shadcn/ui + Tailwind CSS v4 for filter controls
- 4 accordion sections: Room, Billing, Facilities, Rules (Search+Location standalone)
- Campus building selector for location (no geolocation)
- Stats bar removed entirely
- Chips for binary/ternary filters, checkboxes for facilities, inputs for price

### Phase 3 Key Decisions
- Result count displays total loaded kos only: `X kos ditemukan`
- Active chips reflect non-default controls and support remove-one plus `Hapus semua`
- Mobile filter UI is a bottom sheet collapsed to handle/count summary and opens to bottom 70dvh
- Desktop keeps existing collapsible left sidebar behavior
- Mobile keeps PreviewList below filters inside bottom sheet
