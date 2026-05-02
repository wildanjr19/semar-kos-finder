# Technology Stack

**Analysis Date:** 2026-05-02

## Languages

**Primary:**
- TypeScript 6.x - Next.js apps in `frontend/` and `admin/`; versions declared in `frontend/package.json` and `admin/package.json`.
- Python 3.11+ - FastAPI service in `backend/app/` and data-processing scripts in `src/`; backend requirement declared in `backend/pyproject.toml`.

**Secondary:**
- JavaScript - Next.js config and generated/runtime support in `admin/next.config.js`, `frontend/next-env.d.ts`, and `admin/next-env.d.ts`.
- YAML - Docker Compose and GitHub Actions deployment definitions in `compose.yaml`, `.github/workflows/production.yml`, and `.github/workflows/staging.yml`.
- CSS - App Router global styles and module styles in `frontend/app/layout.tsx`, `frontend/app/page.module.css`, and `admin/app/**/*.module.css`.

## Runtime

**Environment:**
- Node.js 20 slim - production and development containers for `frontend/` and `admin/` use `node:20-slim` in `frontend/Dockerfile`, `admin/Dockerfile`, and `compose.yaml`.
- Python 3.11 slim - backend production and development containers use `python:3.11-slim` in `backend/Dockerfile` and `backend/Dockerfile.dev`.
- MongoDB 7 - database service uses `mongo:7` in `compose.yaml` for development, staging, and production profiles.

**Package Manager:**
- npm - frontend/admin package manager; lockfiles present at `frontend/package-lock.json` and `admin/package-lock.json`.
- uv 0.5.24 - backend dependency manager in `backend/Dockerfile`; lockfile present at `backend/uv.lock`.
- Root `src/` scripts use host Python/uv per `AGENTS.md`; no root `pyproject.toml` or `requirements.txt` detected for `src/` dependencies.

## Frameworks

**Core:**
- Next.js ^16.2.1 - public map app in `frontend/`; scripts in `frontend/package.json` run `next dev`, `next build`, and `next start`.
- React ^19.2.4 / React DOM ^19.2.4 - public frontend UI in `frontend/package.json`.
- Next.js ^14.2.35 - admin dashboard in `admin/`; scripts in `admin/package.json` run on port 3001.
- React ^18.3.1 / React DOM ^18.3.1 - admin UI in `admin/package.json`.
- FastAPI - backend REST service in `backend/app/main.py`; routers mounted from `backend/app/routers/`.
- Uvicorn standard - ASGI runtime for backend; production command in `backend/Dockerfile` runs `uvicorn app.main:app`.

**Testing:**
- pytest + pytest-asyncio - backend tests declared in `backend/pyproject.toml`; tests live in `backend/tests/`.
- httpx >=0.28.1 - backend test HTTP client declared in `backend/pyproject.toml`.
- Playwright @playwright/test ^1.41.2 - admin E2E tests declared in `admin/package.json`; config at `admin/playwright.config.ts`.
- Frontend public app has no test runner declared in `frontend/package.json`.

**Build/Dev:**
- Docker Compose - multi-profile orchestration in `compose.yaml` with `development`, `staging`, and `production` profiles.
- Docker Buildx - image builds in `.github/workflows/production.yml` and `.github/workflows/staging.yml`.
- GitHub Actions - CI/CD workflows in `.github/workflows/production.yml` and `.github/workflows/staging.yml`.
- TypeScript compiler - app type settings in `frontend/tsconfig.json` and `admin/tsconfig.json`.
- Pyright - backend typechecking referenced by `AGENTS.md` via root `pyrightconfig.json`.

## Key Dependencies

**Critical:**
- `maplibre-gl` ^5.10.0 - browser map rendering in `frontend/components/Map.tsx` and `frontend/components/CleanMapPrototype.tsx`.
- `fastapi` - REST API framework in `backend/app/main.py` and routers under `backend/app/routers/`.
- `motor` - async MongoDB driver used by `backend/app/db.py`, `backend/app/seed.py`, and `backend/app/seed_master_uns.py`.
- `pydantic` + `pydantic-settings` - request/response models and environment config in `backend/app/models.py` and `backend/app/config.py`.
- `python-jose[cryptography]` - JWT encode/decode in `backend/app/auth.py`.
- `bcrypt>=4.0,<5.0` - admin password verification in `backend/app/auth.py` and `backend/app/routers/auth.py`.
- `openai>=1.0,<2.0` - LLM structured parsing client in `backend/app/parse_engine.py`.
- `orjson` - backend JSON performance dependency declared in `backend/pyproject.toml`.

**Infrastructure:**
- `uvicorn[standard]` - ASGI server for `backend/app/main.py`, launched by `backend/Dockerfile` and `backend/Dockerfile.dev`.
- `python-dotenv` - env-file loading support for backend/scripts; backend settings set `env_file='.env'` in `backend/app/config.py`, scripts call `load_dotenv()` in `src/geocoding_location.py`, `src/get_new_data.py`, and `src/get_addres_plus_code.py`.
- `@playwright/test` - admin browser automation in `admin/e2e/` with `admin/playwright.config.ts`.
- Root data scripts additionally import `pandas`, `pdfplumber`, and `requests` in `src/concat_data.py`, `src/extract_pdf.py`, and `src/get_addres_plus_code.py`; these are not declared in a repository package manifest.

## Configuration

**Environment:**
- Backend config is centralized in `backend/app/config.py` using `pydantic-settings`; required vars include `MONGO_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_BCRYPT`, and `JWT_EXPIRE_MINUTES`.
- Optional/default backend LLM vars in `backend/app/config.py`: `LLM_API_KEY`, `LLM_API_BASE`, `LLM_MODEL`, `LLM_MAX_TOKENS`, and `LLM_TEMPERATURE`.
- Frontend API proxy uses `API_INTERNAL_URL` in `frontend/app/api/kos/route.ts` and `frontend/app/api/master-uns/route.ts`; directions proxy uses `GOOGLE_MAPS_API_KEY` or `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `frontend/app/api/directions/route.ts`.
- Admin API proxy uses `API_INTERNAL_URL` in `admin/lib/backend.ts`, `admin/app/api/auth/login/route.ts`, and `admin/app/api/auth/refresh/route.ts`.
- Environment files detected but not read: `.env.development`, `.env.production`, `.env.staging`, plus `.env.*.example` files at repository root.

**Build:**
- Frontend production image: `frontend/Dockerfile` builds with `npm ci` and `npm run build`, then serves on port 3002.
- Admin production image: `admin/Dockerfile` builds with `npm ci` and `npm run build`, then serves on port 3001.
- Backend production image: `backend/Dockerfile` runs `uv sync --frozen --no-dev`, copies `backend/app/`, and starts Uvicorn on port 8000.
- Development stack: `compose.yaml` mounts `./backend`, `./frontend`, and `./admin` for hot reload and uses `backend/Dockerfile.dev` plus `node:20-slim` containers.
- TypeScript config: `frontend/tsconfig.json` has `strict: false`; `admin/tsconfig.json` has `strict: true` and alias `@/*` -> `./*`.

## Platform Requirements

**Development:**
- Docker + Docker Compose for full-stack development via `compose.yaml` profile `development`.
- Node.js/npm for local frontend/admin development in `frontend/` and `admin/`.
- uv for backend commands under `backend/`; use `uv run` for backend execution and tests.
- Python/uv for standalone data scripts in `src/`; scripts expect local/private data paths from gitignored `data/`, `dump/`, `notebooks/`, or `frontend/public/data/`.
- Google Maps API key required for frontend directions and root geocoding scripts.

**Production:**
- VPS Docker host deployed over SSH by GitHub Actions in `.github/workflows/production.yml` and `.github/workflows/staging.yml`.
- Container images published to GitHub Container Registry under `ghcr.io/wildanjr19/semar-kos-web`, `ghcr.io/wildanjr19/semar-kos-backend`, and `ghcr.io/wildanjr19/semar-kos-admin`.
- MongoDB runs as a Compose-managed `mongo:7` container with named volumes `mongo_production_data`, `mongo_staging_data`, and `mongo_data` in `compose.yaml`.

## Project Skill Constraints

- Docker work should preserve multi-stage builds, non-root users, healthchecks, and profile-based Compose separation already present in `frontend/Dockerfile`, `admin/Dockerfile`, `backend/Dockerfile`, and `compose.yaml`.
- React/Next.js work should follow Vercel skill guidance from `.agents/skills/vercel-react-best-practices/SKILL.md`: avoid server waterfalls, keep API-route fetches parallel where independent, avoid shared mutable request state, and use direct imports/Next optimized package imports.
- UI work should follow accessibility/performance priorities from `.agents/skills/ui-ux-pro-max/SKILL.md` and `.agents/skills/web-design-guidelines/SKILL.md`.
- GitHub Actions changes should preserve environment-scoped secrets and GHCR publishing patterns in `.github/workflows/production.yml` and `.github/workflows/staging.yml`.

---

*Stack analysis: 2026-05-02*
