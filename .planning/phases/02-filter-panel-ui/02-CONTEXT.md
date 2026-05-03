# Phase 2: Filter Panel UI - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

User sees all 8 KosClean filter controls (gender, price, AC, facilities, rules, payment, text search, location) organized into expandable/collapsible accordion sections within the existing prototype sidebar. No wired filtering logic — UI mock with real data displayed but no active filtering.

Success criteria (from ROADMAP.md):
1. User sees and can interact with gender, price, AC, and facilities filter controls.
2. User sees and can interact with rules, payment, text search, and location filter controls.
3. Filter controls are organized into expandable/collapsible accordion sections.

</domain>

<decisions>
## Implementation Decisions

### Styling Approach
- **D-01:** Install shadcn/ui + Tailwind CSS v4 for Phase 2 filter controls. This provides pre-built accessible components (accordion, checkbox, select, input, slider) that match modern Next.js conventions. Phase 1 CSS modules remain as-is for existing prototype components — new filter UI uses Tailwind.

### Accordion Organization
- **D-02:** 4 accordion sections + standalone bar:
  - **Room** — Gender (jenis_kos) + AC status (ac_status)
  - **Billing** — Price range (harga) + Payment type (tipe_pembayaran)
  - **Facilities** — Checkbox groups for dalam_kamar, bersama, utilitas
  - **Rules** — Controls for jam_malam, tamu_lawan_jenis, tamu_menginap, boleh_hewan
- **D-03:** Search text input + Location (campus) selector rendered as a standalone bar above the accordion, not inside any accordion section.

### Filter Control Design
- **D-04:** Chip/toggle groups for binary/ternary choices — gender, AC, payment type
- **D-05:** Checkbox groups for facilities (one section per category: dalam_kamar, bersama, utilitas)
- **D-06:** Select/radio for rules — jam_malam (select), tamu_lawan_jenis (chip group: dilarang/terbatas/bebas), tamu_menginap (toggle), boleh_hewan (toggle)
- **D-07:** Min/max number inputs + period dropdown for price range
- **D-08:** Text input for search (nama/alamat)
- **D-09:** Searchable select/dropdown for location (campus building from master_uns collection)

### Location Filter
- **D-10:** Campus building selector only — no browser geolocation or radius slider. Uses existing master_uns data. "Near me" and radius slider deferred to v2 if needed.

### Stats Bar Removal
- **D-11:** Remove the 4-column gender count stats bar (StatsBar component) from sidebar in Phase 2. Gender breakdown will surface through Phase 3 filter chips instead.

### Component Architecture
- **D-12:** Filter panel lives as a child component injected into Sidebar via the existing `children` API.
- **D-13:** Filter state maintained at page level via lifted state (follows Phase 1 D-08 pattern).
- **D-14:** New filter components go in `frontend/app/prototype/clean-map/components/` alongside existing Phase 1 components.

### the agent's Discretion
- Filter panel sub-component granularity (single FilterPanel vs. individual filter sub-components) — left to implementation agent.
- Whether to reuse existing index.ts barrel export or create separate FilterPanel index.
- Specific shadcn component selection (e.g., Accordion vs Collapsible, Command vs Select for campus picker).
- Price range default values and period options.
- Whether to add filter count badges on accordion headers (showing how many filters active in each section).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, FILT-01 to FILT-08 + UX-03 traceability
- `.planning/PROJECT.md` — Scope, constraints (no backend changes, client-side only, UI mock)
- `.planning/REQUIREMENTS.md` — FILT-01 through FILT-08, UX-03 detailed descriptions
- `.planning/STATE.md` — Current position and accumulated context

### Prior Phase Context
- `.planning/phases/01-prototype-foundation/01-CONTEXT.md` — Phase 1 decisions (sidebar API, state approach, component locations)
- `.planning/phases/01-prototype-foundation/01-UI-SPEC.md` — Design system (glassmorphism, spacing tokens, typography, colors)

### Existing Implementation
- `frontend/app/prototype/clean-map/page.tsx` — Page entry with lifted state pattern, data fetching from `/api/kos`
- `frontend/app/prototype/clean-map/MapView.tsx` — MapLibre wrapper with forwardRef/flyTo/clearRoute
- `frontend/app/prototype/clean-map/components/Sidebar.tsx` — Glassmorphism sidebar with `isOpen/onToggle/children` API (filter panel injects here)
- `frontend/app/prototype/clean-map/components/index.ts` — Barrel exports for existing components
- `frontend/types/kos.ts` — KosClean TypeScript types (data contract for filter fields)
- `frontend/lib/kos-helpers.ts` — Shared helper functions
- `frontend/app/api/master-uns/route.ts` — API proxy for master_uns data (campus building list for location filter)
- `frontend/app/api/kos/route.ts` — API proxy for kos data (used by filter data display)

### Codebase Conventions
- `AGENTS.md` — Architecture overview, package managers, running the stack
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, import order, CSS module conventions, frontend relative imports (no `@/*` alias)
- `.planning/codebase/STACK.md` — shadcn will add to dependency set

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Sidebar.tsx** — Accepts `children` prop. FilterPanel renders inside this. FAB toggle, glassmorphism, responsive breakpoint already built.
- **page.tsx** — Lifted state pattern at page level. Data fetching from `/api/kos`. Can add filter state here.
- **master-uns API** — `frontend/app/api/master-uns/route.ts` proxies `/api/master-uns` for campus building data. Already wired for location filter.
- **KosClean types** — `frontend/types/kos.ts` has all filter-relevant fields (jenis_kos, harga, ac_status, fasilitas, peraturan, tipe_pembayaran, nama, alamat).
- **kos-helpers.ts** — `normalizeJenisKos`, `formatPrice` and similar helpers reusable in filter display.

### Established Patterns
- **CSS modules** for prototype components (Phase 1). Phase 2 adds Tailwind alongside — layer Tailwind classes in new components, don't refactor existing CSS module components.
- **Lifted state** at page level via props drilling (no context/store). Filter state follows same pattern.
- **Relative imports** in frontend (no `@/*` alias).
- **Dynamic imports** with `ssr: false` for MapLibre components — not needed for filter panel (no Maplibre dependency).
- **Sidebar children API** — sidebar doesn't own or know about filter panel; it just renders children.

### Integration Points
- FilterPanel renders inside `<Sidebar>` children slot in `page.tsx`.
- Filter state variables added to `page.tsx` state management (alongside existing items, loading, error, sidebarOpen, previewExpanded).
- master_uns fetch added to page-level data fetching (alongside existing kos fetch).
- StatsBar removed from page.tsx composition and from Sidebar imports/exports.

</code_context>

<specifics>
## Specific Ideas

- Location filter should use existing `frontend/app/api/master-uns/route.ts` API endpoint — already proxies to backend `/api/master-uns` for campus building data.
- Since this is a UI mock phase, filters don't need to mutate data. Controls should respond visually (select state, chip active state, accordion expand/collapse) but don't filter the map markers.
- Phase 3 connects filter state to actual filtering and adds chips/count display.

</specifics>

<deferred>
## Deferred Ideas

- Near-me geolocation filter — future v2 filter capability
- Radius slider for proximity — future v2 filter capability
- Filter count badges on accordion headers — Phase 3 styling detail

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Filter Panel UI*
*Context gathered: 2026-05-03*
