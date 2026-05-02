# Project Research Summary

**Project:** Semar Kos Finder — Public Map Filter Prototype
**Domain:** Map-based kos (boarding house) discovery, Indonesia market (UNS campus)
**Researched:** 2026-05-03
**Confidence:** HIGH

## Executive Summary

Semar Kos Finder is a map-first kos discovery platform targeting students and young workers near Universitas Sebelas Maret (UNS). The research confirms that for the current dataset size (hundreds of kos listings), a **client-side filtering approach** with MapLibre GL is the correct technical path — no backend API changes are needed for the prototype. The recommended architecture decouples data fetching, filter state, and map rendering: the page component owns state, derives filtered items via `useMemo`, and passes them to a black-box map component. This pattern aligns with how mature map-based property platforms (Mamikos, 99.co) structure their search UX, while remaining feasible within the existing Next.js 16 + React 19 stack.

The primary technical risk is **performance during filter-to-map updates**. MapLibre's imperative DOM markers are expensive to recreate. Research shows that using a GeoJSON source with `setFilter()` (GPU-side filtering) avoids the 1–3 second UI freezes that come from destroying and rebuilding markers. The second major risk is **mobile UX**: a desktop-style sidebar filter panel will obscure the map and cause scroll hijack. The mitigation is a bottom-sheet pattern with batch filtering and explicit "Apply" buttons, keeping ≥40% of the map visible.

**Bottom line:** Build the prototype with lifted state + `useMemo` derivation + GeoJSON source filtering. Use shadcn/ui for rapid, accessible filter controls. Defer URL state sync, react-map-gl migration, and backend filtering to production integration.

## Key Findings

### Recommended Stack

The existing Next.js 16 + React 19 + TypeScript core is solid and should not change. For the filter prototype, add Tailwind CSS v4 + shadcn/ui for UI components, and keep maplibre-gl for rendering. State management stays lightweight: `useState` for the prototype, `nuqs` for URL-synced production filtering later. react-map-gl is the target architecture for production (declarative React markers/popups), but its React 19 edge cases (#2584 marker crash, #2410 fragment warning) make it a deferrable migration, not a prototype blocker.

**Core technologies:**
- **Next.js 16 + React 19 + TypeScript**: App framework — already in use, no migration needed.
- **maplibre-gl `^5.10.0`**: Map rendering — open-source, no API token, already standardised.
- **Tailwind CSS v4 + shadcn/ui CLI `4.6.0`**: UI primitives — de-facto Next.js standard in 2025; verified React 19 compatible.
- **nuqs `^2.8.9`**: URL query-state — type-safe, App Router native, defer to production integration.
- **lucide-react + clsx + tailwind-merge**: Icons and class utilities — standard shadcn/ui companions.

**Migration path:**
- **Prototype**: Keep imperative `maplibregl` markers. Filter by rebuilding marker arrays inside `useEffect` (acceptable for ~500 items).
- **Production**: Migrate to `react-map-gl` declarative components or GeoJSON `Source` + `Layer` for GPU filtering at scale.

### Expected Features

Indonesian kos search has unique constraints: gender segregation (Putra/Putri/Campuran) is legally and culturally mandatory, price periods vary (bulanan/semesteran/tahunan), and rules (curfew, guests, pets) are dealbreakers. Competitor analysis (Mamikos, Infokost, 99.co) shows location → price → gender → facilities is the standard filter hierarchy.

**Must have (table stakes):**
- **Gender filter (`jenis_kos`)** — absolute non-negotiable in Indonesia; missing = immediate abandonment.
- **Price range + period (`harga.min` / `harga.max` + periode)** — primary decision driver; needs period context (bulanan/semesteran/tahunan).
- **AC status filter (`ac_status`)** — top-3 filter on Mamikos; major quality/cost differentiator.
- **Key facility toggles** — WiFi, kamar mandi dalam, laundry, parkir (6-8 most common).
- **Location search / proximity** — map-first apps require spatial anchoring; text search + "near me" geolocation.
- **Active filter indicator + clear all + live result count** — standard map UX scaffolding; prevents zero-results confusion.

**Should have (competitive):**
- **Rules filter (`peraturan`)** — rarely filterable on competitors; genuine differentiator (curfew, guests, pets).
- **Payment period filter (`harga.periode`)** — aligns with student cash-flow needs (semester discounts).
- **Proximity to specific UNS destination** — walking time from faculty buildings; leverages existing `/api/directions`.
- **Map price labels on markers** — Zillow-style price pins convert better than generic markers.
- **Compare kos panel** — Mamikos UX research identified multi-tab comparison as major pain point.

**Defer (v2+):**
- Backend API filtering — client-side is sufficient for prototype dataset size.
- Reviews & ratings, booking flow, virtual tours, AI chat — out of scope per PROJECT.md.
- Saved searches, social login, user accounts — no user model in backend.
- Advanced map drawing (polygons, custom areas) — beyond prototype needs.

### Architecture Approach

Decouple data, filters, and map rendering. The page owns everything; components render. This prevents the prop-drilling and ref-syncing nightmares that come from splitting state across map and sidebar.

**Major components:**
1. **Page (`page.tsx`)** — fetches `/api/kos`, owns `FilterState`, computes `filteredItems` via `useMemo`. Single source of truth.
2. **FilterPanel (`FilterPanel.tsx`)** — pure UI. Renders shadcn controls, emits `onChange` with partial `FilterState` updates. No map refs, no fetching.
3. **CleanMapView (`CleanMapView.tsx`)** — black-box map. Receives `items: CleanKos[]`, owns MapLibre instance, renders markers/popups via imperative `useEffect`. Exposes only `mapRef` for fly-to.
4. **SidebarMeta (`SidebarMeta.tsx`)** — reads derived `filteredItems`. Shows counts, preview list, fly-to buttons.

**Key patterns:**
- **Lift state to the page** — fetching and filtering live in the page, not inside the map.
- **Derived state via `useMemo`** — `filteredItems` is computed, not stored. Prevents stale data and second sources of truth.
- **FilterPanel emits deltas, not commands** — panel calls `onChange({ ...filters, jenis_kos: next })`, never `setMarkersVisible(false)`.
- **Map component as a black box** — encapsulates all `maplibregl` imperative logic in one place.

### Critical Pitfalls

1. **Re-creating MapLibre markers on every filter change** — destroys/adds DOM nodes synchronously; 500+ items causes 1–3s freezes. **Avoid:** Use GeoJSON source + `setFilter()` (GPU-side, synchronous) or diff markers and only update deltas.
2. **Using `setData()` instead of `setFilter()` for client-side filtering** — `setData()` triggers full tile pyramid rebuild in MapLibre's worker; 200–800ms stalls on rapid slider drags. **Avoid:** Load all data once, filter with `map.setFilter()`.
3. **Filter panel obscuring the map on mobile** — sidebar covering 50–80% of viewport causes loss of spatial context and scroll hijack. **Avoid:** Bottom sheet pattern revealing ≥40% map; batch filtering with explicit "Apply".
4. **Exposing all nested fields as flat filters** — `KosClean` has 30+ leaf nodes; wall of checkboxes creates choice paralysis. **Avoid:** Prioritize top 4 filters (gender, price, AC, location), group rest into collapsible sections.
5. **No visual feedback for zero results** — users think the app is broken. **Avoid:** Persistent result count, contextual empty state with suggestions, active filter chips with individual removal.
6. **Rerendering entire map component on filter changes** — parent state change reconciles whole tree; filter UI becomes sluggish. **Avoid:** Isolate map with `React.memo`, `useRef` for map instance, read filter changes only in `useEffect`.
7. **Price range without normalizing periods** — comparing bulanan vs tahunan prices on a flat slider returns nonsense. **Avoid:** Period selector (Bulanan / Tahunan / Semester) that changes slider scale; normalize to monthly equivalent for filtering.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Component Extraction & State Foundation
**Rationale:** The existing `CleanMapPrototype.tsx` is a 1,000+ line monolith. Before adding filters, extract reusable boundaries. This is zero-risk groundwork.
**Delivers:** `CleanMapView` black-box component, `SidebarMeta` component, typed `FilterState` contract.
**Addresses:** Architecture foundation (ARCHITECTURE.md build steps 1, 4).
**Avoids:** Storing filter state inside map markers (Pitfall 1, 6).
**Research flag:** Standard pattern — skip deep research.

### Phase 2: Filter Panel & Derivation Logic
**Rationale:** Build the UI and state wiring before touching the map. This validates the filter taxonomy with real data and ensures the derivation logic is correct in isolation.
**Delivers:** `FilterPanel` with shadcn/ui components, page-level `useMemo` filter derivation, active filter bar with clear-all, live result count.
**Addresses:** Gender filter, price range + period, AC status, key facilities (FEATURES.md MVP).
**Avoids:** Exposing all 30+ fields as flat filters (Pitfall 4), inconsistent AND/OR logic (Pitfall 11), no zero-results feedback (Pitfall 5).
**Research flag:** Standard pattern — skip deep research. Validate shadcn component set (Accordion, Checkbox, Slider, Toggle, Badge, Sheet, Drawer, Input) during implementation.

### Phase 3: Map Performance & Integration
**Rationale:** This is the highest-risk phase. Connecting filter state to the map is where performance collapses if done wrong. Needs dedicated attention.
**Delivers:** Filtered items rendered on map without UI freezes; smooth updates on slider/checkbox changes.
**Uses:** maplibre-gl GeoJSON source + `setFilter()` (STACK.md, PITFALLS.md).
**Implements:** `CleanMapView` marker update strategy (ARCHITECTURE.md).
**Avoids:** Re-creating markers on filter change (Pitfall 1), using `setData()` instead of `setFilter()` (Pitfall 2), rerendering entire map on filter changes (Pitfall 6).
**Research flag:** **Needs research.** Validate GeoJSON source approach vs. diffing imperative markers for prototype dataset size. Quick spike recommended before full implementation.

### Phase 4: Mobile UX & Polish
**Rationale:** Mobile is the primary usage context for students. A desktop-only filter panel will fail user testing. Polish phase ensures the prototype is demo-ready.
**Delivers:** Bottom-sheet mobile filter panel, batch filtering with "Apply", touch targets ≥48dp, zero-results contextual state, debounced text search.
**Addresses:** Mobile filter UX, scroll hijack prevention, search input debounce.
**Avoids:** Filter panel obscuring map (Pitfall 3), scroll hijack (Pitfall 9), undebounced search (Pitfall 10).
**Research flag:** Standard pattern — skip deep research. Reference Mamikos mobile UX and Map UI Patterns guidelines.

### Phase 5: Production Integration & URL State
**Rationale:** Only after the prototype is UX-validated should it move to the public map and gain shareable URLs. This phase includes the react-map-gl migration decision.
**Delivers:** Filter feature integrated into production public map, URL query-state sync via `nuqs`, browser back/forward history support.
**Uses:** `nuqs` (STACK.md), `react-map-gl` (if migrating).
**Avoids:** URL state not reflected (Pitfall 12), clustering + filtering interaction (Pitfall 8).
**Research flag:** **Needs research.** React 19 edge cases in `react-map-gl` (#2584, #2410) need validation against actual Next.js 16 App Router navigation patterns. Consider keeping imperative map for production v1 if issues persist.

### Phase Ordering Rationale

- **Extraction before UI (Phase 1 → 2):** Cannot build a clean filter panel against a monolithic component. Boundaries first.
- **UI before Map (Phase 2 → 3):** Filter derivation logic must be correct before it's connected to the map. Debugging filter logic is easier without map re-renders in the way.
- **Performance before Polish (Phase 3 → 4):** Mobile UX polish is wasted if the map freezes on every filter change. Performance is a prerequisite for usable mobile.
- **Prototype before Integration (Phase 4 → 5):** URL state and production integration add complexity (SSR edge cases, route handling). Validate UX in isolation first.
- **Pitfall avoidance:** This order deliberately addresses Pitfalls 1, 2, 4, 6 in Phase 3 (the risky integration point), and Pitfalls 3, 5, 9, 10 in Phase 4 (the mobile polish point).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Map Performance):** GeoJSON source + `setFilter()` vs. diffing imperative markers for ~500 items. MapLibre docs recommend `setFilter()`, but the existing codebase uses imperative markers. A 2-hour spike to validate performance and popup behavior is warranted.
- **Phase 5 (Production Integration):** `react-map-gl` React 19 compatibility edge cases. If rapid client-side navigation triggers marker crashes, the production migration plan needs adjustment. Test with actual Next.js `<Link>` transitions before committing.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Component Extraction):** Well-established React component boundary patterns. No research needed.
- **Phase 2 (Filter Panel & Derivation):** shadcn/ui + `useMemo` + `Array.filter` are standard Next.js patterns. No research needed.
- **Phase 4 (Mobile UX):** Bottom sheet, touch targets, and debounce are documented extensively in mobile UX literature. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | shadcn/ui, Tailwind v4, nuqs, maplibre-gl all verified with Context7 official docs. React 19 peer deps confirmed. |
| Features | HIGH | Competitor analysis (Mamikos, Infokost, 99.co) + existing codebase (`KosClean` model) alignment is strong. |
| Architecture | HIGH | Lifted-state + derived data is a well-established React pattern. Existing `CleanMapPrototype.tsx` informs boundaries. |
| Pitfalls | HIGH | MapLibre official docs, GitHub issues (#4364), and community reports confirm `setData()` vs `setFilter()` behavior. |

**Overall confidence:** HIGH

### Gaps to Address

- **react-map-gl React 19 edge cases:** Issues #2584 (marker crash on rapid navigation) and #2410 (fragment warning) are manageable but need monitoring. Decision: keep imperative map for prototype; evaluate react-map-gl migration in Phase 5 with real navigation tests.
- **Price period normalization strategy:** The data model has `harga` arrays with mixed periods. The "normalize to monthly equivalent" approach is theoretically sound but needs validation against actual dataset values during Phase 2 implementation.
- **Accessibility for custom controls:** shadcn/ui provides accessible primitives, but custom filter layouts (range slider + period selector combo) need manual ARIA validation. Add axe-core or manual screen-reader testing to Phase 4.
- **Dataset size threshold for backend filtering:** Client-side filtering is correct for hundreds of items, but the threshold where it breaks (5,000? 10,000?) is unknown. Document this as a scalability decision for post-MVP.
- **Clustering strategy:** If the production map uses clustering, the interaction with filtering is non-trivial (clustered features filter incorrectly). Decision needed in Phase 5: disable clustering on filtered layer or maintain dual sources.

## Sources

### Primary (HIGH confidence)
- `/visgl/react-map-gl` (Context7) — v8 docs, peer deps, `Source`/`Layer` patterns, `Marker`/`Popup` declarative API.
- `/maplibre/maplibre-gl-js` (Context7) — `setFilter()`, `setData()`, GeoJSON source performance, large data guide.
- `/47ng/nuqs` (Context7) — type-safe `useQueryState` / `useQueryStates`, parser patterns, Next.js App Router integration.
- `/shadcn-ui/ui` (Context7) — Tailwind v4 + React 19 compatibility, component primitives, CLI init.
- MapLibre GL JS Official Docs: "Optimising MapLibre Performance: Tips for Large GeoJSON Datasets" — `setData()` rebuilds tile pyramid; `setFilter()` is synchronous.
- MapLibre GL JS GitHub Issue #4364 — Performance issue on large GeoJSON source updates.
- react-map-gl GitHub Issues #2584, #2410 — React 19 edge cases verified via webfetch.

### Secondary (MEDIUM confidence)
- Mamikos app store listings and feature descriptions (Google Play, App Store) — filter hierarchy, feature set.
- "Improve Mamikos App with Comparing Kos Feature" — Bagia Jati Permana UX case study (Medium, 2022) — compare panel pain point.
- Cari-Kos.com, Superkos, Kelolapro competitor listings — feature landscape validation.
- LogRocket Blog: "Best practices for mobile search filter UX" — batch vs real-time, touch targets.
- Map UI Patterns (mapuipatterns.com) — mobile gesture ambiguity, scroll hijack.
- Contentsquare: "5 Major Mobile Filtering Pitfalls" — overlay vs dropdown, applied filter visibility.
- Existing codebase: `frontend/components/Map.tsx`, `frontend/components/CleanMapPrototype.tsx`, `backend/app/models.py` — data model, current architecture.

### Tertiary (LOW confidence)
- Stack Overflow / React-Map-GL Issue #750 — Marker node caching prevents re-renders. Single source, unverified against v8.
- Axis Maps Guide: "Map interaction" — AND/OR filter logic. General reference, not kos-specific.

---
*Research completed: 2026-05-03*
*Ready for roadmap: yes*
