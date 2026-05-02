<!-- refreshed: 2026-05-02 -->
# Architecture

**Analysis Date:** 2026-05-02

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                   Browser / Admin Operators                 │
├─────────────────────────────┬───────────────────────────────┤
│ Public map app              │ Admin dashboard               │
│ `frontend/app/page.tsx`     │ `admin/app/kos/page.tsx`      │
│ `frontend/components/Map.tsx`│ `admin/app/actions/parse/page.tsx` │
└──────────────┬──────────────┴───────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API proxy layer                   │
│ `frontend/app/api/*/route.ts` · `admin/app/api/*/route.ts`   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI service layer                     │
│ `backend/app/main.py` includes `backend/app/routers/*.py`    │
├──────────────┬──────────────┬───────────────┬────────────────┤
│ Public reads │ Admin CRUD   │ Auth/JWT      │ Parse actions  │
│ `kos.py`     │ `admin_*.py` │ `auth.py`     │ `admin_actions.py` │
└──────────────┴──────┬───────┴───────┬───────┴────────────────┘
                      │               │
                      ▼               ▼
┌─────────────────────────────┐ ┌──────────────────────────────┐
│ MongoDB collections          │ │ LLM parse worker              │
│ `kos`, `master_uns`,         │ │ `backend/app/job_queue.py`    │
│ `parse_jobs`, `user_settings`│ │ `backend/app/parse_engine.py` │
└─────────────────────────────┘ └──────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Public map shell | Dynamically loads browser-only MapLibre component and avoids SSR map initialization | `frontend/app/page.tsx` |
| MapLibre map | Owns map state, markers, popups, route drawing, and browser-side normalization | `frontend/components/Map.tsx` |
| Clean map prototype | Renders reviewed structured kos data only for map prototype | `frontend/components/CleanMapPrototype.tsx` |
| Frontend public API proxies | Forward browser map requests to backend service and Google Routes | `frontend/app/api/kos/route.ts`, `frontend/app/api/master-uns/route.ts`, `frontend/app/api/directions/route.ts` |
| Admin API proxy helper | Adds JWT bearer token from cookies, refreshes expired access token, and mirrors backend responses | `admin/lib/backend.ts` |
| Admin route guard | Redirects protected `/kos`, `/master-uns`, `/actions` pages to `/login` when cookie missing | `admin/middleware.ts` |
| Admin CRUD pages | Manage kos and master UNS records through local Next API proxies | `admin/app/kos/page.tsx`, `admin/app/master-uns/page.tsx` |
| Parse workspace | Drives LLM parse, review, publish, local config, and job UX | `admin/app/actions/parse/page.tsx` |
| Background task indicator | Polls stored parse job IDs and shows completion banners | `admin/components/BackgroundTaskIndicator.tsx` |
| FastAPI factory | Configures lifecycle, error shape, routers, health endpoint | `backend/app/main.py` |
| DB connection singleton | Owns Motor client lifecycle and collection access | `backend/app/db.py` |
| Domain schemas | Defines Pydantic contracts for kos, clean parse output, master UNS, and persisted jobs | `backend/app/models.py` |
| Auth core | Owns JWT creation/validation, password checking, and in-memory login throttling | `backend/app/auth.py` |
| Public API routers | Expose read-only kos and master UNS endpoints | `backend/app/routers/kos.py`, `backend/app/routers/master_uns.py` |
| Admin API routers | Expose authenticated CRUD, imports, parse, review, LLM config | `backend/app/routers/admin_kos.py`, `backend/app/routers/admin_master_uns.py`, `backend/app/routers/admin_actions.py` |
| Parse job queue | Executes concurrent parse jobs, persists state, supports cancel/poll | `backend/app/job_queue.py` |
| LLM parse engine | Calls OpenAI-compatible providers, validates `KosClean`, repairs room notes | `backend/app/parse_engine.py` |
| Data pipeline scripts | Convert PDF/CSV/geocoding data into seed/frontend artifacts | `src/extract_pdf.py`, `src/geocoding_location.py`, `src/csv_to_json.py` |

## Pattern Overview

**Overall:** Three-application service architecture with Next.js BFF/proxy layers, FastAPI domain API, MongoDB document storage, and async background parse jobs.

**Key Characteristics:**
- Keep browser apps decoupled from backend hostnames by calling same-origin Next API routes in `frontend/app/api/*/route.ts` and `admin/app/api/*/route.ts`.
- Keep backend as source of truth for data validation and persistence with Pydantic schemas in `backend/app/models.py` and Motor collection access in `backend/app/db.py`.
- Use JWT access/refresh tokens for admin auth; store tokens in HTTP-only cookies from `admin/app/api/auth/login/route.ts`; refresh automatically in `admin/lib/backend.ts`.
- Run LLM parsing through an async job queue for bulk work and a direct endpoint for single-entry preview.
- Store parsed/review state directly on `kos` documents through fields defined in `backend/app/models.py`.
- Use project skill constraints when adding frontend code: avoid server waterfalls, avoid request-scoped module state, use dynamic import for heavy browser-only components, and keep `default="none"` for React view transitions when introduced.

## Layers

**Browser UI Layer:**
- Purpose: Render public map and admin management workflows.
- Location: `frontend/app/`, `frontend/components/`, `admin/app/`, `admin/components/`, `admin/hooks/`.
- Contains: Next App Router pages, client components, CSS modules, polling hooks, route-specific UI state.
- Depends on: Same-origin Next API routes, browser APIs (`localStorage`, `sessionStorage`, MapLibre), React state/effects.
- Used by: Users and admin operators in browsers.

**Next.js API Proxy Layer:**
- Purpose: Hide backend network topology, attach auth, normalize response handling, expose Google Directions proxy.
- Location: `frontend/app/api/`, `admin/app/api/`, `admin/lib/backend.ts`.
- Contains: Route handlers with thin `GET`/`POST`/`PUT`/`DELETE` functions.
- Depends on: `API_INTERNAL_URL`, admin cookies, backend FastAPI endpoints, Google Routes API.
- Used by: `fetch('/api/...')` calls in frontend/admin components.

**FastAPI Routing Layer:**
- Purpose: Define public and authenticated REST API surface.
- Location: `backend/app/routers/`.
- Contains: APIRouter modules grouped by domain (`kos`, `master_uns`, `auth`, `admin_*`, `admin_actions`).
- Depends on: `backend/app/db.py`, `backend/app/auth.py`, `backend/app/models.py`, `backend/app/job_queue.py`.
- Used by: Next API proxies and direct backend tests.

**Domain/Data Layer:**
- Purpose: Validate input/output shapes and map Mongo documents to API DTOs.
- Location: `backend/app/models.py`, mapper functions in `backend/app/routers/*.py`.
- Contains: `KosCreate`, `KosOut`, `KosClean`, `MasterUnsCreate`, `PersistedJob`, `_doc_to_kos()`, `_doc_to_out()`.
- Depends on: Pydantic, Mongo document conventions (`_id`, `location`, `updated_at`).
- Used by: FastAPI response validation and CRUD handlers.

**Persistence Layer:**
- Purpose: Manage MongoDB connection and collections.
- Location: `backend/app/db.py`.
- Contains: module-level Motor client/db singleton, `init_db()`, `close_db()`, `get_collection()`.
- Depends on: `MONGO_URL` from `backend/app/config.py`.
- Used by: all backend routers and job queue.

**Background Job Layer:**
- Purpose: Handle long-running LLM batch parsing with polling/cancel semantics.
- Location: `backend/app/job_queue.py`, `admin/hooks/useJobPoller.ts`, `admin/components/BackgroundTaskIndicator.tsx`.
- Contains: in-memory `_jobs` cache, Mongo `parse_jobs` persistence, per-item statuses, concurrency semaphore.
- Depends on: `backend/app/parse_engine.py`, Mongo `kos` and `parse_jobs` collections.
- Used by: `backend/app/routers/admin_actions.py` and admin parse UI.

**Legacy Data Pipeline Layer:**
- Purpose: Prepare source kos data outside the backend service runtime.
- Location: `src/`.
- Contains: PDF extraction, Google geocoding, duplicate checks, CSV/JSON conversion.
- Depends on: root `.env` existence and closed-source `data/` paths.
- Used by: manual/offline data refresh and seed workflows.

## Data Flow

### Public Map Data Path

1. Browser loads `frontend/app/page.tsx:5` and dynamically imports `frontend/components/Map.tsx` with `ssr: false`.
2. `Map` fetches kos records from same-origin `/api/kos` (`frontend/components/Map.tsx:436`).
3. Next route forwards to `${API_INTERNAL_URL}/api/kos` (`frontend/app/api/kos/route.ts:8`).
4. FastAPI reads `kos` collection sorted by name (`backend/app/routers/kos.py:36`).
5. `_doc_to_kos()` maps Mongo fields (`_id`, `jenis`, `lon`, `kontak`) to API fields (`id`, `jenis_kos`, `long`, `narahubung`) (`backend/app/routers/kos.py:16`).
6. `Map` normalizes coordinates and renders MapLibre markers/popups (`frontend/components/Map.tsx:296`).

### Public Directions Path

1. User requests a route from map UI (`frontend/components/Map.tsx:922`).
2. Browser posts origin/destination to `/api/directions` (`frontend/app/api/directions/route.ts:13`).
3. Next route validates coordinates and sends request to Google Routes `computeRoutes` (`frontend/app/api/directions/route.ts:50`).
4. Route handler returns `distanceMeters`, `duration`, and `encodedPolyline` (`frontend/app/api/directions/route.ts:107`).
5. Map decodes encoded polyline and draws a GeoJSON line layer (`frontend/components/Map.tsx:113`, `frontend/components/Map.tsx:342`).

### Admin Authenticated CRUD Path

1. Protected page access checks `admin_token` cookie in `admin/middleware.ts:16`.
2. Admin UI calls local route such as `/api/kos` from `admin/app/kos/page.tsx:86`.
3. Local route delegates to `proxyWithRetry()` (`admin/app/api/kos/route.ts:4`, `admin/lib/backend.ts:63`).
4. Proxy sends bearer token from `admin_token` cookie to backend (`admin/lib/backend.ts:85`).
5. Backend protected route applies `Depends(require_auth)` (`backend/app/routers/admin_kos.py:40`).
6. Router mutates Mongo and returns mapped DTO (`backend/app/routers/admin_kos.py:39`, `backend/app/routers/admin_kos.py:54`).
7. If backend returns 401, proxy uses `admin_refresh` to call `/api/auth/refresh`, retries, and resets `admin_token` (`admin/lib/backend.ts:89`).

### Bulk Parse Job Path

1. Admin parse page starts bulk parsing through `/api/actions/parse/bulk` (`admin/app/actions/parse/page.tsx:438`).
2. Next proxy forwards to backend (`admin/app/api/actions/parse/bulk/route.ts:4`).
3. Backend merges saved per-user LLM config with request override (`backend/app/routers/admin_actions.py:33`, `backend/app/routers/admin_actions.py:147`).
4. `create_job()` creates a `Job`, writes initial state to `parse_jobs`, and starts `_run_job()` task (`backend/app/job_queue.py:176`).
5. `_run_job()` schedules `_run_job_item()` tasks behind a semaphore (`backend/app/job_queue.py:431`).
6. `_run_job_item()` calls `parse_single_entry()` then updates the source `kos` document with `parsed_data` and `data_status=parsed` (`backend/app/job_queue.py:345`, `backend/app/job_queue.py:124`).
7. Admin polls `/api/actions/parse/jobs/{jobId}` via `useJobPoller()` (`admin/hooks/useJobPoller.ts:69`).
8. Review/publish updates data status through `/api/admin/actions/parse/review` (`backend/app/routers/admin_actions.py:257`).

### Data Pipeline Path

1. Extract PDF survey rows with `src/extract_pdf.py`.
2. Geocode/validate Surakarta coordinates with `src/geocoding_location.py:102`.
3. Convert cleaned CSV to frontend JSON with `src/csv_to_json.py:16`.
4. Seed backend Mongo from generated frontend data through `backend/app/seed.py` and Docker mount in `compose.yaml:319`.

**State Management:**
- Public map state is component-local React state and refs in `frontend/components/Map.tsx`.
- Admin page state is local React state; cross-page background job IDs are persisted in `localStorage` key `parse_jobs` in `admin/components/BackgroundTaskIndicator.tsx:6`.
- Backend DB readiness and Motor client are module-level singletons in `backend/app/db.py`.
- Parse jobs use process memory (`_jobs`) plus Mongo `parse_jobs` persistence in `backend/app/job_queue.py`.

## Key Abstractions

**`KosClean`:**
- Purpose: Structured, reviewed LLM output contract for clean kos data.
- Examples: `backend/app/models.py:60`, `frontend/components/Map.tsx:55`, `admin/app/actions/parse/page.tsx:57`.
- Pattern: Duplicate TypeScript interface mirrors backend Pydantic model; keep field names stable.

**`proxyWithRetry()`:**
- Purpose: Single admin BFF helper for authenticated backend proxying and token refresh.
- Examples: `admin/lib/backend.ts:63`, `admin/app/api/kos/route.ts:4`, `admin/app/api/actions/parse/review/route.ts`.
- Pattern: Route handlers stay one-line wrappers; add new admin backend endpoints through this helper.

**`Job`:**
- Purpose: Runtime and persisted representation of a background parse job.
- Examples: `backend/app/job_queue.py:19`, `admin/hooks/useJobPoller.ts:17`.
- Pattern: Server owns job state; UI polls and reacts to status changes.

**Document mappers:**
- Purpose: Convert Mongo internals into API shapes.
- Examples: `backend/app/routers/kos.py:16`, `backend/app/routers/admin_kos.py:19`, `backend/app/routers/master_uns.py:13`.
- Pattern: Keep Mongo-only fields (`location`, `updated_at`, `_id`) out of public DTOs.

**Configuration loader:**
- Purpose: Convert environment variables to typed runtime config.
- Examples: `backend/app/config.py:7`, `backend/app/config.py:37`.
- Pattern: Call `load_config()` from backend code; do not read env vars ad hoc except operational tuning like `PARSE_JOB_CONCURRENCY` in `backend/app/job_queue.py:88`.

## Entry Points

**Public frontend:**
- Location: `frontend/app/page.tsx`.
- Triggers: Browser request to `/` on public web app.
- Responsibilities: Render MapLibre app without SSR by dynamic-importing `frontend/components/Map.tsx`.

**Admin frontend:**
- Location: `admin/app/layout.tsx`, `admin/app/kos/page.tsx`, `admin/app/master-uns/page.tsx`, `admin/app/actions/parse/page.tsx`.
- Triggers: Browser route navigation in admin app.
- Responsibilities: Provide navigation chrome, protected CRUD, parse/review workspaces, and background job status.

**Admin middleware:**
- Location: `admin/middleware.ts`.
- Triggers: Requests matching `/kos/:path*`, `/master-uns/:path*`, `/actions/:path*`.
- Responsibilities: Redirect unauthenticated browser sessions to `/login`.

**Backend service:**
- Location: `backend/app/main.py:49`, `backend/app/main.py:77`.
- Triggers: ASGI server import and FastAPI lifespan startup.
- Responsibilities: Initialize DB, register routers, expose `/health`, run parse-job cleanup loop.

**Offline scripts:**
- Location: `src/*.py`, `backend/app/seed.py`, `backend/app/seed_master_uns.py`.
- Triggers: Manual `uv run python ...` commands.
- Responsibilities: Build generated data artifacts and seed Mongo collections.

## Architectural Constraints

- **Threading:** Backend uses single asyncio event loop with Motor async I/O. Bulk parse uses `asyncio.create_task()` and `asyncio.Semaphore` in `backend/app/job_queue.py`; jobs are process-local and not distributed across replicas.
- **Global state:** `backend/app/db.py` holds `_client`, `_db`, `_ready`; `backend/app/job_queue.py` holds `_jobs` and `_lock`; `backend/app/auth.py` holds in-memory `_fail_counts`. Treat these as per-process only.
- **Circular imports:** `backend/app/main.py:_cleanup_loop()` imports `cleanup_old_jobs` inside function to avoid startup import coupling. Keep queue imports out of module top level when they create cycles.
- **Data source:** MongoDB is source of truth for runtime APIs; root `src/` scripts and `frontend/public/data/` are data-prep artifacts, not service runtime.
- **Secrets:** Env files exist at repo root and are consumed by Docker/profile config. Never read or commit `.env*` values.
- **Next.js browser-only code:** MapLibre components must remain client-only/dynamic (`frontend/app/page.tsx:5`) because they depend on browser APIs.
- **Admin auth boundary:** Middleware only checks cookie existence; backend `require_auth` in `backend/app/auth.py:70` is required for authorization.
- **Skill-defined frontend constraints:** For new Next/React work, avoid duplicate global listeners, avoid request-scoped module state, version/minimize localStorage payloads, and use direct imports or Next package import optimization.

## Anti-Patterns

### Bypassing Next API Proxies

**What happens:** UI components call backend hosts directly instead of same-origin `/api/*` routes.
**Why it's wrong:** It bypasses `admin/lib/backend.ts` token refresh, leaks topology, and breaks Docker profile hostnames.
**Do this instead:** Add a route under `admin/app/api/.../route.ts` using `proxyWithRetry()` or under `frontend/app/api/.../route.ts` for public map needs.

### Adding Auth Only in Admin Middleware

**What happens:** A new backend mutation trusts `admin/middleware.ts` or page visibility.
**Why it's wrong:** Next route handlers and FastAPI endpoints are public HTTP endpoints; middleware does not protect direct backend calls.
**Do this instead:** Add `username: str = Depends(require_auth)` to protected FastAPI handlers like `backend/app/routers/admin_kos.py:40`.

### Duplicating Long-Lived Request State in Module Scope

**What happens:** New server/route code stores request user, request body, or per-user data in module-level variables.
**Why it's wrong:** Module scope is shared across requests and users in Next/FastAPI workers.
**Do this instead:** Keep request data inside handler scope; only immutable config or keyed caches belong at module scope, matching `backend/app/config.py` and `admin/lib/backend.ts` patterns.

### Writing New Parse Logic Only in TypeScript

**What happens:** Admin UI normalizes parsed data differently from backend schema.
**Why it's wrong:** `backend/app/models.py:60` and `backend/app/parse_engine.py:503` define the authoritative clean-data contract.
**Do this instead:** Update `KosClean` in `backend/app/models.py` first, then mirror types in `admin/app/actions/parse/page.tsx` and `frontend/components/Map.tsx`.

## Error Handling

**Strategy:** Backend raises `HTTPException` with `detail={"error": ...}` and `backend/app/main.py:52` normalizes uncaught exceptions to `{"error":"Internal server error"}`. Next proxies preserve backend status and JSON body.

**Patterns:**
- Use `HTTPException(status_code=..., detail={"error": "..."})` in backend routers (`backend/app/routers/admin_kos.py:63`).
- In admin API proxies, return `buildNextResponse()` from `admin/lib/backend.ts:36` instead of custom response conversion.
- In frontend public proxies, fail closed with empty arrays for map read endpoints (`frontend/app/api/kos/route.ts:19`).
- In job processing, catch per-item exceptions and record item errors without failing the entire job (`backend/app/job_queue.py:404`).

## Cross-Cutting Concerns

**Logging:** Backend uses Python `logging` configured in `backend/app/main.py:13`. Parse/job code logs structured key-value messages in `backend/app/parse_engine.py` and `backend/app/job_queue.py`.
**Validation:** Backend Pydantic models in `backend/app/models.py` validate request/response data. Next route handlers validate only edge-specific payloads like directions coordinates in `frontend/app/api/directions/route.ts:36`.
**Authentication:** Backend JWT validation in `backend/app/auth.py`; admin Next stores cookies in `admin/app/api/auth/login/route.ts`; `admin/lib/backend.ts` performs bearer injection and refresh retry.
**Configuration:** Backend env config flows through `backend/app/config.py`; frontend/admin service discovery uses `API_INTERNAL_URL`; Docker profiles wire URLs in `compose.yaml`.
**Graphify context:** Graph report identifies `_call_llm()`, `getErrorMessage()`, clean-data workspace, `Clean Kos Schema`, `_run_job_item()`, `Config`, `parse_single_entry()`, and background queue as central abstractions in `graphify-out/GRAPH_REPORT.md`.

---

*Architecture analysis: 2026-05-02*
