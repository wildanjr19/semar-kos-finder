# Technology Stack: Search & Filter UI

**Project:** Semar Kos Finder — Public Map Filter Prototype  
**Researched:** 2026-05-03  
**Confidence:** HIGH for UI/state libraries; MEDIUM-HIGH for react-map-gl (see React 19 caveats)

---

## Recommended Stack

### Core Framework (Existing)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | `^16.2.1` | App framework | Already in use; App Router, React 19 native |
| React | `^19.2.4` | UI runtime | Already in use; concurrent features, stable |
| TypeScript | `^6.0.2` | Type safety | Already in use |

### Map & Geospatial

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| maplibre-gl | `^5.10.0` | Map rendering engine | Already in use; open-source, no API token |
| react-map-gl | `^8.1.1` | Declarative React wrapper | Lets markers/popups be React components; `Source`/`Layer` for GPU filtering; peer deps include `react >=16.3.0` so React 19 is accepted |

### UI & Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | `^4.2.4` | Utility-first CSS | De-facto standard for Next.js in 2025; v4 fully supports React 19 |
| shadcn/ui | CLI `4.6.0` | Headless component primitives | Copy-paste Radix-based components; Feb 2025 update verified full Tailwind v4 + React 19 compatibility |
| lucide-react | `latest` | Icons | Default icon set for shadcn/ui; tree-shakeable |

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| nuqs | `^2.8.9` | URL query-string state | Type-safe `useQueryState` / `useQueryStates`; built-in parsers (`parseAsArrayOf`, `parseAsInteger`, `parseAsStringLiteral`); Next.js App Router native; React 19 peer dep confirmed |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | `^2.1.1` | Conditional class names | Always with Tailwind |
| tailwind-merge | `^3.5.0` | Resolve Tailwind class conflicts | Always with Tailwind |
| zod | `^3.x` | Runtime filter schema validation | Optional; use if serialising complex filter objects to URL JSON |

---

## What to Use & Why

### 1. react-map-gl for declarative map interaction

The existing `Map.tsx` and `CleanMapPrototype.tsx` create markers and popups imperatively with `document.createElement`. This bypasses React reconciliation, making filter-driven UI updates error-prone and verbose (1 000+ lines of inline DOM construction).

**Use react-map-gl because:**
- `<Marker>` and `<Popup>` accept React children — rewrite popup cards in JSX.
- `<Source>` + `<Layer>` let you filter thousands of points GPU-side via the `filter` prop (MapLibre expression syntax).
- View state (zoom, center) is React state, not a ref.

**Migration path:**
- **Prototype** (immediate): Keep imperative map to avoid a full rewrite. Filter by toggling `marker.getElement().style.display` or by rebuilding the marker array from filtered data. Acceptable for a UX mock.
- **Production** (target): Replace imperative code with `react-map-gl`. Render markers as `<Marker>` components filtered by React state, or switch to a GeoJSON `<Source>` + symbol `<Layer>` if kos count exceeds ~500.

### 2. shadcn/ui + Tailwind v4 for filter panel

The current inline-style panels are hard to maintain. shadcn/ui provides accessible, keyboard-navigable components that match the existing clean aesthetic.

**Components needed for kos filters:**
- `Accordion` — collapsible filter sections (jenis, harga, fasilitas, peraturan).
- `Checkbox` — multi-select (fasilitas categories, peraturan rules).
- `ToggleGroup` / `RadioGroup` — single-select (jenis_kos, ac_status).
- `Slider` — price-range input.
- `Badge` — active filter chips.
- `Sheet` or `Drawer` — mobile filter panel.
- `Input` — text search (nama / alamat).

### 3. nuqs for filter state ↔ URL sync

Client-side filtering without backend changes means the URL should carry filter state so users can share links.

**Example filter state:**
```ts
import { useQueryStates, parseAsStringLiteral, parseAsArrayOf, parseAsInteger } from 'nuqs'

const filterParsers = {
  jenis: parseAsStringLiteral(['Putri', 'Putra', 'Campuran'] as const),
  ac: parseAsStringLiteral(['ac', 'non_ac', 'keduanya'] as const),
  minHarga: parseAsInteger.withDefault(0),
  maxHarga: parseAsInteger.withDefault(20_000_000),
  fasilitas: parseAsArrayOf(parseAsString).withDefault([]),
  q: parseAsString.withDefault(''),
}

const [filters, setFilters] = useQueryStates(filterParsers, { history: 'replace' })
```

Then derive `filteredItems` with `useMemo` and render only matching markers.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Map wrapper | react-map-gl | Keep imperative `maplibregl` | Imperative code scales poorly with React state; popups are 500+ lines of DOM mutations |
| Marker rendering | `<Marker>` components (react-map-gl) | GeoJSON source + symbol layer | Symbol layers scale to 10k+ points but sacrifice easy custom HTML/gradients; `<Marker>` is fine for expected <500 kos listings |
| UI library | shadcn/ui + Tailwind | Material UI, Chakra UI, Ant Design | MUI bundle is heavy and theming is opinionated; Chakra v3 is not yet stable for React 19; shadcn is the Next.js community standard in 2025 |
| Filter state | nuqs | Zustand, Redux, React Context | URL shareability is a product requirement; nuqs is zero-boilerplate for query strings and avoids prop drilling |
| Text search | `String.includes` (client-side) | Fuse.js, MiniSearch | For <500 items, native `includes` or simple regex is fast enough; add Fuse only if fuzzy search becomes a requirement |
| Styling | Tailwind CSS v4 | CSS Modules, Styled Components, inline styles | Inline styles are already unmaintainable (1 100+ lines in Map.tsx); CSS Modules lack the utility speed for rapid filter UI iteration |

---

## What NOT to Use

- **mapbox-gl** — Proprietary, requires access token. The project already standardised on MapLibre.
- **Material UI (MUI)** — Heavy runtime, theming conflicts, and not optimised for React 19 / Next.js 16 App Router.
- **Zustand / Redux / Jotai for filter state** — Overkill when the entire data set is fetched once and filtered client-side. nuqs + `useMemo` is sufficient.
- **TanStack Query (React Query)** — No server-state caching or invalidation patterns are needed for this milestone.
- **GeoJSON source + symbol layer** (if <500 markers) — Adds unnecessary complexity for custom popups and gradient markers. Use it only if profiling shows `<Marker>` lag.

---

## Installation

```bash
# 1. Tailwind CSS v4 (only if not already present)
npm install -D tailwindcss @tailwindcss/postcss postcss

# 2. shadcn/ui CLI & init
npx shadcn@4.6.0 init

# 3. react-map-gl wrapper
npm install react-map-gl@8.1.1

# 4. URL state management
npm install nuqs@2.8.9

# 5. Icons & class utilities
npm install lucide-react clsx tailwind-merge

# 6. Optional runtime validation
npm install zod
```

After init, add shadcn components on demand:
```bash
npx shadcn add accordion checkbox slider toggle badge sheet drawer input
```

---

## React 19 / Next.js 16 Caveats

react-map-gl `8.1.1` declares `react >=16.3.0` and is functionally compatible with React 19, but two open issues merit awareness:

1. **#2584** — `<Marker>` can crash with `Cannot read properties of undefined (reading 'appendChild')` during *rapid* client-side navigation (e.g. unmounting/remounting the map via Next.js `<Link>`).  
   **Mitigation:** The public map is a single-page experience; avoid mounting/unmounting the `<Map>` component on navigation (keep it in a layout or use a stable `key`). If rapid navigation is needed, wrap `marker.addTo` in a try-catch as suggested in the issue.

2. **#2410** — A non-fatal React warning about `source` prop on `React.Fragment` (observed in v7, may persist in v8 under certain JSX patterns).  
   **Mitigation:** Follow the documented `Source` → `Layer` nesting pattern; the warning does not break rendering.

**Confidence:** HIGH for shadcn/ui, nuqs, and Tailwind v4. MEDIUM-HIGH for react-map-gl because of the React 19 edge cases above, but they are manageable for a single-page map.

---

## Suggested Filter-Map Data Flow

```
┌─────────────────────────────────────────────┐
│  User interacts with shadcn filter controls │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  nuqs writes filter state to URL query      │
│  (e.g. ?jenis=Putri&minHarga=500000)       │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  React component derives filteredItems      │
│  via useMemo over fetched kos array         │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  react-map-gl renders <Marker> & <Popup>    │
│  only for filteredItems                     │
└─────────────────────────────────────────────┘
```

**For the prototype** (if keeping imperative map):
Skip `react-map-gl`, keep filter state in `useState`, and rebuild the marker array inside a `useEffect` whenever filters change. This is a short-term bridge, not the target architecture.

---

## Sources

- react-map-gl v8 docs & peer deps — Context7 (`/visgl/react-map-gl`), npm registry
- MapLibre GL JS filtering patterns (`setFilter`, `setLayoutProperty`, global-state) — Context7 (`/maplibre/maplibre-gl-js`)
- nuqs type-safe query state — Context7 (`/47ng/nuqs`)
- shadcn/ui Tailwind v4 + React 19 compatibility — Context7 (`/shadcn-ui/ui`)
- react-map-gl GitHub issues #2584, #2410 — verified via `webfetch`
- npm version verification: `react-map-gl@8.1.1`, `nuqs@2.8.9`, `tailwindcss@4.2.4`, `shadcn@4.6.0`
