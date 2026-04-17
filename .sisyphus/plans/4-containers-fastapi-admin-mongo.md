# 4 Containers (Dev-first): frontend + admin + backend(FastAPI+uv) + mongodb

## TL;DR
> **Summary**: Expand dev docker-compose from frontend-only to 4 services. Add new FastAPI backend + new Next.js admin UX (CRUD kos) backed by MongoDB. Switch public frontend map to read kos data from backend API (via Next proxy routes). LLM parsing: UX + API stubs only.
> **Deliverables**:
> - `compose.yaml` dev profile runs 4 containers
> - `backend/` FastAPI app (uv) + Mongo connection + seed from existing JSON + CRUD + auth
> - `admin/` Next.js app: login (simple password) + kos CRUD UX + action-parsing UX stub
> - `frontend/` reads kos list from backend (no static JSON fetch in Map)
> **Effort**: Large
> **Parallel**: YES — 3 waves
> **Critical Path**: Compose+mMongo → backend scaffold+seed+API → frontend switch + admin auth+CRUD

## Context
### Original Request
- 4 containers: frontend, backend, admin dashboard, mongodb
- admin dashboard: CRUD data + integrasi LLM buat action parsing (logic nanti, fokus UX dulu)

### Interview Summary (decisions locked)
- Backend: **FastAPI + uv**
- Admin app: **Next.js app terpisah** (container sendiri)
- Admin auth: **simple password**
- CRUD v1 scope: **Kos saja**
- Frontend data source: **backend API**
- Compose target: **dev-first only** (prod/staging untouched for now)

### Repo Facts (grounded)
- Existing compose: `compose.yaml` has only frontend services (`web_dev`, `web_prod`, `web_staging`). Dev binds to `frontend/` and runs `npm run dev -p 3000`.
  - Reference: `compose.yaml:3-82`
- Frontend static data used by Map:
  - `frontend/components/Map.tsx:333-353` fetches `/data/data_kost_geo.json`
  - `frontend/public/data/data_kost_geo.json` + `master_uns.json` exist
  - Note: these JSON are **gitignored** (dataset close-source). Dev seed must tolerate file missing.
- Pattern for Next server API route already exists: `frontend/app/api/directions/route.ts` uses env + `NextResponse.json`.
  - Reference: `frontend/app/api/directions/route.ts:1-112`
- Backend scaffold already exists in current working tree:
  - `backend/pyproject.toml` (uv deps include fastapi/motor/passlib/pytest)
  - `backend/Dockerfile.dev` (uv sync + uvicorn reload)
  - `backend/app/main.py` exposes `/health` (returns `{status:"ok", db:"unknown"}`)
  - `backend/app/config.py` requires env: `MONGO_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_BCRYPT`, `JWT_EXPIRE_MINUTES`
  - Implication: compose **must** set these env vars or backend will crash at startup.
- Frontend docker build assets exist in working tree: `frontend/Dockerfile`, `frontend/.dockerignore`.
- Repo still has no Mongo wiring, no kos CRUD endpoints, no admin app yet.

### Metis Review (gaps addressed)
- Guardrails: no LLM logic, no RBAC/uploads. Auth footguns avoided via bcrypt+HttpOnly cookie + backend auth enforcement.
- Seed must be idempotent; deterministic key; report inserted/updated/skipped.
- Avoid CORS trap: use Next proxy routes for frontend + admin.

## Work Objectives
### Core Objective
Dev compose boots 4 containers. Data source-of-truth Mongo. Admin CRUD updates Mongo. Frontend reads same data via backend.

### Deliverables
1. Dev compose: `docker compose --profile development up -d --build` brings up:
   - `web_dev` (frontend) @ http://localhost:3000
   - `admin_dev` (admin) @ http://localhost:3001
   - `backend_dev` (FastAPI) @ http://localhost:8000
   - `mongodb` (internal, volume)
2. `backend/` FastAPI app (uv):
   - `/health`
   - public `GET /api/kos`, `GET /api/kos/{id}`
   - admin `POST/PUT/DELETE /api/admin/kos...` (JWT required)
   - `POST /api/auth/login` returns JWT
   - seed command imports `frontend/public/data/data_kost_geo.json` → Mongo upsert
3. `admin/` Next.js app:
   - `/login` password login
   - `/kos` list + create + edit + delete
   - `/actions/parse` UX stub (backend returns 501 or placeholder)
4. `frontend/` Map fetches kos list from `/api/kos` (Next proxy), not `/public/data/*.json`.

### Definition of Done (verifiable)
- Compose boot:
  - `docker compose --profile development up -d --build`
  - `docker compose ps` shows 4 services running; `mongodb` + `backend_dev` healthy.
- Backend:
  - `curl -sS localhost:8000/health | jq -e '.status=="ok"'`
  - Seed: run seed command twice;
    - If dataset present: `curl -sS localhost:8000/api/kos | jq -e 'type=="array" and length>0'`
    - If dataset absent: seed exits 0 with "seed skipped"; then create 1 kos via admin; then `curl -sS localhost:8000/api/kos | jq -e 'length>=1'`
  - Unauthorized admin write blocked: `curl -sS -o /dev/null -w "%{http_code}" -X POST localhost:8000/api/admin/kos` → `401`/`403`
- Frontend:
  - `curl -sS -o /dev/null -w "%{http_code}" localhost:3000` → `200`
  - `curl -sS localhost:3000/api/kos | jq -e 'length>0'`
- Admin:
  - `curl -sS -o /dev/null -w "%{http_code}" localhost:3001/login` → `200`
  - Playwright e2e: login → create kos (test data) → appears in list → edit → delete.

### Must Have
- Mongo not published to host by default.
- Admin auth: bcrypt hash in env, JWT, HttpOnly cookie on admin domain, backend enforces auth on write routes.
- Seed idempotent.
- Seed works even when dataset files absent (prints clear message, exits 0, backend still boots with empty DB).
- No LLM logic (only API contract + UX placeholders).

### Must NOT Have (guardrails)
- No prod/staging compose refactor (keep existing `web_prod/web_staging` intact).
- No RBAC, multi-user, uploads, audit logs, complex filters.
- No plaintext passwords committed.
- No direct browser-to-backend admin calls (avoid cross-origin cookie/CORS/CSRF mess). Admin uses server proxy routes.
- Do NOT commit local-only artifacts: `.sisyphus/**`, `.opencode/**`, `frontend/tsconfig.tsbuildinfo`, `graphify-out/**`, close-source JSON datasets.

## Verification Strategy
- Test decision: **tests-after** (minimal) + smoke checks.
  - Backend: `pytest` minimal for auth + seed idempotency (DB mocked or test db).
  - Admin: Playwright for core CRUD UX.
- Evidence: save outputs/screenshots to `.sisyphus/evidence/task-{N}-{slug}.*`.

## Execution Strategy
### Parallel Execution Waves
Wave 1 (foundation): compose + backend scaffold + admin scaffold (parallel)
Wave 2 (data+API): mongo wiring + seed + public API + frontend switch
Wave 3 (admin): auth + CRUD UX + action-parse UX stub + e2e tests

### Dependency Matrix (summary)
- Compose dev services (Task 1) blocks local verification of all.
- Backend scaffold (Task 2) blocks API/seed/auth.
- Admin scaffold (Task 3) blocks admin UX/auth.
- Mongo wiring (Task 4) blocks seed + CRUD.
- Seed + kos model (Task 5) blocks frontend data switch.
- Public API (Task 6) blocks frontend + admin list.
- Frontend switch (Task 7) blocks “single source of truth” goal.
- Auth (Task 8) blocks admin write routes.
- Admin CRUD UX (Task 9) depends on Tasks 6+8.

## TODOs

- [ ] 1. Extend `compose.yaml` dev profile to 4 services

  **What to do**:
  - Keep existing `web_dev` unchanged as much as possible (`compose.yaml:64-82`).
  - Add services under profile `development`:
    - `mongodb` (image `mongo:7`), named volume `mongo_data:/data/db`, **no ports**.
    - `backend_dev` (build from `./backend`, dev command runs uvicorn reload, port `8000:8000`).
    - `admin_dev` (node:20-slim dev container bind-mount `./admin`, port `3001:3001`, named volumes for node_modules + .next).
  - Networks: reuse existing `semar_dev` for all dev services.
  - Backend volumes:
    - bind mount backend code: `./backend:/app`
    - bind mount seed data (read-only): `./frontend/public/data:/seed-data:ro`
  - Backend env:
    - `MONGO_URL=mongodb://mongodb:27017/semar_kos`
    - `JWT_SECRET=dev_change_me`
    - `JWT_EXPIRE_MINUTES=60`
    - `ADMIN_USERNAME=admin`
    - `ADMIN_PASSWORD_BCRYPT=<bcrypt hash>`
  - Use `env_file: ./.env.development` for **web_dev + admin_dev + backend_dev** so one place to set secrets.
    - Update `.env.development.example` to include placeholders for backend/admin vars.
  - Frontend env:
    - `API_INTERNAL_URL=http://backend_dev:8000`
  - Admin env:
    - `API_INTERNAL_URL=http://backend_dev:8000`
  - File watching in Docker (Node):
    - set `CHOKIDAR_USEPOLLING=1` and `WATCHPACK_POLLING=true` on `web_dev` and `admin_dev`.
  - Healthchecks:
    - mongo: `mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok"`
    - backend: python stdlib GET `http://127.0.0.1:8000/health`:
      - `python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health').read();"`
    - frontend/admin: node `net.connect` pattern like existing healthcheck (no curl).
  - `depends_on` with `condition: service_healthy` for backend->mongo, frontend/admin->backend.

  **Must NOT do**: change `web_prod/web_staging` behavior.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: compose orchestration + healthchecks.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4-11 | Blocked By: none

  **References**:
  - Existing compose patterns: `compose.yaml:3-82`

  **Acceptance Criteria**:
  - [ ] `docker compose --profile development config` succeeds
  - [ ] Evidence: `.sisyphus/evidence/task-1-compose-config.txt`

  **QA Scenarios**:
  ```
  Scenario: Compose validates
    Tool: Bash
    Steps: docker compose --profile development config
    Expected: exit 0
    Evidence: .sisyphus/evidence/task-1-compose-config.txt

  Scenario: Services start (pre-app)
    Tool: Bash
    Steps: docker compose --profile development up -d --build && docker compose ps
    Expected: services created; statuses not erroring
    Evidence: .sisyphus/evidence/task-1-compose-ps.txt
  ```

  **Commit**: YES | Message: `chore(compose): add dev services for admin backend mongo` | Files: [`compose.yaml`]


- [ ] 2. Create backend FastAPI scaffold with uv + `/health`

- [ ] 2. Verify/extend existing backend FastAPI scaffold (uv) + `/health`

  **What to do**:
   - Treat `backend/` as baseline (already present). Do NOT recreate files; only adjust as needed.
   - Ensure `backend/app/__init__.py` exists so `app.*` imports stable.
   - Confirm `backend/pyproject.toml` contains required deps (already includes: fastapi, uvicorn, motor, pydantic, python-dotenv, python-jose, passlib[bcrypt], pydantic-settings, orjson, pytest, pytest-asyncio).
   - Keep `backend/Dockerfile.dev` pattern (uv install + `uv sync` + `uvicorn --reload`).
   - `/health` stays `{status:"ok"}` and includes `db:"unknown"` until Task 4 upgrades it.

  **Auth defaults (dev)**:
  - `ADMIN_USERNAME=admin`
  - Dev password locked: `admin123` (bcrypt stored in `.env.development`, never committed)
  - Generate bcrypt (inside backend container after deps installed):
    - Command (inside backend container after deps installed):
    - `uv run python -c "from passlib.hash import bcrypt; print(bcrypt.hash('admin123'))"`

  **Must NOT do**: implement kos endpoints yet.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: new backend app scaffolding.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4-6,8 | Blocked By: none

  **References**:
  - Env pattern: `.env.example:1-5`

  **Acceptance Criteria**:
  - [ ] `docker compose --profile development up -d --build backend_dev` works
  - [ ] `curl -sS localhost:8000/health | jq -e '.status=="ok"'`

  **QA Scenarios**:
  ```
  Scenario: Health endpoint reachable
    Tool: Bash
    Steps: curl -sS localhost:8000/health
    Expected: JSON with status=ok
    Evidence: .sisyphus/evidence/task-2-backend-health.json

  Scenario: Reload works
    Tool: Bash
    Steps: touch backend/app/main.py && docker compose logs --since=10s backend_dev
    Expected: uvicorn reload message appears
    Evidence: .sisyphus/evidence/task-2-backend-reload.log
  ```

  **Commit**: YES | Message: `feat(backend): scaffold fastapi app with uv and health` | Files: [`backend/**`]


- [ ] 3. Create admin Next.js scaffold (separate app) running on 3001

  **What to do**:
  - Create `admin/` Next.js (App Router, TypeScript).
  - Provide pages:
    - `/login` (form)
    - `/` redirects to `/kos`
    - `/kos` placeholder list page
    - `/actions/parse` placeholder UX page
  - Add minimal styling (CSS modules). No UI library.
  - Add `admin/package.json` scripts: `dev`, `build`, `start`.
  - Add `admin/Dockerfile` (prod later optional) + dev compose runs node image with `npm ci` + `npm run dev -- -p 3001 -H 0.0.0.0`.

  **Must NOT do**: implement real auth yet.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: UX-first admin skeleton.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 8-10 | Blocked By: none

  **References**:
  - Frontend Next pattern: `frontend/app/page.tsx:1-11`

  **Acceptance Criteria**:
  - [ ] `docker compose --profile development up -d --build admin_dev`
  - [ ] `curl -sS -o /dev/null -w "%{http_code}" localhost:3001/login` returns `200`

  **QA Scenarios**:
  ```
  Scenario: Admin boots
    Tool: Bash
    Steps: curl -sS -o /dev/null -w "%{http_code}" http://localhost:3001/login
    Expected: 200
    Evidence: .sisyphus/evidence/task-3-admin-login-httpcode.txt

  Scenario: Admin route reachable
    Tool: Bash
    Steps: curl -sS -o /dev/null -w "%{http_code}" http://localhost:3001/kos
    Expected: 200
    Evidence: .sisyphus/evidence/task-3-admin-kos-httpcode.txt
  ```

  **Commit**: YES | Message: `feat(admin): scaffold nextjs admin app` | Files: [`admin/**`]


- [ ] 4. Add MongoDB wiring + backend DB connection + retry

  **What to do**:
  - Backend: create `backend/app/db.py`:
    - `MotorClient` using `MONGO_URL`
    - expose `get_db()` / `get_collection("kos")`
    - on startup: retry ping up to N seconds; set internal ready flag.
  - Update `/health` to include `db: "ok"|"down"`.
  - Compose: ensure backend env has `MONGO_URL=mongodb://mongodb:27017/semar_kos`.

  **Must NOT do**: expose mongo port to host.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: async DB wiring + container startup ordering.
  - Skills: []

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 5-6 | Blocked By: 1,2

  **References**:
  - Compose service DNS approach (Oracle): use `mongodb` hostname.

  **Acceptance Criteria**:
  - [ ] `curl -sS localhost:8000/health | jq -e '.db=="ok"'`

  **QA Scenarios**:
  ```
  Scenario: DB ok
    Tool: Bash
    Steps: curl -sS localhost:8000/health
    Expected: includes db=ok
    Evidence: .sisyphus/evidence/task-4-health-db.json

  Scenario: DB down handling
    Tool: Bash
    Steps: docker compose stop mongodb && sleep 2 && curl -sS localhost:8000/health
    Expected: db=down (still responds)
    Evidence: .sisyphus/evidence/task-4-health-db-down.json
  ```

  **Commit**: YES | Message: `feat(db): connect fastapi to mongodb with health and retry` | Files: [`backend/**`, `compose.yaml`]


- [ ] 5. Define Kos model + idempotent seed from existing JSON

  **What to do**:
  - Decide canonical API/DB fields (match frontend expectations):
    - `id` (string), `nama`, `jenis`, `alamat`, `harga`, `fasilitas`, `peraturan`, `kontak`, `lat`, `lon`
    - plus DB-only `location` GeoJSON.
  - Deterministic upsert key `source_id`:
    - `sha256(lower(nama)+"|"+lower(alamat)+"|"+normalize_kontak(kontak))`
  - Backend seed module: `backend/app/seed.py` runnable:
    - input file path default: `/seed-data/data_kost_geo.json`
    - if file missing: print "seed skipped: dataset not present" + exit 0 (no exception)
    - parse + validate types (lat/lon string->float)
    - upsert by `source_id` (set `updated_at`)
    - print report counts
    - create indexes: unique `source_id`, `2dsphere` on `location`.
  - Seed command (document):
    - `docker compose --profile development run --rm backend_dev uv run python -m app.seed`

  **Must NOT do**: delete collection on seed.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: data mapping + idempotent upsert.
  - Skills: []

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 6-7,9 | Blocked By: 4

  **References**:
  - Seed source: `frontend/public/data/data_kost_geo.json`
  - Existing frontend field usage: `frontend/components/Map.tsx:6-14` (Kos type)

  **Acceptance Criteria**:
  - [ ] Seed twice; counts stable; backend stays healthy.
  - [ ] Evidence: `.sisyphus/evidence/task-5-seed-run-1.txt`, `task-5-seed-run-2.txt`

  **QA Scenarios**:
  ```
  Scenario: Seed idempotent
    Tool: Bash
    Steps:
      - docker compose --profile development run --rm backend_dev uv run python -m app.seed
      - docker compose --profile development run --rm backend_dev uv run python -m app.seed
      - curl -sS localhost:8000/api/kos | jq 'length'
    Expected: second seed does not increase count unexpectedly; command exits 0
    Evidence: .sisyphus/evidence/task-5-seed-idempotent.txt

  Scenario: Bad row handling
    Tool: Bash
    Steps: run seed with a temp modified JSON containing invalid lat/lon
    Expected: seed reports skipped/rejected rows; exits 0 with warning
    Evidence: .sisyphus/evidence/task-5-seed-bad-row.txt
  ```

  **Commit**: YES | Message: `feat(seed): add kos model and idempotent mongo seed from json` | Files: [`backend/**`]


- [ ] 6. Implement backend Kos API (public read + admin write)

  **What to do**:
  - Public:
    - `GET /api/kos` returns array of Kos DTO (fields above)
    - `GET /api/kos/{id}` returns single or 404
  - Admin (JWT required):
    - `POST /api/admin/kos` create
    - `PUT /api/admin/kos/{id}` update
    - `DELETE /api/admin/kos/{id}` delete
  - Validation: Pydantic schemas. Store floats for lat/lon.
  - Sorting: default by `nama`.
  - Error shape consistent: `{error: string}`.

  **Must NOT do**: add complex filtering/pagination now.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: API design + DB operations.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7,9 | Blocked By: 5

  **References**:
  - Existing Next API error pattern: `frontend/app/api/directions/route.ts:17-45`

  **Acceptance Criteria**:
  - [ ] `curl -sS localhost:8000/api/kos | jq -e 'length>0'`
  - [ ] `curl -sS -o /dev/null -w "%{http_code}" localhost:8000/api/kos/badid` → `404`

  **QA Scenarios**:
  ```
  Scenario: List kos
    Tool: Bash
    Steps: curl -sS localhost:8000/api/kos
    Expected: JSON array with objects containing nama, lat, lon
    Evidence: .sisyphus/evidence/task-6-kos-list.json

  Scenario: Get kos not found
    Tool: Bash
    Steps: curl -sS -o /dev/null -w "%{http_code}" localhost:8000/api/kos/000000000000000000000000
    Expected: 404
    Evidence: .sisyphus/evidence/task-6-kos-404.txt
  ```

  **Commit**: YES | Message: `feat(api): add kos read and admin write endpoints` | Files: [`backend/**`]


- [ ] 7. Switch public frontend Map to backend API via Next proxy route

  **What to do**:
  - Add `frontend/app/api/kos/route.ts`:
    - reads backend base URL from `API_INTERNAL_URL` (compose sets `http://backend_dev:8000`)
    - fetches `GET ${base}/api/kos` and returns JSON
  - Update `frontend/components/Map.tsx`:
    - replace `fetch("/data/data_kost_geo.json")` with `fetch("/api/kos")`
    - Keep mapping logic backward-compatible for 1 release:
      - Accept both current RawKos shape and new backend DTO shape.
      - Prefer backend DTO when keys present.
  - Keep `frontend/public/data/*.json` files for now (seed source + fallback).
  - NOTE: dataset files are gitignored; frontend must not depend on them after switch.

  **Must NOT do**: break directions API route.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: small Next route + single fetch change.
  - Skills: []

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: none | Blocked By: 6

  **References**:
  - Proxy route pattern: `frontend/app/api/directions/route.ts:13-112`
  - Current static fetch: `frontend/components/Map.tsx:333-353`

  **Acceptance Criteria**:
  - [ ] `curl -sS localhost:3000/api/kos | jq -e 'length>0'`

  **QA Scenarios**:
  ```
  Scenario: Frontend proxy returns data
    Tool: Bash
    Steps: curl -sS http://localhost:3000/api/kos
    Expected: JSON array length > 0
    Evidence: .sisyphus/evidence/task-7-frontend-kos-proxy.json

  Scenario: Map page still serves
    Tool: Bash
    Steps: curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000
    Expected: 200
    Evidence: .sisyphus/evidence/task-7-frontend-home-httpcode.txt
  ```

  **Commit**: YES | Message: `feat(frontend): load kos data from backend via api proxy` | Files: [`frontend/**`]


- [ ] 8. Implement backend auth + admin session (simple password)

  **What to do**:
  - Backend:
    - env: `ADMIN_USERNAME`, `ADMIN_PASSWORD_BCRYPT`, `JWT_SECRET`, `JWT_EXPIRE_MINUTES`.
    - `POST /api/auth/login` accepts `{username,password}`.
      - verify username equals env
      - verify password with bcrypt
      - return JWT `{access_token, token_type:"bearer"}`
    - auth dependency validates JWT for `/api/admin/*` routes.
    - minimal rate limit: per-IP counters in memory; after N failures: sleep/backoff + 429.
  - Admin Next:
    - `admin/app/api/auth/login/route.ts`: calls backend login; sets HttpOnly cookie `admin_token`.
    - `admin/app/api/auth/logout/route.ts`: clears cookie.
    - `admin/middleware.ts`: protect `/kos` and `/actions` routes; redirect to `/login` if no cookie.

  **Must NOT do**: store JWT in localStorage.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: auth security + cookie/middleware.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 9-10 | Blocked By: 6,3

  **References**:
  - Admin auth decision: simple password.
  - Next server route pattern: `frontend/app/api/directions/route.ts:13-45`

  **Acceptance Criteria**:
  - [ ] Unauth admin routes redirect to `/login`.
  - [ ] Backend rejects admin write without JWT.
  - [ ] Backend login returns JWT:
    - `curl -sS -X POST http://localhost:8000/api/auth/login -H 'content-type: application/json' -d '{"username":"admin","password":"admin123"}' | jq -e '.access_token|type=="string" and length>10'`

  **QA Scenarios**:
  ```
  Scenario: Backend blocks unauth write
    Tool: Bash
    Steps: curl -sS -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/admin/kos
    Expected: 401 or 403
    Evidence: .sisyphus/evidence/task-8-backend-unauth-post.txt

  Scenario: Admin login sets cookie
    Tool: Bash
    Steps:
      - curl -sS -i -X POST http://localhost:3001/api/auth/login -H 'content-type: application/json' -d '{"username":"admin","password":"wrong"}' > .sisyphus/evidence/task-8-admin-login-wrong.txt
    Expected: 401 and no Set-Cookie admin_token
    Evidence: .sisyphus/evidence/task-8-admin-login-wrong.txt

  Scenario: Admin login happy path
    Tool: Bash
    Steps:
      - curl -sS -i -X POST http://localhost:3001/api/auth/login -H 'content-type: application/json' -d '{"username":"admin","password":"admin123"}' > .sisyphus/evidence/task-8-admin-login-happy.txt
      - grep -i "set-cookie: admin_token" .sisyphus/evidence/task-8-admin-login-happy.txt
    Expected: 200 and Set-Cookie admin_token present
    Evidence: .sisyphus/evidence/task-8-admin-login-happy.txt
  ```

  **Commit**: YES | Message: `feat(auth): add simple password login and protect admin routes` | Files: [`backend/**`, `admin/**`]


- [ ] 9.1 Lock action-parse stub response shape (decision) + implement consistently

  **What to do**:
  - Choose response behavior: **501** with stable JSON body:
    - HTTP `501`
    - body:
      ```json
      {
        "error": "Not implemented",
        "expected_format": {
          "action": "upsert_kos",
          "payload": {
            "nama": "string",
            "jenis": "Putra|Putri|Campuran|Tidak diketahui",
            "alamat": "string",
            "harga": "string",
            "fasilitas": "string",
            "peraturan": "string",
            "kontak": "string",
            "lat": -7.55,
            "lon": 110.85
          }
        }
      }
      ```
  - Apply same shape in backend stub endpoint and admin UI renderer.

  **Must NOT do**: return varying shapes.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: pure contract + stub consistency.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 10 | Blocked By: 8

  **References**:
  - Stub endpoint planned: `POST /api/admin/actions/parse`

  **Acceptance Criteria**:
  - [ ] `curl` to endpoint returns 501 + JSON with keys `error` and `expected_format`.

  **QA Scenarios**:
  ```
  Scenario: Contract stable
    Tool: Bash
    Steps:
      - TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login -H 'content-type: application/json' -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)
      - curl -sS -D - -o .sisyphus/evidence/task-9-1-parse-contract.json -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"input":"ubah harga kos wisma azima jadi 1.5jt"}' http://localhost:8000/api/admin/actions/parse
    Expected: 501 + JSON includes expected_format.payload.lat and lon numbers
    Evidence: .sisyphus/evidence/task-9-1-parse-contract.json
  ```

  **Commit**: YES | Message: `chore(api): lock action-parse stub response contract` | Files: [`backend/**`, `admin/**`]


- [ ] 9. Build admin Kos CRUD UX (list/create/edit/delete)

  **What to do**:
  - Admin pages:
    - `/kos` list table (nama, jenis, harga, kontak) + search (client-side only) + actions edit/delete.
    - `/kos/new` form
    - `/kos/[id]/edit` form
  - Admin API proxy routes (server-side):
    - `admin/app/api/kos/route.ts` (GET list, POST create)
    - `admin/app/api/kos/[id]/route.ts` (GET one, PUT, DELETE)
    - Each reads `admin_token` cookie and forwards to backend `/api/admin/kos*` with `Authorization: Bearer`.
  - UX: optimistic disabled states + error banners.
  - Delete confirmation modal.

  **Must NOT do**: bulk upload, images, advanced filters.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: UX-first CRUD.
  - Skills: []

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 11 | Blocked By: 8,6

  **References**:
  - Frontend uses these fields in popup: `frontend/components/Map.tsx:452-492` (harga/fasilitas/kontak)

  **Acceptance Criteria**:
  - [ ] After login, can create kos and see it in list.
  - [ ] Edit updates fields.
  - [ ] Delete removes entry.

  **QA Scenarios**:
  ```
  Scenario: Admin CRUD via HTTP (cookie + proxy)
    Tool: Bash
    Steps:
      - Login cookie jar:
        curl -sS -c /tmp/admin.cookies -X POST http://localhost:3001/api/auth/login -H 'content-type: application/json' -d '{"username":"admin","password":"admin123"}'
      - Create:
        curl -sS -b /tmp/admin.cookies -X POST http://localhost:3001/api/kos -H 'content-type: application/json' -d '{"nama":"E2E Kos Curl","jenis":"Putri","alamat":"Test Address","harga":"1000000/bulan","fasilitas":"WIFI","peraturan":"-","kontak":"https://wa.me/628111111111","lat":-7.55,"lon":110.85}'
      - Extract id:
        ID=$(curl -sS -b /tmp/admin.cookies http://localhost:3001/api/kos | jq -r 'map(select(.nama=="E2E Kos Curl"))|.[0].id')
      - Update:
        curl -sS -b /tmp/admin.cookies -X PUT http://localhost:3001/api/kos/$ID -H 'content-type: application/json' -d '{"harga":"2000000/bulan"}'
      - Delete:
        curl -sS -b /tmp/admin.cookies -X DELETE http://localhost:3001/api/kos/$ID
    Expected: create 201, update 200, delete 204
    Evidence: .sisyphus/evidence/task-9-admin-crud-curl.txt

  Scenario: Validation error
    Tool: Bash
    Steps: curl -sS -b /tmp/admin.cookies -X POST http://localhost:3001/api/kos -H 'content-type: application/json' -d '{"nama":"Bad","lat":null,"lon":null}'
    Expected: 400 with {error}
    Evidence: .sisyphus/evidence/task-9-admin-crud-validation.txt
  ```

  **Commit**: YES | Message: `feat(admin): kos crud ux with backend proxy` | Files: [`admin/**`]


- [ ] 10. Implement Action Parsing UX + backend stub endpoint (NO LLM logic)

  **What to do**:
  - Backend:
    - Implement `POST /api/admin/actions/parse` (JWT required).
    - Response contract MUST match Task 9.1 (HTTP 501 + `expected_format`).
  - Admin:
    - `admin/app/api/actions/parse/route.ts` proxy to backend; reads cookie; forwards `Authorization`.
    - `/actions/parse` page:
      - textarea input
      - submit button
      - response panel renders `expected_format` JSON and shows "Not implemented".

  **Must NOT do**: any parsing logic.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: UX page + proxy.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 11 | Blocked By: 9.1,8

  **References**:
  - Contract: Task 9.1

  **Acceptance Criteria**:
  - [ ] Calling backend returns 501 + contract JSON.

  **QA Scenarios**:
  ```
  Scenario: Backend stub contract
    Tool: Bash
    Steps:
      - TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login -H 'content-type: application/json' -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)
      - curl -sS -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"input":"ubah harga kos jadi 1.5jt"}' http://localhost:8000/api/admin/actions/parse
    Expected: HTTP 501 and JSON has error + expected_format
    Evidence: .sisyphus/evidence/task-10-parse-stub.json
  ```

  **Commit**: YES | Message: `feat(admin): actions parse ux with backend stub` | Files: [`backend/**`, `admin/**`]


- [ ] 11. Add Playwright e2e for admin core flow (run in dedicated container)

  **What to do**:
  - Add `@playwright/test` to `admin/` devDeps.
  - Add `admin/playwright.config.ts`:
    - baseURL `http://admin_dev:3001`
  - Create e2e spec:
    - login
    - create kos name `E2E Kos {timestamp}`
    - verify list
    - edit harga
    - delete
  - Add compose service `admin_e2e` (profile `development`) using `mcr.microsoft.com/playwright` image:
    - mounts `./admin:/work`
    - runs `npm ci && npx playwright test`
    - depends_on: `admin_dev`
    - env: `E2E_ADMIN_USERNAME`, `E2E_ADMIN_PASSWORD`

  **Must NOT do**: run e2e in CI (dev-first only).

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: e2e harness + container networking.
  - Skills: []

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Final verification | Blocked By: 9,8,1

  **Acceptance Criteria**:
  - [ ] `docker compose --profile development run --rm admin_e2e` exits 0

  **QA Scenarios**:
  ```
  Scenario: E2E passes
    Tool: Bash
    Steps: docker compose --profile development run --rm admin_e2e
    Expected: exit 0
    Evidence: .sisyphus/evidence/task-11-playwright.txt
  ```

  **Commit**: YES | Message: `test(admin): add playwright e2e coverage` | Files: [`admin/**`, `compose.yaml`]


- [ ] 12. Add minimal backend pytest smoke tests (auth + seed + kos read)

  **What to do**:
  - Add `pytest` + `pytest-asyncio` to backend dev deps.
  - Create tests:
    - `test_health_ok` (app boots, /health returns ok)
    - `test_login_wrong_password` returns 401
    - `test_admin_write_requires_auth` returns 401
    - `test_seed_missing_file_exits_ok` (seed returns 0 and message)
  - Run tests inside backend container using uv.

  **Must NOT do**: require real Mongo in unit tests (mock Motor or use testcontainer only if already trivial).

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: async tests + app wiring.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Final verification | Blocked By: 2,8

  **References**:
  - None.

  **Acceptance Criteria**:
  - [ ] `docker compose --profile development run --rm backend_dev uv run pytest -q` exits 0

  **QA Scenarios**:
  ```
  Scenario: Pytest passes
    Tool: Bash
    Steps: docker compose --profile development run --rm backend_dev uv run pytest -q
    Expected: exit 0
    Evidence: .sisyphus/evidence/task-12-backend-pytest.txt
  ```

  **Commit**: YES | Message: `test(backend): add minimal pytest smoke coverage` | Files: [`backend/**`]


- [ ] 13. Update README dev workflow + env docs

  **What to do**:
  - Update `README.md` sections:
    - new ports: admin 3001, backend 8000
    - dev compose now runs 4 services
    - describe `.env.development` required vars (including bcrypt hash)
    - mention dataset is close-source; seed may skip
  - Keep existing prod/staging notes intact.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: docs update.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: none | Blocked By: 1

  **Acceptance Criteria**:
  - [ ] README contains updated dev instructions and port matrix includes admin/backend.

  **QA Scenarios**:
  ```
  Scenario: Docs contain new commands
    Tool: Bash
    Steps: grep -n "3001" -n README.md && grep -n "8000" README.md
    Expected: matches exist
    Evidence: .sisyphus/evidence/task-13-readme-grep.txt
  ```

  **Commit**: YES | Message: `docs(dev): document 4-container dev workflow` | Files: [`README.md`, `.env.development.example`]


## Final Verification Wave (MANDATORY — after ALL implementation tasks)
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Small commits per TODO above. Avoid mixing compose + app logic.

## Success Criteria
- Dev compose runs 4 containers; Mongo persists data via named volume.
- Admin can CRUD kos with auth; backend enforces auth.
- Frontend map reads from backend (proxy route) and still works.
- Action parsing UX present; parsing logic not implemented.
