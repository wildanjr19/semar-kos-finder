# Architecture Patterns: Filter + Map Integration

**Domain:** Map-based kos discovery (Next.js 16 + React 19 + MapLibre GL)  
**Researched:** 2026-05-03  
**Scope:** Prototype filter UI in `frontend/prototype/clean-map` before production integration.

## Recommended Architecture

Decouple data, filters, and map rendering. The page owns state; components render.

```text
┌─────────────────────────────────────────────────────────────┐
│  Page (frontend/prototype/clean-map/page.tsx)               │
│  • fetch /api/kos                                           │
│  • hold FilterState + rawItems                              │
│  • derive filteredItems via useMemo                         │
├──────────────────────┬──────────────────────────────────────┤
│ FilterPanel          │ CleanMapView                         │
│ • Inputs only        │ • MapLibre map instance              │
│ • Calls onChange     │ • Receives items[] prop              │
│ • No map refs        │ • Imperative markers useEffect       │
├──────────────────────┴──────────────────────────────────────┤
│ SidebarMeta (counts, preview list, fly-to buttons)          │
│ • Reads same filteredItems[]                                │
└─────────────────────────────────────────────────────────────┘
```

### Why this shape
- **Single source of truth:** Page holds `rawItems` and `filters`. Everything else is derived.
- **Map component stays reusable:** `CleanMapView` is a presentational wrapper around MapLibre. Drop it into the public map later with the same interface.
- **Filter panel is pure UI:** Can be tested, moved, or replaced without touching map logic.
- **No prop drilling:** Only three props cross the boundary: `items`, `filters`, `onFilterChange`.

## Component Boundaries

| Component | Responsibility | Communicates With | Must NOT Do |
|-----------|----------------|-------------------|-------------|
| **Page** (`page.tsx`) | Fetch data, own `FilterState`, compute `filteredItems` | Passes `items` to `CleanMapView` and `SidebarMeta`; passes `filters`/`onChange` to `FilterPanel` | Import `maplibre-gl` or mutate markers directly |
| **FilterPanel** (`FilterPanel.tsx`) | Render controls for all `KosClean` fields; emit filter changes | Receives `filters` + `onChange` from Page | Know about map bounds, marker refs, or `maplibregl.Map` |
| **CleanMapView** (`CleanMapView.tsx`) | Own MapLibre `Map` instance; render markers/popups for provided `items` | Receives `items: CleanKos[]` + `destinations: Destination[]` as props | Fetch data, hold filter state, or read URL query params |
| **SidebarMeta** (`SidebarMeta.tsx`) | Show counts, top-5 preview, fly-to buttons | Receives `items`, `loading`, `error`, `mapRef` (for flyTo only) | Mutate marker DOM directly |

## Data Flow

### 1. Fetch → State → Derive
```
/api/kos ──► Page.useEffect ──► rawItems (useState)
                                    │
                                    ▼
                              filters (useState)
                                    │
                                    ▼
                         filteredItems = useMemo(applyFilters)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            FilterPanel      CleanMapView      SidebarMeta
```

### 2. Filter Change → Re-derive → Map Updates
```
User clicks checkbox ──► onChange(newFilters)
                              │
                              ▼
                        Page setFilters
                              │
                              ▼
                        filteredItems recalculated (useMemo)
                              │
                              ▼
                        CleanMapView sees new items prop
                              │
                              ▼
                        useEffect clears old markers, adds new ones
```

### 3. Fly-to Interaction
```
User clicks preview card in SidebarMeta
         │
         ▼
  calls mapRef.current?.flyTo({...})
         │
         ▼
  MapLibre camera moves; popup not opened automatically
```

## FilterState Shape

Align with `KosClean` fields. Use explicit types so the panel and derive logic stay in sync.

```typescript
type FilterState = {
  jenis_kos: string[];            // multi-select: Putri | Putra | Campuran
  ac_status: string[];            // multi-select: ac | non_ac | keduanya
  hargaMin: number | null;
  hargaMax: number | null;
  periode: string[];              // bulanan, etc.
  fasilitasDalamKamar: string[];  // chip multi-select
  fasilitasBersama: string[];
  fasilitasUtilitas: string[];
  tamuMenginap: boolean | null;   // tri-state: true | false | null (ignore)
  bolehHewan: boolean | null;
  tipePembayaran: string[];
};
```

**Rule:** Keep `null`/`[]` meaning “no constraint.” The derive function should treat empty arrays as “allow all.”

## Map Marker Update Strategy

MapLibre markers are imperative DOM nodes. React cannot diff them efficiently. Use the existing pattern from `Map.tsx` and `CleanMapPrototype.tsx`, but tighten the dependency array.

```typescript
// Inside CleanMapView
useEffect(() => {
  const map = mapRef.current;
  if (!map || !mapReady) return;

  // 1. Remove existing
  markersRef.current.forEach((m) => m.remove());
  markersRef.current = [];

  // 2. Build new markers from items prop
  markersRef.current = items.map((kos) => {
    const el = buildMarkerElement(kos);
    const popup = buildPopup(kos, destinations);
    return new maplibregl.Marker({ element: el, offset: [0, -18] })
      .setLngLat([kos.lon, kos.lat])
      .setPopup(popup)
      .addTo(map);
  });

  // 3. Optional: fit bounds when items change and user is not interacting
  if (items.length > 0 && !hasFitBoundsRef.current) {
    const bounds = new maplibregl.LngLatBounds(...);
    items.forEach((i) => bounds.extend([i.lon, i.lat]));
    map.fitBounds(bounds, { padding: ..., duration: 600, maxZoom: 15 });
    hasFitBoundsRef.current = true;
  }
}, [items, destinations, mapReady]);
```

**Performance note:** For the prototype dataset size (~hundreds of kos), full clear-and-recreate is acceptable. Do **not** optimize to diff markers until profiling shows a problem.

## Patterns to Follow

### Lift State to the Page
**What:** Fetching and filtering live in the page component, not inside the map.  
**Why:** The sidebar meta, filter panel, and map all need the same filtered list. Lifting avoids syncing through refs or context.  
**Example:**
```typescript
// page.tsx
const [items, setItems] = useState<CleanKos[]>([]);
const [filters, setFilters] = useState<FilterState>(defaultFilters);
const filteredItems = useMemo(() => applyFilters(items, filters), [items, filters]);
```

### Derived State via useMemo
**What:** `filteredItems` is computed, not stored.  
**Why:** Prevents stale data and guarantees that filter + data changes always produce a consistent view.  
**When:** Dataset is client-side and fits in memory (prototype constraint).

### Map Component as a Black Box
**What:** `CleanMapView` accepts `items` and renders markers. It exposes nothing except an optional `mapRef` for fly-to.  
**Why:** Encapsulates all `maplibregl` imperative logic in one place. The rest of the app stays declarative.

### FilterPanel Emits Deltas, Not Commands
**What:** Panel calls `onChange({ ...filters, jenis_kos: next })`. It does not call `setMarkersVisible(false)`.  
**Why:** Keeps UI events separated from side effects. The page decides how a filter change propagates.

## Anti-Patterns to Avoid

### Storing Filter State Inside MapLibre or Markers
**What:** Attaching `visible` flags to marker instances and toggling them directly.  
**Why bad:** React loses track of truth. Markers can drift out of sync with the filter panel after re-renders.  
**Instead:** Recompute `filteredItems` in React and let the effect rebuild markers.

### Letting FilterPanel Import maplibre-gl
**What:** Filter panel reads `mapRef` to call `queryRenderedFeatures` or pan the map.  
**Why bad:** Couples layout to map internals. Hard to test, hard to move.  
**Instead:** Page coordinates interactions. If the panel needs to trigger a map action, expose a narrow callback like `onFlyTo(lon, lat)`.

### Fetching Inside the Map Component When Filters Exist Up-Stream
**What:** `CleanMapView` fetches `/api/kos` internally even though the page already has the data.  
**Why bad:** Double fetch, race conditions, and the map component cannot share data with the sidebar.  
**Instead:** Page fetches once; passes `items` down.

### Holding `filteredItems` in useState
**What:** `setFilteredItems(applyFilters(items, filters))` inside an effect.  
**Why bad:** Creates a second source of truth. Easy to forget to update when `items` changes.  
**Instead:** `useMemo`.

### Using URL Query Params for Prototype
**What:** Syncing filters to `?jenis=Putri` in the prototype page.  
**Why bad:** Out of scope for this milestone. Adds complexity (Next.js 16 `useSearchParams` in client component, SSR edge cases) before UX is validated.  
**Instead:** Keep state in memory. Add URL persistence only when integrating into the production public map.

## Scalability Considerations

| Concern | At prototype size (~500 kos) | At 10K kos | At 100K kos |
|---------|------------------------------|------------|-------------|
| **Client filter compute** | `useMemo` over array is instant | Still fine if dataset cached | Move to backend query params |
| **Marker re-render** | Clear + recreate acceptable | Slight jank; consider diffing | Must use GeoJSON layer + `setData` instead of DOM markers |
| **Data fetch** | Single `/api/kos` call | Same, but payload grows | Backend pagination + query params required |
| **Filter UI complexity** | All fields in one panel | Group into accordion/sections | Consider searchable multi-select combos |

**Prototype implication:** The clear-and-recreate marker approach is correct for now. Do not build a virtualized GeoJSON diffing engine prematurely.

## Suggested Build Order

1. **Extract `CleanMapView`** from `CleanMapPrototype.tsx`  
   - Remove data fetching, sidebar, and stats.  
   - Accept `items: CleanKos[]`, `destinations: Destination[]`.  
   - Expose `mapRef` via `forwardRef` or callback ref for fly-to.  
   *Depends on:* nothing new.

2. **Build `FilterPanel`**  
   - Typed `FilterState`, default empty.  
   - Render controls for each `KosClean` field.  
   - Emit `onChange` with partial updates.  
   *Depends on:* `FilterState` type defined.

3. **Wire `FilterState` + derivation in prototype page**  
   - Page fetches `/api/kos`, normalizes to `CleanKos[]`.  
   - `useMemo` applies `FilterState` to produce `filteredItems`.  
   - Pass `filteredItems` to `CleanMapView` and `SidebarMeta`.  
   *Depends on:* steps 1 and 2.

4. **Extract `SidebarMeta`**  
   - Move counts, preview list, and fly-to buttons out of the map component.  
   - Receives `items` (already filtered) and `mapRef`.  
   *Depends on:* step 1 (mapRef contract) and step 3 (page state).

5. **Refine map bounds behavior**  
   - Decide whether fitting bounds should re-run when filters change.  
   - Track `hasFitBoundsRef` per mount or per filter change.  
   *Depends on:* step 3.

**Dependency graph:**
```
FilterState type
     │
     ├──► FilterPanel
     │
     └──► Page (fetch + derive)
              │
              ├──► CleanMapView
              │
              └──► SidebarMeta
```

## Sources

- Existing component patterns: `frontend/components/Map.tsx`, `frontend/components/CleanMapPrototype.tsx`
- Existing system architecture: `.planning/codebase/ARCHITECTURE.md`
- Project constraints: `.planning/PROJECT.md`
