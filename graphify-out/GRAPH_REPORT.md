# Graph Report - .  (2026-05-02)

## Corpus Check
- 94 files · ~68,935 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 622 nodes · 890 edges · 53 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 104 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `_call_llm()` - 11 edges
2. `getErrorMessage()` - 11 edges
3. `Prototype Clean Data Page` - 11 edges
4. `Clean Kos Schema` - 11 edges
5. `_run_job_item()` - 10 edges
6. `readJsonSafe()` - 10 edges
7. `Config` - 9 edges
8. `parse_single_entry()` - 9 edges
9. `Background Parse Job Queue` - 9 edges
10. `_run_job()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Inline Parse Preview` --semantically_similar_to--> `Admin Parse Wizard`  [INFERRED] [semantically similar]
  PLAN_PARSE_UX_IMPROVEMENTS.md → STRUCT_CLEAN_DATA.md
- `Background Task Indicator Placement` --implements--> `Background Parse Job Queue`  [INFERRED]
  admin/app/layout.tsx → STRUCT_CLEAN_DATA.md
- `Clean Data Workspace UI` --implements--> `Admin Parse Wizard`  [EXTRACTED]
  admin/app/actions/parse/page.tsx → STRUCT_CLEAN_DATA.md
- `Start Bulk Parse` --implements--> `Background Parse Job Queue`  [EXTRACTED]
  admin/app/actions/parse/page.tsx → STRUCT_CLEAN_DATA.md
- `Parse Jobs List API Proxy` --implements--> `Background Parse Job Queue`  [EXTRACTED]
  admin/app/api/actions/parse/jobs/route.ts → STRUCT_CLEAN_DATA.md

## Hyperedges (group relationships)
- **Admin Parse Cleaning Flow** — parse_page_clean_data_workspace, parse_page_start_bulk_parse, parse_page_field_diff_panel, parse_page_publish_review, struct_clean_data_data_status_lifecycle [EXTRACTED 1.00]
- **Next API Backend Proxy Pattern** — api_llm_test_proxy, api_parse_bulk_proxy, api_parse_entry_proxy, api_parse_jobs_proxy, api_parse_job_detail_proxy, api_parse_job_cancel_proxy, api_parse_review_proxy [EXTRACTED 1.00]
- **Clean Data Design Rationales** — struct_clean_data_rationale_fully_structured, struct_clean_data_rationale_dashboard_parsing, struct_clean_data_rationale_in_memory_queue, struct_clean_data_rationale_database_source_truth, struct_clean_data_rationale_localstorage_mvp [EXTRACTED 1.00]
- **Admin Kos CRUD Flow** — kos_list_page, kos_new_page, kos_edit_page, kos_import_page, kos_api_route, kos_id_api_route, kos_bulk_api_route [EXTRACTED 1.00]
- **Master UNS CRUD And Import Flow** — master_uns_list_page, master_uns_new_page, master_uns_edit_page, master_uns_import_modal, master_uns_api_route, master_uns_id_api_route, master_uns_bulk_api_route, master_uns_import_api_route [EXTRACTED 1.00]
- **Prototype Clean Data Workflow** — prototype_clean_data_page, clean_data_queue_item, clean_data_parse_actions, clean_data_batch_job_tracking, clean_data_confidence_scoring, clean_data_review_publish, clean_data_llm_profiles [EXTRACTED 1.00]
- **Parse Job Lifecycle** — admin_actions_parse_endpoints, job_queue_background_parse_queue, job_queue_job_dataclass, usejobpoller_hook, page_prototypejobspage, backgroundtaskindicator_component [EXTRACTED 0.92]
- **LLM Clean Data Contract** — parse_engine_system_prompt_contract, models_clean_kos_schema, inlineeditors_clean_data_editors, admin_actions_review_import_endpoints [INFERRED 0.86]
- **Admin Authenticated CRUD Surface** — auth_jwt_authentication, admin_kos_crud_router, admin_master_uns_crud_router, admin_actions_parse_endpoints, backend_proxywithretry [INFERRED 0.84]
- **Public Kos Map Data Flow** — kos_public_kos_api, api_kos_proxy, map_main_component, clean_map_component [EXTRACTED 1.00]
- **Frontend Route Calculation Flow** — map_main_route_display, clean_map_route_display, api_directions_proxy, google_routes_api [EXTRACTED 1.00]
- **Legacy Dataset Generation Pipeline** — extract_pdf_table_pipeline, geocoding_location_batch, json_to_csv_converter, concat_data_final_dataset, csv_to_json_frontend_export [INFERRED 0.82]
- **Mixed Marker Visual System** — marker_campuran_map_pin, marker_campuran_split_color_design, marker_campuran_teardrop_marker_shape [EXTRACTED 1.00]
- **Putri Marker Visual Encoding** — marker_putri_pink_location_marker, marker_putri_putri_kos_category, marker_putri_map_point_visual_encoding [INFERRED 0.82]
- **Web Logo Brand Mark Visual System** — web_logo_blue_house_outline_logo, web_logo_housing_symbol, web_logo_minimal_line_icon_style, web_logo_light_blue_brand_color [EXTRACTED 1.00]
- **Putra Map Marker Icon Composition** — marker_putra_blue_map_pin, marker_putra_avatar_silhouette, marker_putra_putra_kos_category [INFERRED 0.80]

## Communities

### Community 0 - "Admin Parse Workspace"
Cohesion: 0.03
Nodes (48): appendStoredJobId(), applyFeedbackSuggestion(), approveEntry(), asJobState(), asKosClean(), async(), buildQueueItem(), cancelActiveJob() (+40 more)

### Community 1 - "Backend Parse Actions"
Cohesion: 0.05
Nodes (54): cancel_parse_job(), _duration_ms(), _entry_id(), get_llm_config(), _get_merged_llm_config(), get_parse_job(), list_parse_jobs(), LlmConfigResponse (+46 more)

### Community 2 - "Admin Prototype CRUD"
Cohesion: 0.09
Nodes (38): Clean Data Batch Job Tracking, Clean Data Confidence Scoring, Clean Data LLM Profiles, Clean Data Parse Actions, Clean Data Queue Item, Clean Data Review Publish, Kos Collection API Proxy Route, Kos Bulk API Proxy Route (+30 more)

### Community 3 - "Backend Data Models"
Cohesion: 0.16
Nodes (31): BaseSettings, Config, load_config(), Settings, FasilitasCleaned, HargaItem, KontakItem, KosClean (+23 more)

### Community 4 - "Admin API Proxy Routes"
Cohesion: 0.07
Nodes (32): Admin Navigation Layout, Background Task Indicator Placement, Admin Home Redirect To Kos, LLM Test API Proxy, Bulk Parse API Proxy, Deprecated Parse API Route, Entry Parse API Proxy, Parse Job Cancel API Proxy (+24 more)

### Community 5 - "LLM Parse Review"
Cohesion: 0.1
Nodes (29): Admin LLM Config Endpoints, Admin Parse Action Endpoints, Parse Import and Review Endpoints, User LLM Config Merge, Background Task Indicator, Parse Jobs Local Storage Tracking, Inline Clean Data Editors, Fasilitas Editor (+21 more)

### Community 6 - "Background Job Queue"
Cohesion: 0.16
Nodes (25): cancel_job(), cleanup_old_jobs(), create_job(), _duration_ms(), _entry_id(), _entry_name(), _error_text(), get_job() (+17 more)

### Community 7 - "Authenticated CRUD Backend"
Cohesion: 0.11
Nodes (21): Admin Kos CRUD Router, Admin Master UNS CRUD Router, JWT Authentication Core, Login Rate Limiting, Auth Router, buildNextResponse(), fetchBackend(), proxyWithRetry() (+13 more)

### Community 8 - "Clean Map Prototype"
Cohesion: 0.12
Nodes (6): asHargaItems(), asStringArray(), isRecord(), normalizeCleanKos(), normalizeJenisKos(), toNumber()

### Community 9 - "Public Map Component"
Cohesion: 0.1
Nodes (4): closeWelcome(), normalizeWaHref(), onKeyDown(), parseContact()

### Community 10 - "JWT Auth Core"
Cohesion: 0.15
Nodes (10): check_rate_limit(), _cleanup_failures(), login(), LoginRequest, LoginResponse, FastAPI dependency: validate JWT from Authorization header.      Returns the tok, refresh(), RefreshRequest (+2 more)

### Community 11 - "Interactive Geocoding"
Cohesion: 0.22
Nodes (14): _build_log_path(), build_query(), _do_request(), _ensure_surakarta_suffix(), geocode_address(), is_inside_surakarta(), is_surakarta_address(), main() (+6 more)

### Community 12 - "Batch Geocoding"
Cohesion: 0.23
Nodes (13): _build_log_path(), _do_request(), _ensure_surakarta_suffix(), geocode_address(), is_inside_surakarta(), is_surakarta_address(), pick_query(), Strategi multi-tahap untuk memastikan hasil geocoding ada di Surakarta:       1. (+5 more)

### Community 13 - "Public Map Data API"
Cohesion: 0.22
Nodes (13): Frontend Kos API Proxy, Frontend Master UNS API Proxy, Clean Reviewed Kos Map Prototype, Reviewed Parsed Data Filter, Mongo Document To Kos Response Mapper, Mongo Kos Collection, Public Kos API, MapLibre Global App Shell (+5 more)

### Community 14 - "Parse UX Review"
Cohesion: 0.22
Nodes (11): Parse Import API Proxy, Parse Review API Proxy, Inbox Filters And Raw Selection, Publish Review Decisions, Default Save To Database, Parse Wizard Kos List Integration, Reduce Confusion About Unchanged Status, Parse Status Not Updating Problem (+3 more)

### Community 15 - "Dataset Pipeline"
Cohesion: 0.22
Nodes (10): Duplicate Kos Name Check, Final Dataset Concatenation, CSV To Frontend JSON Export, Frontend Static Kos Geo JSON, Batch Surakarta Geocoding, Surakarta Geocoding Validation Strategy, Address And Plus Code Enrichment, Interactive New Kos Geocoding (+2 more)

### Community 16 - "Backend Tests"
Cohesion: 0.22
Nodes (0): 

### Community 17 - "Kos Seed Script"
Cohesion: 0.36
Nodes (8): _extract_narahubung_nama(), main(), make_source_id(), normalize_kontak(), _parse_row(), Idempotent seed script for kos collection.  Run:  uv run python -m app.seed, Strip non-digits; ensure leading 0 or 62 prefix., seed()

### Community 18 - "PDF Extraction"
Cohesion: 0.39
Nodes (7): _clean_jenis_kos_text(), ekstrak_kolom_pilihan(), _extract_rows_from_words(), _is_header_row(), _normalize_spaces(), _postprocess_row(), Ekstraksi data dari dokumen PDF menggunakan pdfplumber.

### Community 19 - "Master UNS CRUD"
Cohesion: 0.36
Nodes (5): bulk_import_master_uns(), create_master_uns(), _doc_to_out(), list_master_uns(), update_master_uns()

### Community 20 - "Background Task UI"
Cohesion: 0.29
Nodes (2): isJobState(), isRecord()

### Community 21 - "Prototype Normalizers"
Cohesion: 0.36
Nodes (4): normalizeApiKos(), normalizeFacilities(), normalizeKosType(), normalizeStatus()

### Community 22 - "Kos CRUD Router"
Cohesion: 0.38
Nodes (3): create_kos(), _doc_to_kos(), update_kos()

### Community 23 - "Duplicate Detection"
Cohesion: 0.38
Nodes (6): check_duplicates(), load_kos_names(), normalize_name(), Normalize kos name for comparison., Load kos names from CSV and return dict with normalized name as key., Check for duplicate kos names between two CSV files.

### Community 24 - "Inline Editors"
Cohesion: 0.29
Nodes (0): 

### Community 25 - "Database Connection"
Cohesion: 0.4
Nodes (2): get_collection(), get_db()

### Community 26 - "FastAPI App Lifecycle"
Cohesion: 0.4
Nodes (3): _cleanup_loop(), lifespan(), Periodic cleanup of old parse jobs every 10 minutes.

### Community 27 - "Project Overview"
Cohesion: 0.33
Nodes (6): Repository Layout, Close Source Dataset, PDF To Frontend Data Pipeline, Interactive Kos Map, Accuracy Requires Batch Updates, Semar Kos Finder

### Community 28 - "CSV JSON Export"
Cohesion: 0.5
Nodes (4): csv_to_json(), main(), Convert a CSV file into JSON for frontend consumption., Read CSV rows and write them as a JSON array.

### Community 29 - "Address Enrichment"
Cohesion: 0.5
Nodes (4): get_address_and_plus_code(), process_kos_data(), Memproses data kos dari CSV dan menambahkan alamat lengkap serta plus code., Mendapatkan alamat lengkap dan plus code dari Google Maps Geocoding API.

### Community 30 - "JSON CSV Converter"
Cohesion: 0.5
Nodes (4): json_to_csv(), main(), Convert a JSON file into CSV format., Read JSON array and write rows to CSV.

### Community 31 - "Directions Routing"
Cohesion: 0.6
Nodes (5): Google Routes Directions Proxy, Clean Map Route Display, Directions Request Contract, Google Routes API computeRoutes, Main Map Route Display

### Community 32 - "Master UNS Seed"
Cohesion: 0.67
Nodes (3): main(), Idempotent seed script for master UNS locations., seed()

### Community 33 - "Prototype Chrome Theme"
Cohesion: 0.5
Nodes (0): 

### Community 34 - "Brand Logo"
Cohesion: 0.67
Nodes (4): Blue House Outline Logo, Housing Symbol, Light Blue Brand Color, Minimal Line Icon Style

### Community 35 - "Public Master UNS"
Cohesion: 1.0
Nodes (2): _doc_to_location(), list_locations()

### Community 36 - "E2E Environment"
Cohesion: 0.67
Nodes (3): Admin Playwright E2E Config, Docker Environment Isolation, GitHub Environment Secrets

### Community 37 - "Admin Login Guard"
Cohesion: 1.0
Nodes (3): Admin Token Cookie, Protected Admin Routes Middleware, Admin Login API Proxy

### Community 38 - "Mixed Marker Icon"
Cohesion: 1.0
Nodes (3): Mixed Category Map Pin, Vertically Split Pink And Blue Design, Teardrop Location Marker Shape

### Community 39 - "Putri Marker Icon"
Cohesion: 1.0
Nodes (3): Map Point Visual Encoding, Pink Location Marker Icon, Putri Kos Category

### Community 40 - "Putra Marker Icon"
Cohesion: 1.0
Nodes (3): Person Avatar Silhouette, Blue Map Pin Marker, Putra Kos Category Marker

### Community 41 - "Backend Package"
Cohesion: 1.0
Nodes (1): Semar Kos Finder backend app package.

### Community 42 - "Middleware Entrypoint"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Next Config"
Cohesion: 1.0
Nodes (2): Empty Next Config, Next TypeScript Environment References

### Community 44 - "PDF Row Reconstruction"
Cohesion: 1.0
Nodes (2): PDF Kos Survey Table Extraction, PDF Word Anchor Row Reconstruction

### Community 45 - "Frontend Next Types"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Data Concatenation"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Playwright Config"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Admin Next Config"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "CRUD E2E Spec"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "CSS Types"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Backend App Package"
Cohesion: 1.0
Nodes (1): Backend App Package

### Community 52 - "Generated Next Types"
Cohesion: 1.0
Nodes (1): Generated Next Type References

## Knowledge Gaps
- **92 isolated node(s):** `Periodic cleanup of old parse jobs every 10 minutes.`, `Idempotent seed script for kos collection.  Run:  uv run python -m app.seed`, `Strip non-digits; ensure leading 0 or 62 prefix.`, `Background job queue for batch kos parsing with DB persistence.`, `Upsert job state into MongoDB.` (+87 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Backend Package`** (2 nodes): `__init__.py`, `Semar Kos Finder backend app package.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Middleware Entrypoint`** (2 nodes): `middleware.ts`, `middleware()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Config`** (2 nodes): `Empty Next Config`, `Next TypeScript Environment References`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PDF Row Reconstruction`** (2 nodes): `PDF Kos Survey Table Extraction`, `PDF Word Anchor Row Reconstruction`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Frontend Next Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Data Concatenation`** (1 nodes): `concat_data.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Playwright Config`** (1 nodes): `playwright.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Next Config`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CRUD E2E Spec`** (1 nodes): `crud.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CSS Types`** (1 nodes): `css.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backend App Package`** (1 nodes): `Backend App Package`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Generated Next Types`** (1 nodes): `Generated Next Type References`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Import array of {id, nama, lat, lon} objects. Upserts by id.` connect `Backend Parse Actions` to `Master UNS CRUD`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `bulk_import_master_uns()` connect `Master UNS CRUD` to `Backend Parse Actions`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `Clean Kos Schema` (e.g. with `Inline Clean Data Editors` and `Harga Editor`) actually correct?**
  _`Clean Kos Schema` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Periodic cleanup of old parse jobs every 10 minutes.`, `Idempotent seed script for kos collection.  Run:  uv run python -m app.seed`, `Strip non-digits; ensure leading 0 or 62 prefix.` to the rest of the system?**
  _92 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Parse Workspace` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Backend Parse Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Admin Prototype CRUD` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._