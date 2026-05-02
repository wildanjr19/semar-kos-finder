# Feature Landscape: Kos Map Search & Filtering

**Domain:** Map-based kos (boarding house) discovery — Indonesia market
**Researched:** 2026-05-03
**Confidence:** HIGH (competitor analysis + existing codebase alignment)

## Table Stakes

Features users expect. Missing = product feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Gender type filter** (`jenis_kos`) | Absolute non-negotiable in Indonesia. Putra/Putri/Campuran is a legal, cultural, and safety imperative. Users will leave immediately if they cannot filter by gender. | Low | Three checkboxes or chip group. Already color-coded in markers (Putri=pink, Putra=blue, Campuran=green). |
| **Price range filter** (`harga.min` / `harga.max`) | Primary decision driver. Users have tight budgets and price is the first filter applied on Mamikos, Infokost, and 99.co. | Medium | Needs period selector (bulanan/semesteran/tahunan) alongside range. Slider + number inputs. Data has multiple HargaItem per kos. |
| **AC status filter** (`ac_status`) | Major quality/cost differentiator in Indonesian kos market. "AC or not" is a top-3 filter on Mamikos. | Low | Three options: AC, non-AC, keduanya (mixed rooms). Simple checkbox group. |
| **Location search / proximity** | Map-first apps require spatial anchoring. Users think "near UNS campus" or "near my faculty." | Medium | Text search for address/area + "near me" geolocation. Backend has `/api/master-uns` destinations for campus routing. Radius filter is table stakes for map apps. |
| **Key facility toggles** (`fasilitas.dalam_kamar`, `bersama`, `utilitas`) | Users expect to filter for WiFi, kamar mandi dalam, laundry, parking. Mamikos promotes "Kos AC, Kos Kamar mandi dalam, Kos Wifi" as quick filters. | Low-Med | Checkbox groups by category. Start with 6-8 most common items from data. |
| **Active filter indicator + Clear all** | Standard map app UX. Users need to see what's applied and reset easily. | Low | Filter chip bar with "X" count and "Hapus filter" button. |
| **Live result count** | Users need feedback that filters are working. "42 kos ditemukan" builds trust and guides refinement. | Low | Derived from client-side array length. |

## Differentiators

Features that set Semar Kos Finder apart. Not universally expected, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Rules filter** (`peraturan`) | Kos rules are dealbreakers (curfew, guest policy, pets) but are rarely filterable. Mamikos UX research found users manually compared rules one-by-one. Making this filterable is a genuine differentiator. | Medium | Boolean toggles for tamu_menginap, boleh_hewan. Select for tamu_lawan_jenis (dilarang/terbatas/bebas). Time range for jam_malam. |
| **Payment period filter** (`harga.periode`) | Students vs workers have different cash flow needs. Semesteran/tahunan discounts matter. Mamikos supports "durasi sewa" filter. | Low | Dropdown or chips: bulanan, semesteran, tahunan, per3bulan, mingguan. |
| **Proximity to specific destination** | Route calculation already exists (`/api/directions`). Filter by "within X minutes walk from Building X" is powerful for campus-centric search. | Medium-High | Needs distance matrix or client-side Haversine + routing integration. Filter by walking time, not just radius. |
| **Room type price comparison** (`harga.tipe_kamar`) | Some kos have multiple room tiers (standard, deluxe). Showing and filtering by room type lets users find hidden affordable options. | Low | Filter chips for room types found in data. |
| **Map price labels on markers** | Property maps that show price on pins (Zillow, Mapbox examples) convert better than generic pins. Users scan prices spatially. | Low | MapLibre GL symbol layer with price text. Existing markers use letters (P/L/C) — can augment or toggle. |
| **"Compare kos" side panel** | Mamikos UX case study identified this as a major pain point: users open multiple tabs to compare. A compare drawer with 2-3 selected kos is a strong differentiator. | Medium | Multi-select mode → drawer with table comparison of price, facilities, rules, distance. |
| **Payment method filter** (`tipe_pembayaran`) | Some kos require cash-only, others accept transfer. Useful for students without bank accounts. | Low | Chip group from data values. |

## Anti-Features

Deliberately NOT building. Out of scope or actively harmful.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Backend API filtering** | Prototype constraint: no backend changes. Client-side filtering is sufficient for dataset size (hundreds of kos). | Filter in-browser with `Array.filter`. Defer backend query params until integration decision. |
| **Reviews & ratings** | Out of scope per PROJECT.md. No review data in `KosClean`. | Skip entirely for prototype. Consider for post-MVP if user-generated content strategy emerges. |
| **Booking / inquiry flow** | Out of scope per PROJECT.md. No payment infrastructure. Existing WhatsApp contact links in popup are sufficient. | Keep existing WhatsApp `url_wa` links in popup. No booking UI. |
| **Virtual tour / 3D** | High complexity, low data availability. Mamikos invests heavily here but it's not feasible for this dataset. | Rely on existing popup data display. Photos are not part of current data model. |
| **AI chat assistant** | Would require LLM integration, extra latency, and unclear value for a filter prototype. | Static filter UI is faster and more predictable. |
| **Saved searches / email alerts** | Useful for mature platforms, overkill for a prototype. Increases state complexity and persistence needs. | Browser `localStorage` for filter presets if absolutely needed later. |
| **Social login / user accounts** | No user model in backend. JWT exists only for admin. | Anonymous usage only. No personalization. |
| **Advanced map drawing (polygons, custom areas)** | Complex spatial filtering beyond prototype needs. | Simple radius slider or destination-based proximity. |

## Feature Dependencies

```
Gender filter (jenis_kos)
  → Map marker colors already implemented
  → No dependencies

Price range filter (harga)
  → Depends on: HargaItem parsing (already exists)
  → Enables: Room type filter (tipe_kamar)

AC status filter (ac_status)
  → No dependencies

Facility filters (fasilitas)
  → Depends on: Normalized string arrays in CleanKos (already exists)
  → Enables: Compare kos feature (needs facility lists)

Rules filter (peraturan)
  → Depends on: Normalized peraturan fields (already exists)
  → Enables: Compare kos feature (needs rules comparison)

Proximity / destination filter
  → Depends on: /api/master-uns data (already exists)
  → Enables: Walking time filter (needs /api/directions integration)
  → Note: Client-side Haversine distance is cheap; routing API is expensive

Payment period filter (harga.periode)
  → Depends on: Price range filter (shares harga data)

Compare kos panel
  → Depends on: All filter categories (needs consistent data display)
  → Requires: Multi-select state management
```

## MVP Recommendation

Prioritize for prototype:

1. **Gender filter** (`jenis_kos`) — table stakes, instant value, trivial to implement
2. **Price range** (`harga.min` / `harga.max` + period) — primary decision driver
3. **AC status** (`ac_status`) — high-value binary filter, very common query
4. **Key facilities** (top 5-6 from `fasilitas.dalam_kamar` / `bersama` / `utilitas`) — WiFi, kamar mandi dalam, laundry, parkir
5. **Active filter bar + clear all + result count** — required UX scaffolding

Defer:
- **Rules filter**: Medium complexity, but genuine differentiator. Build if prototype time allows.
- **Proximity by walking time**: Needs routing integration, higher complexity. Radius or campus dropdown is simpler MVP.
- **Compare kos**: Requires multi-select state, drawer UI. Valuable but not prototype-critical.
- **Map price labels**: Nice visual upgrade, but existing letter markers work.

## Kos-Specific Context

### What Makes Kos Different from General Property Search

| Factor | General Property | Kos (Indonesia) |
|--------|-----------------|-----------------|
| **Gender** | Optional/bedroom count | Mandatory (Putra/Putri/Campuran) |
| **Rules** | Lease terms | Daily life rules (curfew, guests, pets) |
| **Price period** | Monthly rent | Monthly, semester, yearly, weekly |
| **Facilities** | Pool, garage, garden | WiFi, AC, bathroom type, laundry |
| **Target user** | Families, professionals | Students, young workers |
| **Decision speed** | Weeks | Days or hours |
| **Proximity driver** | School district | Walking distance to campus/faculty |

### Mamikos Filter Hierarchy (Market Leader)

Based on app store descriptions and UX research:
1. Location (city, area, near campus)
2. Price range
3. Property type / gender
4. Facilities (AC, WiFi, private bathroom)
5. Rental duration
6. Quick filters: "Dikelola Mamikos", "Kos Pilihan"

### UNS Campus Context

Semar Kos Finder targets UNS (Universitas Sebelas Maret) area. Key user needs:
- Walking distance to specific faculties/buildings
- Price segmentation for student budgets (Rp 500K–2M typical)
- Gender-segregated search (many faculties are gender-skewed)
- Semester-based payment alignment with academic calendar

## Sources

- Mamikos app store listings and feature descriptions (Google Play, App Store) — HIGH confidence
- "Improve Mamikos App with Comparing Kos Feature" — UX case study by Bagia Jati Permana (Medium, 2022) — HIGH confidence
- Cari-Kos.com App Store listing — MEDIUM confidence
- "Aplikasi Selain Mamikos: 9 Alternatif" — Kelolapro (2025) — MEDIUM confidence
- "16 Aplikasi Pencari Kos" — Superkos (2024) — MEDIUM confidence
- Real estate map UI patterns: MapAtlas blog, REToolkit, Sierra Interactive, Houzi Docs — MEDIUM confidence
- Existing codebase: `CleanMapPrototype.tsx`, `backend/app/models.py` — HIGH confidence
