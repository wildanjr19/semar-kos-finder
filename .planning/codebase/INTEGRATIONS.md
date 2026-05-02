# External Integrations

**Analysis Date:** 2026-05-02

## APIs & External Services

**Backend API Proxies:**
- Public frontend proxies FastAPI endpoints through Next.js route handlers.
  - SDK/Client: native `fetch` in `frontend/app/api/kos/route.ts` and `frontend/app/api/master-uns/route.ts`
  - Auth: none for public endpoints; service location via `API_INTERNAL_URL`
- Admin app proxies CRUD/auth/LLM requests through Next.js route handlers to FastAPI.
  - SDK/Client: native `fetch` wrapper `proxyWithRetry()` in `admin/lib/backend.ts`
  - Auth: `admin_token` and `admin_refresh` HTTP-only cookies forwarded as Bearer tokens to backend

**Maps & Routing:**
- Google Routes API - computes route distance, duration, and encoded polyline for map directions.
  - SDK/Client: native `fetch` POST to `https://routes.googleapis.com/directions/v2:computeRoutes` in `frontend/app/api/directions/route.ts`
  - Auth: `GOOGLE_MAPS_API_KEY` or fallback `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Google Maps Geocoding API - enriches and geocodes kos addresses in standalone data scripts.
  - SDK/Client: `urllib.request`/`requests` calls to `https://maps.googleapis.com/maps/api/geocode/json` in `src/geocoding_location.py`, `src/get_new_data.py`, and `src/get_addres_plus_code.py`
  - Auth: `GMAPS_API_KEY`
- MapLibre GL - renders interactive maps and markers in browser.
  - SDK/Client: `maplibre-gl` imported in `frontend/components/Map.tsx` and `frontend/components/CleanMapPrototype.tsx`
  - Auth: none detected

**LLM Parsing:**
- OpenAI-compatible chat completions - cleans raw kos entries into `KosClean` structured data.
  - SDK/Client: `AsyncOpenAI` from `openai` in `backend/app/parse_engine.py`
  - Auth: `LLM_API_KEY`
  - Base URL: `LLM_API_BASE`, default `https://api.openai.com/v1` in `backend/app/config.py`
  - Model/config: `LLM_MODEL`, `LLM_MAX_TOKENS`, `LLM_TEMPERATURE` in `backend/app/config.py`
- Admin LLM profile/config UI - stores per-user LLM config and tests connectivity.
  - SDK/Client: admin route proxies under `admin/app/api/actions/llm/test/route.ts` and `admin/app/api/config/llm/route.ts`
  - Auth: admin JWT cookies via `admin/lib/backend.ts`

**CI/CD and Registry:**
- GitHub Container Registry - stores built Docker images.
  - SDK/Client: Docker CLI login/push in `.github/workflows/production.yml` and `.github/workflows/staging.yml`
  - Auth: `secrets.GITHUB_TOKEN`
- VPS over SSH/SCP - deployment target for Compose stack.
  - SDK/Client: `appleboy/ssh-action@v1` and `appleboy/scp-action@v1` in `.github/workflows/production.yml` and `.github/workflows/staging.yml`
  - Auth: `SSH_HOST`, `SSH_USER`, `SSH_KEY` GitHub Environment secrets

## Data Storage

**Databases:**
- MongoDB 7 in Docker Compose.
  - Connection: `MONGO_URL` loaded by `backend/app/config.py`
  - Client: Motor `AsyncIOMotorClient` in `backend/app/db.py`
  - Collections: `kos`, `ss`, parse jobs/config collections accessed through `get_collection()` in `backend/app/routers/` and `backend/app/job_queue.py`
  - Runtime: `mongodb`, `mongodb_staging`, and `mongodb_prod` services in `compose.yaml`

**File Storage:**
- Local filesystem and gitignored datasets for data pipeline.
  - Scripts read/write CSV/JSON under gitignored data paths from `src/csv_to_json.py`, `src/json_to_csv.py`, `src/concat_data.py`, and `src/extract_pdf.py`
  - Frontend generated data path `frontend/public/data/` is referenced by `compose.yaml` as `/seed-data:ro` for `backend_dev`
- No cloud object storage SDK detected.

**Caching:**
- Browser localStorage is used for admin prototype LLM profiles/config in `admin/app/prototype/clean-data/page.tsx` and `admin/app/actions/parse/page.tsx`.
- Next.js `.next` caches are persisted as Compose named volumes `dev_next_cache` and `admin_next_cache` in `compose.yaml`.
- No Redis/Memcached/external cache detected.

## Authentication & Identity

**Auth Provider:**
- Custom admin authentication backed by configured admin username/password hash.
  - Implementation: backend `/api/auth/login` and `/api/auth/refresh` routes in `backend/app/routers/auth.py`; JWT helpers in `backend/app/auth.py`
  - Password verification: bcrypt hash via `ADMIN_PASSWORD_BCRYPT` in `backend/app/auth.py`
  - JWT signing: HS256 using `JWT_SECRET` in `backend/app/auth.py`
  - Token durations: `JWT_EXPIRE_MINUTES` and `JWT_REFRESH_EXPIRE_DAYS` in `backend/app/config.py`
  - Admin frontend storage: HTTP-only cookies `admin_token` and `admin_refresh` set in `admin/app/api/auth/login/route.ts`, refreshed in `admin/app/api/auth/refresh/route.ts`, and retried in `admin/lib/backend.ts`
- No third-party OAuth/OIDC/SAML provider detected.

## Monitoring & Observability

**Error Tracking:**
- None detected; no Sentry, Rollbar, OpenTelemetry, Datadog, or similar SDK imports found.

**Logs:**
- Backend uses Python `logging` configured in `backend/app/main.py`; MongoDB and LLM flow logs emitted in `backend/app/db.py` and `backend/app/parse_engine.py`.
- Frontend/admin route handlers use `console.error` for proxy failures in `frontend/app/api/kos/route.ts`, `frontend/app/api/master-uns/route.ts`, and related admin route handlers.
- Docker healthchecks defined in `backend/Dockerfile`, `admin/Dockerfile`, and `compose.yaml` for service readiness.

## CI/CD & Deployment

**Hosting:**
- VPS Docker Compose deployment using `compose.yaml` profiles `production` and `staging`.
- Public web, admin, backend, and MongoDB run as containers on bridge networks `semar-kos-production`, `semar-kos-staging`, and `semar-kos-dev` in `compose.yaml`.

**CI Pipeline:**
- GitHub Actions production workflow in `.github/workflows/production.yml` triggers on pushes to `main` and manual `workflow_dispatch`.
- GitHub Actions staging workflow in `.github/workflows/staging.yml` triggers on pushes to `staging` and manual `workflow_dispatch`.
- Both workflows build/push matrix services with Docker Compose and deploy `compose.yaml` to VPS via SSH/SCP.
- Secrets are GitHub Environment-scoped in workflow `environment` blocks (`production`, `staging`).

## Environment Configuration

**Required env vars:**
- `MONGO_URL` - backend MongoDB connection string in `backend/app/config.py`.
- `JWT_SECRET` - backend JWT signing secret in `backend/app/config.py` and `backend/app/auth.py`.
- `ADMIN_USERNAME` - admin login username in `backend/app/config.py` and `backend/app/routers/auth.py`.
- `ADMIN_PASSWORD_BCRYPT` - bcrypt password hash in `backend/app/config.py` and `backend/app/routers/auth.py`.
- `JWT_EXPIRE_MINUTES` - access token duration in `backend/app/config.py`.
- `JWT_REFRESH_EXPIRE_DAYS` - refresh token duration in `backend/app/config.py`.
- `API_INTERNAL_URL` - Next.js-to-FastAPI internal URL in `frontend/app/api/kos/route.ts`, `frontend/app/api/master-uns/route.ts`, `admin/lib/backend.ts`, and auth proxy routes under `admin/app/api/auth/`.
- `GOOGLE_MAPS_API_KEY` - frontend directions proxy and deployment workflows in `frontend/app/api/directions/route.ts`, `.github/workflows/production.yml`, and `.github/workflows/staging.yml`.
- `GMAPS_API_KEY` - root geocoding scripts in `src/geocoding_location.py`, `src/get_new_data.py`, and `src/get_addres_plus_code.py`.
- `LLM_API_KEY` - OpenAI-compatible parsing in `backend/app/parse_engine.py`; optional default empty in `backend/app/config.py` but required at runtime for LLM parsing.
- `LLM_API_BASE`, `LLM_MODEL`, `LLM_MAX_TOKENS`, `LLM_TEMPERATURE` - optional LLM configuration in `backend/app/config.py`.
- `PARSE_JOB_CONCURRENCY` - optional background parse concurrency in `backend/app/job_queue.py`.
- `WEB_PORT`, `ADMIN_PORT`, `BACKEND_PORT` - deployment port variables consumed by `compose.yaml` and workflows.

**Secrets location:**
- Local env files exist at repository root (`.env.development`, `.env.production`, `.env.staging`) and are referenced by `compose.yaml`; contents not read.
- Example env files exist at repository root (`.env.example`, `.env.development.example`, `.env.production.example`, `.env.staging.example`); contents not read due secret-file policy.
- Production/staging secrets are injected from GitHub Environments in `.github/workflows/production.yml` and `.github/workflows/staging.yml`.
- Deployment workflows generate `.env.production` and `.env.staging` on the VPS during SSH deploy; do not commit generated env files.

## Webhooks & Callbacks

**Incoming:**
- None detected. FastAPI exposes REST endpoints under `/api/kos`, `/api/master-uns`, `/api/auth/*`, and `/api/admin/*` in `backend/app/main.py`, but no webhook-specific endpoint or signature verification was found.

**Outgoing:**
- Google Routes API calls from `frontend/app/api/directions/route.ts`.
- Google Maps Geocoding API calls from `src/geocoding_location.py`, `src/get_new_data.py`, and `src/get_addres_plus_code.py`.
- OpenAI-compatible LLM calls from `backend/app/parse_engine.py`.
- GitHub Actions SSH/SCP calls to VPS from `.github/workflows/production.yml` and `.github/workflows/staging.yml`.

---

*Integration audit: 2026-05-02*
