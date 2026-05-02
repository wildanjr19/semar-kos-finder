# Domain Pitfalls: Map-Based Kos Discovery — Search & Filter UI

**Domain:** MapLibre GL + React public map with rich structured kos data (harga ranges, fasilitas categories, peraturan rules)
**Researched:** 2026-05-03
**Confidence:** HIGH (MapLibre official docs + GitHub issues + extensive community reports)

## Critical Pitfalls

Mistakes that cause rewrites, performance collapses, or UX abandonment.

### Pitfall 1: Re-creating MapLibre Markers on Every Filter Change
**What goes wrong:** The existing `Map.tsx` creates markers via `new maplibregl.Marker({ element: el })` and stores them in `markersRef.current`. If filter logic rebuilds this array on every state change, all markers are destroyed and re-created synchronously. With 500+ kos items this causes 1–3 second UI freezes. Even with 100 items, mobile browsers stutter.
**Why it happens:** React state updates trigger `useEffect` dependencies. Developers naturally put `filteredData` in the dependency array and rebuild markers inside the effect. MapLibre markers are DOM elements — creating/removing DOM nodes is far slower than `setFilter` on a symbol layer.
**Consequences:** Map appears frozen during filtering; markers flash; popup state lost; route lines disappear unexpectedly.
**Prevention:**
- **Do not** rebuild `maplibregl.Marker` instances on filter changes.
- Convert kos data to a **GeoJSON source + symbol layer** and use `map.setFilter()` — this is synchronous and avoids DOM churn.
- If DOM markers are required (for complex HTML popups), implement a **diffing strategy**: compute added/removed IDs and only call `marker.remove()` / `new maplibregl.Marker()` for deltas. Keep marker instances in a `Map<string, maplibregl.Marker>`.
- Cache React nodes with `useMemo` if using `react-map-gl` wrappers.

**Warning signs:**
- `useEffect` dependency array includes `filteredData`
- Filter panel interactions cause visible marker flashing
- Chrome Performance tab shows long "Recalculate Style" + "Layout" blocks

**Phase to address:** Prototype wiring (when connecting filter state to map)

---

### Pitfall 2: Using `setData()` Instead of `setFilter()` for Client-Side Filtering
**What goes wrong:** Calling `geoJSONSource.setData()` with a filtered subset of features triggers a full tile pyramid rebuild in MapLibre's worker. On a few hundred features this is imperceptible; on 1,000+ features it causes 200–800ms main-thread stalls. Rapid filter changes (e.g., dragging a price slider) make the map feel broken because intermediate states are dropped.
**Why it happens:** `setData()` is the intuitive React pattern — "derive new data array, pass to source." But MapLibre's GeoJSON source converts data to vector tiles internally on every call. The official docs and issue #4364 confirm this is not incremental.
**Consequences:** Map freezes during slider drags; filter feedback feels disconnected from user input; mobile browser may ANR (Application Not Responding).
**Prevention:**
- Load **all** kos data into a single GeoJSON source once on mount.
- Use `map.setFilter('kos-layer', ['all', ['==', ['get', 'jenis_kos'], 'Putri'], ...])` to show/hide features.
- `setFilter()` is synchronous and runs entirely in the renderer — no worker round-trip.
- If data truly must change (e.g., live updates from API), debounce `setData()` to ≥300ms and use `updateData()` diffs when available.

**Warning signs:**
- Filter UI feels "mushy" or delayed
- Chrome DevTools shows long tasks under `geojson-vt` or `Tile` processing
- Console logs from `setData()` fire more frequently than map renders

**Phase to address:** Prototype wiring / integration

---

### Pitfall 3: Filter Panel Obscuring the Map on Mobile
**What goes wrong:** A sidebar or bottom drawer filter panel covers 50–80% of the map viewport on mobile. Users lose spatial context — they cannot see which areas have kos density while adjusting filters. They also trigger "scroll hijack" when trying to scroll the filter panel but instead panning the map (or vice versa).
**Why it happens:** Desktop-first design ported to mobile. Filter panels designed for wide screens (left sidebar) are reused on narrow viewports without adaptation.
**Consequences:** Users abandon filters because they can't see results; accidental map pans cause disorientation; thumb-unreachable controls at top of screen reduce engagement.
**Prevention:**
- On mobile, use a **bottom sheet / drawer** pattern (not a left sidebar) that reveals ~40% of the map behind it.
- Implement **batch filtering with explicit Apply**: let users adjust multiple filters, then tap Apply to see results. Real-time filtering on mobile is disorienting when combined with map movement.
- Provide a **transparent scrim** so users know the map is still there.
- Add a **"Clear all"** button prominently; users often get stuck with zero results and don't know why.
- Ensure touch targets ≥48×48dp (Android) / 44×44pt (iOS).

**Warning signs:**
- Users tap map accidentally when trying to scroll filter panel
- "No results" state appears frequently with no obvious way back
- Filter usage analytics drop off after first filter applied

**Phase to address:** Prototype layout (UI mock phase)

---

### Pitfall 4: Exposing All Nested Fields as Flat Filters
**What goes wrong:** The `KosClean` model has deeply nested structures: `harga` is an array of objects with `min`, `max`, `periode`, `tipe_kamar`; `fasilitas` has `dalam_kamar`, `bersama`, `utilitas` arrays; `peraturan` has booleans, strings, and arrays. Exposing every leaf node as a checkbox creates 30+ filter controls. Users face choice paralysis and the filter panel becomes an unusable wall of inputs.
**Why it happens:** "The data model has these fields, so the UI should expose them." This is a data-driven design trap, not a user-task-driven design.
**Consequences:** Users ignore most filters; important filters (price, gender/jenis) are buried; mobile panel requires excessive scrolling.
**Prevention:**
- **Prioritize by user task frequency:** jenis_kos (gender) and harga range are top decisions — make them primary.
- **Group secondary filters** into collapsible sections: "Fasilitas", "Peraturan", "Tipe Pembayaran".
- **Use combined representations:** Instead of separate min/max price inputs, use a single range slider with period context ("Bulanan", "Tahunan").
- **Defer array-based multi-selects:** Fasilitas should be a searchable multi-select or tag cloud, not 20 checkboxes.

**Warning signs:**
- Filter panel requires >3 screen heights on mobile
- Analytics show only 1–2 filters ever used
- Users report "too complicated" in feedback

**Phase to address:** Prototype layout (information architecture)

---

### Pitfall 5: No Visual Feedback for "Zero Results" State
**What goes wrong:** Users apply multiple filters (e.g., Putri + AC + Bisa bayar bulanan) and the map shows an empty viewport. They don't know if the app is broken, if the data is missing, or which specific filter eliminated all results. They often abandon the flow rather than trial-and-error removing filters.
**Why it happens:** Engineering focus is on the "happy path" of filtering down to results. The empty state is an afterthought.
**Consequences:** Users think the app has no kos data; support tickets saying "map is blank"; negative perception of data completeness.
**Prevention:**
- Show a **persistent results count** (e.g., "Menampilkan 12 kos") that updates as filters change.
- On zero results, display a **contextual empty state**: "Tidak ada kos Putri dengan AC di area ini. Coba: hapus filter AC, atau perluas area pencarian."
- Show **active filter chips** above the map or in the panel header so users can remove individual filters without scrolling.
- Consider a **"Show closest matches"** fallback that relaxes the least important active filter.

**Warning signs:**
- "No results" screen is a generic "Data tidak ditemukan"
- Users must open the filter panel to see what's active
- No count indicator next to filter apply button

**Phase to address:** Prototype layout

---

### Pitfall 6: Rerendering the Entire Map Component on Filter State Changes
**What goes wrong:** If filter state lives in a parent component (e.g., `CleanMapPrototype`) and is passed down to `Map`, React may re-render the entire map subtree on every filter change. Even if `Map.tsx` doesn't visibly change, React reconciliation runs over the whole component tree.
**Why it happens:** React's default behavior — state change at parent triggers child re-renders. MapLibre's imperative API (`mapRef.current`) doesn't need React to re-render, but the component tree still reconciles.
**Consequences:** Jank during filter interactions; filter panel UI itself becomes sluggish because React is busy reconciling the map.
**Prevention:**
- **Isolate map state** using `useRef` for the map instance and `useCallback` for event handlers.
- Lift filter state into a **separate context or state machine** that the map subscribes to imperatively, not via props.
- Use `React.memo` on the `Map` component with a custom comparator that ignores filter state.
- If filter state must be passed as props, ensure the map component reads it only in `useEffect` (imperatively calling `setFilter`) and not in render.

**Warning signs:**
- React DevTools Profiler shows `Map` component re-rendering on every checkbox toggle
- Filter controls feel laggy even before map updates

**Phase to address:** Prototype wiring

---

### Pitfall 7: Price Range Filtering Without Normalizing Periods
**What goes wrong:** `harga` array contains entries like `{min: 800000, max: 1200000, periode: 'bulanan', tipe_kamar: 'Kamar Mandi Dalam'}` and `{min: 9000000, max: 9000000, periode: 'tahunan', ...}`. A simple numeric range slider cannot compare across periods. Users searching "under 1 juta" will miss yearly-priced kos that are actually cheap monthly, or vice versa.
**Why it happens:** The data model faithfully captures raw listing data, but the filter UI treats price as a flat number.
**Consequences:** Users get irrelevant results or miss good matches; filter feels "broken" for price — the most important filter.
**Prevention:**
- **Normalize to a common period** for filtering (e.g., store monthly-equivalent price in GeoJSON properties).
- Provide a **period selector** (Bulanan / Tahunan / Semester) that changes the slider scale and interpretation.
- Use **dual sliders** only if the range is small and homogeneous; otherwise use max-price input with period context.

**Warning signs:**
- Price filter returns kos with wildly different actual costs
- Users report "mahal" for kos that is actually cheap per month

**Phase to address:** Prototype layout (data contract alignment)

---

## Moderate Pitfalls

### Pitfall 8: Clustering Enabled on Filtered Layer
**What goes wrong:** MapLibre's `cluster: true` on a GeoJSON source works well for static data, but `setFilter()` on a clustered layer filters **clustered features**, not original features. A cluster representing 10 kos may still appear even if only 1 of those kos matches the filter — or disappear even if 1 matches, depending on cluster aggregation. The visual result is misleading.
**Why it happens:** Clustered GeoJSON sources pre-aggregate features into clusters before layer filters apply. The `filter` operates on cluster properties (like `point_count`), not individual feature properties.
**Prevention:**
- **Disable clustering** on the kos layer if precise filtering is required.
- Alternatively, maintain **two sources**: one clustered for initial zoom levels (no filter), one unclustered for filtered views.
- Use `maxzoom` on the clustered source and switch to an unclustered source when zoomed in.

**Phase to address:** Integration / production map

---

### Pitfall 9: Scroll Hijack on Embedded Map
**What goes wrong:** On mobile web (not app), when the map occupies a large portion of the viewport, users trying to scroll the page past the map inadvertently trigger map pan gestures. This traps them on the map section.
**Why it happens:** Touch events are captured by the map canvas. Standard web maps don't differentiate between "scroll the page" and "pan the map" intents.
**Prevention:**
- On mobile, start with the map in a **non-interactive mode** (e.g., `scrollZoom: false`, `dragPan: false`) and provide a prominent **"Aktifkan peta"** button.
- Alternatively, use a **two-finger pan** requirement for map interaction (MapLibre `cooperativeGestures: true` on supported versions, or custom implementation).
- Keep the map height ≤60vh on mobile so users can always scroll past it via margins.

**Phase to address:** Prototype layout

---

### Pitfall 10: Not Debouncing Free-Text Search Input
**What goes wrong:** A search box that filters kos names fires filtering logic (and potentially re-renders) on every keystroke. With 500+ items and complex string matching, this causes input lag.
**Why it happens:** Direct `onChange` → `setState` → filter computation without debounce.
**Prevention:**
- Debounce free-text search by **300ms** — industry standard for autocomplete.
- Use `useMemo` for the filtered array computation so it only recalculates when debounced query changes.
- If filtering is client-side against a large dataset, consider **Web Workers** for the search computation to avoid blocking the main thread.

**Phase to address:** Prototype wiring

---

## Minor Pitfalls

### Pitfall 11: Inconsistent Filter Logic (AND vs OR)
**What goes wrong:** Within a category (e.g., Fasilitas), users expect OR logic ("AC OR Kamar Mandi Dalam"). Between categories (e.g., Jenis + Harga + Fasilitas), users expect AND logic. If the UI applies AND everywhere, users get zero results unexpectedly.
**Prevention:** Document the logic explicitly in UI copy. Use `['any', ...]` within groups and `['all', ...]` between groups when building MapLibre filter expressions.

### Pitfall 12: Filter State Not Reflected in URL
**What goes wrong:** Users can't share a filtered view. Refreshing the page resets all filters.
**Prevention:** Sync active filters to URL query params (`?jenis=Putri&harga_max=1000000`). Use Next.js `useSearchParams` or `nuqs` for type-safe URL state. This also enables browser back/forward navigation through filter history.

### Pitfall 13: Accessibility Blind Spots in Custom Filter Controls
**What goes wrong:** Custom dropdowns, range sliders, and chip inputs lack ARIA labels, focus management, and keyboard navigation. Screen reader users cannot operate filters.
**Prevention:** Use native HTML inputs where possible (`<input type="range">`, `<select>`, `<input type="checkbox">`). If building custom controls, follow WAI-ARIA combobox/slider patterns. Ensure focus is trapped inside the filter panel when open (for modals/drawers).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Prototype layout (UI mock) | Filter panel obscures map on mobile | Design bottom-sheet pattern; keep ≥40% map visible |
| Prototype layout (UI mock) | Exposing all 30+ data fields as filters | IA prioritization: top 4 filters visible, rest collapsed |
| Prototype wiring (logic) | Re-creating markers on filter change | Use `setFilter()` on GeoJSON layer, not `setData()` |
| Prototype wiring (logic) | Parent state causing full map re-render | Isolate map in `React.memo`; use refs for imperative updates |
| Integration to production | Clustering + filtering interaction | Disable clustering or maintain dual sources |
| Integration to production | URL state not synced | Add query param serialization early |

---

## Sources

- MapLibre GL JS Official Docs: "Optimising MapLibre Performance: Tips for Large GeoJSON Datasets" — https://www.maplibre.org/maplibre-gl-js/docs/guides/large-data/ (HIGH confidence)
- MapLibre GL JS GitHub Issue #4364: "Performance issue on large FeatureCollection GeoJSON source updates" — confirms `setData` rebuilds tile pyramid (HIGH confidence)
- MapLibre Agent Skills Issue #10: `setData()` under rapid updates drops intermediate states; `setFilter()` is synchronous (HIGH confidence)
- Stack Overflow / React-Map-GL Issue #750: Marker node caching prevents re-renders during viewport changes (MEDIUM confidence)
- LogRocket Blog: "Best practices for mobile search filter UX" — batch vs real-time, touch targets, clear filters (MEDIUM confidence)
- Map UI Patterns (mapuipatterns.com): Mobile map gesture ambiguity, scroll hijack, touch target standards (MEDIUM confidence)
- Contentsquare: "5 Major Mobile Filtering Pitfalls" — overlay vs dropdown, applied filter visibility (MEDIUM confidence)
- Axis Maps Guide: "Map interaction" — AND/OR filter logic, mobile tap-vs-hover (MEDIUM confidence)
