# Phase 1: Prototype Foundation - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the existing `/prototype/clean-map` page so it serves as a clean foundation for Phase 2 (Filter Panel UI) and Phase 3 (Responsive UX). The prototype already renders a MapLibre map with real kos markers from `/api/kos`. Phase 1 scope is refactoring, type extraction, component decomposition, and layout restructuring — not adding new capabilities.

Success criteria (from ROADMAP.md):
1. User can navigate to `/prototype/clean-map` and see a working map.
2. User sees kos markers on the map representing real listings from `/api/kos`.
3. User can pan and zoom the map; markers remain visible and correctly positioned.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Layout (preparing for Phase 2 filter panel)
- **D-01:** Filter controls will replace the current stats badges in the sidebar. Stats become secondary or move into filter chips.
- **D-02:** The preview list (first 5 kos items) stays but is collapsible — starts collapsed and expands on click.
- **D-03:** Sidebar is collapsible on desktop via a floating action button (FAB-style toggle) over the map.
- **D-04:** Sidebar width is fixed on desktop with a responsive breakpoint (full-width on narrow viewports). This prepares for Phase 3 mobile behavior.
- **D-05 (agent discretion):** Scroll behavior — whether the sidebar scrolls independently or the entire page scrolls is left to the implementation agent's best judgment.

### Shared Types and Helpers
- **D-06:** Extract KosClean TypeScript types in Phase 1 to `frontend/types/kos.ts`. Both `Map.tsx` and `CleanMapPrototype.tsx` will import from it.
- **D-07:** Extract shared helper functions to `frontend/lib/kos-helpers.ts` (e.g., `normalizeJenisKos`, `formatPrice`, `markerColors`). Both maps will use them.

### State Management
- **D-08:** Use component props + lifting state approach. State lives in the page component and is passed down to children.
- **D-09 (agent discretion):** Whether Phase 1 creates the lifted state structure with empty/default filter values now, or only restructures component hierarchy for Phase 2 to add state.
- **D-10 (agent discretion):** Whether data fetching (`/api/kos`) is lifted to the page level in Phase 1, or stays in `CleanMapPrototype` until Phase 2 needs it.
- **D-11 (agent discretion):** Whether sidebar open/closed state is lifted to the page level or stays local in the sidebar component.

### Code Organization
- **D-12:** Full decomposition of `CleanMapPrototype.tsx` into sub-components: Map, Sidebar, Popup, RouteControls, StatsBar, PreviewList, LoadingState, ErrorState.
- **D-13:** Convert inline styles to CSS modules for all extracted components.
- **D-14:** Extracted prototype components live in `frontend/app/prototype/clean-map/components/`.
- **D-15:** Apply the same decomposition and shared type refactoring to production `Map.tsx` as well.

**Note on D-14 + D-15:** There is a tension — if prototype-specific components live in the prototype directory, refactoring `Map.tsx` to use them creates a production→prototype dependency. The planner should resolve whether to:
- Keep shared components in `frontend/components/` and prototype-specific ones in `frontend/app/prototype/clean-map/components/`, or
- Structure components so shared ones are extracted to a common location.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase definitions, success criteria, and traceability
- `.planning/PROJECT.md` — Scope, constraints, key decisions, and out-of-scope items
- `.planning/REQUIREMENTS.md` — v1 requirements (UX-06 for Phase 1; FILT-01 through FILT-08 and UX-03 for Phase 2; UX-01, UX-02, UX-04, UX-05 for Phase 3)
- `.planning/STATE.md` — Current position and accumulated context

### Existing Implementation
- `frontend/components/CleanMapPrototype.tsx` — Existing prototype implementation (888 lines, inline styles)
- `frontend/components/Map.tsx` — Existing production map implementation (1118 lines, inline styles)
- `frontend/app/prototype/clean-map/page.tsx` — Prototype page entry point
- `frontend/app/api/kos/route.ts` — API proxy for kos data
- `backend/app/models.py` — KosClean Pydantic model (data contract that TypeScript types must align with)

### Project Conventions
- `AGENTS.md` — Architecture overview, package manager rules, running the stack
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, import order, error handling, file locations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CleanMapPrototype.tsx` already implements: MapLibre map init, marker rendering with gender colors, popup content with all KosClean fields, route drawing, sidebar with stats/preview, loading/error/empty states.
- `Map.tsx` implements similar patterns for the production map but with different styling (green/natural theme vs. teal/clean theme).
- `frontend/app/api/kos/route.ts` — simple proxy to backend `/api/kos`. No changes needed for Phase 1.

### Established Patterns
- Both map components use raw `fetch()` inside `useEffect` with manual loading/error state.
- Both use inline `style` objects (no CSS modules in frontend/ yet; admin/ uses CSS modules).
- Admin app uses `@/*` path alias; frontend does not — use relative imports in frontend.
- Next.js App Router with `ssr: false` dynamic import for MapLibre components.
- KosClean types are duplicated between `Map.tsx` and `CleanMapPrototype.tsx`.

### Integration Points
- Phase 1 changes are isolated to `frontend/` only. No backend changes.
- New files expected: `frontend/types/kos.ts`, `frontend/lib/kos-helpers.ts`, `frontend/app/prototype/clean-map/components/*.tsx`, `frontend/app/prototype/clean-map/components/*.module.css`.
- Phase 2 will inject filter controls into the restructured sidebar.
- Phase 3 will adapt the collapsible sidebar pattern for mobile bottom sheet.

</code_context>

<specifics>
## Specific Ideas

- The prototype already meets Phase 1 success criteria. Phase 1 is about refactoring to create a clean foundation.
- The user wants the prototype to feel like a solid base for filter work, not a throwaway sketch.
- FAB toggle for sidebar collapse was explicitly requested — modern mobile-like pattern on desktop.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Prototype Foundation*
*Context gathered: 2026-05-03*
