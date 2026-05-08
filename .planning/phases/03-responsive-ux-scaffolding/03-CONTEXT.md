# Phase 3: Responsive UX Scaffolding - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

User sees responsive UX scaffolding around the existing visual-only filter panel: active filter chips, result count, desktop sidebar behavior, and mobile bottom sheet behavior. Filtering remains visual-only in v1: controls update UI state, chips, badges, and count display, but do not filter map markers or backend data.

Success criteria (from ROADMAP.md):
1. User sees applied filters displayed as removable chips with a "Clear all" button.
2. User sees a live result count indicator (e.g., "X kos ditemukan").
3. On desktop, the filter panel renders as a collapsible left sidebar.
4. On mobile, the filter panel renders as a bottom sheet keeping the map visible.

</domain>

<decisions>
## Implementation Decisions

### Result Count
- **D-01:** Show total loaded kos only: `X kos ditemukan`. Do not create mock filtered counts because v1 explicitly has no wired filtering logic.

### Active Filter Chips
- **D-02:** Active chips reflect selected, non-default controls. Chips are removable one-by-one and include a `Hapus semua` action.
- **D-03:** Hide default filter state from chips, including `pricePeriod: "bulanan"`, `selectedTamuMenginap: "Semua"`, and `selectedBolehHewan: "Semua"`.

### Responsive Layout
- **D-04:** Mobile layout uses a bottom sheet collapsed to a handle/count summary and opens over the bottom `70dvh`, keeping the map visible.
- **D-05:** Desktop keeps the existing collapsible sidebar and adds result count/chips inside it. Do not rework desktop sidebar width/layout unless required for the responsive bottom sheet.
- **D-06:** Mobile retains the preview list below the filter panel inside the bottom sheet. Do not hide preview data on mobile.

### Accordion Feedback
- **D-07:** Add small active-count badges per accordion section. This closes the Phase 2 deferred detail.

### the agent's Discretion
- Component names and exact file split for chips, summary/count, bottom sheet handle, and badge helpers.
- Exact visual styling details, as long as they preserve the existing teal/glassmorphism prototype language and Bahasa Indonesia copy.
- Whether active-chip derivation lives in `filter-types.ts`, a new helper file, or the relevant presentational component.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, UX-01/UX-02/UX-04/UX-05 traceability
- `.planning/PROJECT.md` — Prototype scope and constraints
- `.planning/REQUIREMENTS.md` — UX-01, UX-02, UX-04, UX-05 definitions and v2 filtering deferral
- `.planning/STATE.md` — Current project state

### Prior Phase Context
- `.planning/phases/01-prototype-foundation/01-CONTEXT.md` — Sidebar, page state, prototype composition decisions
- `.planning/phases/01-prototype-foundation/01-UI-SPEC.md` — Existing visual language and responsive expectations
- `.planning/phases/02-filter-panel-ui/02-CONTEXT.md` — Filter panel architecture, state location, deferred badge detail
- `.planning/phases/02-filter-panel-ui/02-UI-SPEC.md` — Filter panel UI contract from Phase 2
- `.planning/phases/02-filter-panel-ui/02-03-SUMMARY.md` — Final Phase 2 implementation summary

### Existing Implementation
- `frontend/app/prototype/clean-map/page.tsx` — Holds `items`, `filterState`, `sidebarOpen`, `previewExpanded`, and composes `Sidebar`, `FilterPanel`, `PreviewList`
- `frontend/app/prototype/clean-map/components/filter-types.ts` — `FilterState` and `DEFAULT_FILTER_STATE`; source of default/non-default chip logic
- `frontend/app/prototype/clean-map/components/FilterPanel.tsx` — Existing search/location bar and accordion sections; likely home for section badges
- `frontend/app/prototype/clean-map/components/Sidebar.tsx` — Current desktop sidebar shell and toggle API
- `frontend/app/prototype/clean-map/components/Sidebar.module.css` — Current absolute desktop sidebar styles and mobile breakpoint to adapt into bottom sheet
- `frontend/app/prototype/clean-map/components/PreviewList.tsx` — Must remain available inside mobile bottom sheet
- `frontend/app/prototype/clean-map/components/ChipGroup.tsx` — Existing chip UI primitive for filter controls; possible style reference for active chips
- `frontend/components/ui/badge.tsx` — Existing shadcn badge component available for accordion badges or chips

### Codebase Conventions
- `AGENTS.md` — App architecture, package managers, test/build guidance
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, frontend imports, component style conventions
- `.planning/codebase/STACK.md` — Frontend stack and shadcn/Tailwind setup
- `graphify-out/GRAPH_REPORT.md` — Codebase graph overview; clean-map prototype is a core frontend flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **FilterState / DEFAULT_FILTER_STATE** — Defines all selected control state and default values that active chips must compare against.
- **FilterPanel.tsx** — Already owns accordion section rendering and gets full `filterState` plus `setFilterState`; badges can be derived here without new global state.
- **Sidebar.tsx + Sidebar.module.css** — Existing collapsible desktop shell should be minimally adapted rather than replaced.
- **PreviewList.tsx** — Already follows page-level item data; keep it in the same child flow below filters.
- **Badge component** — shadcn badge exists for small active-count indicators.

### Established Patterns
- Filter state is lifted in `page.tsx` and passed down by props, matching Phase 2 D-13. Keep this pattern.
- New Phase 2 filter components use Tailwind and shadcn imports; existing shell components use CSS modules. Avoid broad style rewrites.
- Frontend prototype copy is Bahasa Indonesia.
- `@/*` alias is already used for shadcn components; prototype-local imports stay relative.

### Integration Points
- Add count/chips near the top of the sidebar/bottom sheet content so user sees current filter state before accordion details.
- Active chips need a safe reset path back to `DEFAULT_FILTER_STATE` per individual key and for `Hapus semua`.
- Responsive behavior likely belongs in `Sidebar.module.css` and/or small props on `Sidebar`, not in map code.

</code_context>

<specifics>
## Specific Ideas

- Result count copy: `X kos ditemukan`, where `X` is `items.length` from loaded kos.
- Clear-all copy: `Hapus semua`.
- Mobile collapsed summary should include a drag/handle affordance and count, while preserving map visibility.
- Section badges count non-default active filters in each accordion section: Kamar, Pembayaran, Fasilitas, Peraturan. Search/location can remain in the top summary/chips only unless implementation finds a clean place for them.

</specifics>

<deferred>
## Deferred Ideas

- Real client-side filtering, filtered marker count, backend query params, and URL state sync remain v2 (`FILT-09`, `FILT-10`, `FILT-11`).
- Full-screen mobile drawer was considered but not selected.
- Desktop sidebar width/layout rework was considered but not selected.

</deferred>

---

*Phase: 3-Responsive UX Scaffolding*
*Context gathered: 2026-05-08*
