# Requirements: Semar Kos Finder — Search & Filter Prototype

**Defined:** 2026-05-03
**Core Value:** Users can quickly narrow down kos listings on the map to find options that match their preferences (price, facilities, rules, room type).

## v1 Requirements

Requirements for the filter UI prototype. Each maps to roadmap phases.

### Filters

- [ ] **FILT-01**: Gender filter UI (`jenis_kos`) — controls for Putra / Putri / Campuran visible in filter panel
- [ ] **FILT-02**: Price range filter UI (`harga`) — min/max inputs, period selector (bulanan/semesteran/tahunan/per3bulan/mingguan), and room type chips visible
- [ ] **FILT-03**: AC status filter UI (`ac_status`) — controls for AC / non-AC / keduanya visible
- [ ] **FILT-04**: Facilities filter UI (`fasilitas`) — checkbox groups for dalam_kamar, bersama, and utilitas categories visible
- [ ] **FILT-05**: Rules filter UI (`peraturan`) — controls for jam_malam, tamu_lawan_jenis (dilarang/terbatas/bebas), tamu_menginap, and boleh_hewan visible
- [ ] **FILT-06**: Payment type filter UI (`tipe_pembayaran`) — chip group for available payment types visible
- [ ] **FILT-07**: Text search filter UI — search input for nama and alamat visible
- [ ] **FILT-08**: Location/proximity filter UI — controls for "near me", radius slider, or campus building selector visible

### UX Scaffolding

- [ ] **UX-01**: Active filter chips bar — applied filters displayed as removable chips with "Clear all" button
- [ ] **UX-02**: Live result count display — "X kos ditemukan" indicator visible
- [ ] **UX-03**: Collapsible filter sections — filter categories grouped into expandable/collapsible accordion sections
- [ ] **UX-04**: Mobile bottom sheet layout — filter panel renders as bottom sheet on small screens, keeping map visible
- [ ] **UX-05**: Desktop sidebar layout — filter panel renders as collapsible left sidebar on larger screens
- [ ] **UX-06**: Map view with markers — map with kos markers visible alongside filter panel; real data loaded from `/api/kos`

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Filters

- **FILT-09**: Working client-side filter logic — controls actually filter the displayed markers and result count
- **FILT-10**: Backend API query params for filtering — `/api/kos` accepts filter parameters for scalability
- **FILT-11**: URL state sync for shareable filtered views — filter state persisted in URL query params

### UX

- **UX-07**: Compare kos side panel — multi-select kos and compare in a drawer/table
- **UX-08**: Map price labels on markers — display price directly on map pins

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Backend API filtering | Prototype constraint: no backend changes. Client-side data only. |
| Reviews & ratings | No review data in `KosClean`; out of scope per PROJECT.md |
| Booking / inquiry flow | No payment infrastructure; existing WhatsApp links are sufficient |
| User accounts / saved searches | No user model in backend; JWT exists only for admin |
| Virtual tours / photos | No photo data in current data model; high complexity |
| AI chat assistant | Unclear value for filter prototype; adds latency and complexity |
| Advanced map drawing (polygons) | Beyond prototype needs; simple radius/destination sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FILT-01 | Phase 2 | Pending |
| FILT-02 | Phase 2 | Pending |
| FILT-03 | Phase 2 | Pending |
| FILT-04 | Phase 2 | Pending |
| FILT-05 | Phase 2 | Pending |
| FILT-06 | Phase 2 | Pending |
| FILT-07 | Phase 2 | Pending |
| FILT-08 | Phase 2 | Pending |
| UX-01 | Phase 3 | Pending |
| UX-02 | Phase 3 | Pending |
| UX-03 | Phase 2 | Pending |
| UX-04 | Phase 3 | Pending |
| UX-05 | Phase 3 | Pending |
| UX-06 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-03*
*Last updated: 2026-05-03 after initial definition*
