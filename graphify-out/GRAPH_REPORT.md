# Graph Report - .  (2026-04-11)

## Corpus Check
- Corpus is ~20,337 words - fits in a single context window. You may not need a graph.

## Summary
- 87 nodes · 95 edges · 14 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `Semar Kos Finder` - 14 edges
2. `_do_request()` - 5 edges
3. `geocode_address()` - 5 edges
4. `_do_request()` - 5 edges
5. `geocode_address()` - 5 edges
6. `main()` - 5 edges
7. `_ensure_surakarta_suffix()` - 4 edges
8. `pick_query()` - 4 edges
9. `run_geocoding()` - 4 edges
10. `_ensure_surakarta_suffix()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Web Logo` --brands--> `Semar Kos Finder`  [INFERRED]
  frontend/public/web_logo.png → README.md
- `Putra Marker Icon` --used_in--> `Interactive Map Feature`  [INFERRED]
  frontend/public/marker_putra.png → README.md
- `Putri Marker Icon` --used_in--> `Interactive Map Feature`  [INFERRED]
  frontend/public/marker_putri.png → README.md
- `Campuran Marker Icon` --used_in--> `Interactive Map Feature`  [INFERRED]
  frontend/public/marker_campuran.png → README.md
- `Data Pipeline` --located_in--> `Src Directory`  [EXTRACTED]
  README.md → PROJECT_STRUCTURE.MD

## Communities

### Community 0 - "Project Documentation & Tech Stack"
Cohesion: 0.1
Nodes (20): Campuran Marker Icon, Putra Marker Icon, Putri Marker Icon, Web Logo, Data Pipeline, Geocoding Feature, Google Maps Geocoding API, Interactive Map Feature (+12 more)

### Community 1 - "New Data Geocoding"
Cohesion: 0.22
Nodes (14): _build_log_path(), build_query(), _do_request(), _ensure_surakarta_suffix(), geocode_address(), is_inside_surakarta(), is_surakarta_address(), main() (+6 more)

### Community 2 - "Geocoding Pipeline"
Cohesion: 0.23
Nodes (13): _build_log_path(), _do_request(), _ensure_surakarta_suffix(), geocode_address(), is_inside_surakarta(), is_surakarta_address(), pick_query(), Strategi multi-tahap untuk memastikan hasil geocoding ada di Surakarta:       1. (+5 more)

### Community 3 - "Map UI Component"
Cohesion: 0.22
Nodes (2): normalizeWaHref(), parseContact()

### Community 4 - "CSV to JSON Converter"
Cohesion: 0.5
Nodes (4): csv_to_json(), main(), Convert a CSV file into JSON for frontend consumption., Read CSV rows and write them as a JSON array.

### Community 5 - "Plus Code Extraction"
Cohesion: 0.5
Nodes (4): get_address_and_plus_code(), process_kos_data(), Memproses data kos dari CSV dan menambahkan alamat lengkap serta plus code., Mendapatkan alamat lengkap dan plus code dari Google Maps Geocoding API.

### Community 6 - "JSON to CSV Converter"
Cohesion: 0.5
Nodes (4): json_to_csv(), main(), Convert a JSON file into CSV format., Read JSON array and write rows to CSV.

### Community 7 - "Directions API Route"
Cohesion: 1.0
Nodes (2): isFiniteCoordinate(), POST()

### Community 8 - "PDF Data Extraction"
Cohesion: 0.67
Nodes (1): Ekstraksi data dari dokumen PDF menggunakan pdfplumber.

### Community 9 - "Layout Component"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Home Page Component"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Next.js Environment"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Data Directory"
Cohesion: 1.0
Nodes (1): Data Directory

### Community 13 - "Notebooks Directory"
Cohesion: 1.0
Nodes (1): Notebooks Directory

## Knowledge Gaps
- **35 isolated node(s):** `Validasi apakah formatted_address mengandung keyword Surakarta/Solo.`, `Kirim satu request ke Google Geocoding API.     - Pakai `components=locality:Sur`, `Strategi multi-tahap untuk memastikan hasil geocoding ada di Surakarta:       1.`, `Tambahkan suffix Surakarta jika belum ada.`, `Susun query dari nama kos, alamat, dan plus code. Selalu sertakan konteks Suraka` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Layout Component`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Home Page Component`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Environment`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Data Directory`** (1 nodes): `Data Directory`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notebooks Directory`** (1 nodes): `Notebooks Directory`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Validasi apakah formatted_address mengandung keyword Surakarta/Solo.`, `Kirim satu request ke Google Geocoding API.     - Pakai `components=locality:Sur`, `Strategi multi-tahap untuk memastikan hasil geocoding ada di Surakarta:       1.` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Documentation & Tech Stack` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._