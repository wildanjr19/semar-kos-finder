# Codebase Structure

**Analysis Date:** 2026-05-02

## Directory Layout

```text
semar-kos-finder/
├── frontend/                 # Public Next.js map app
│   ├── app/                  # App Router pages and public API proxy routes
│   ├── components/           # MapLibre client components
│   └── public/               # Static assets and generated data target
├── admin/                    # Admin Next.js dashboard app
│   ├── app/                  # App Router pages, API proxies, CSS modules
│   ├── components/           # Shared admin client components
│   ├── hooks/                # Client hooks for polling and LLM config
│   ├── lib/                  # Server-side backend proxy helper
│   ├── e2e/                  # Playwright e2e specs
│   └── types/                # Local TypeScript declaration shims
├── backend/                  # FastAPI service
│   ├── app/                  # Application package, routers, models, jobs
│   └── tests/                # Pytest tests
├── src/                      # Standalone Python data-processing scripts
├── .github/workflows/        # Production and staging deployment pipelines
├── .agents/skills/           # Project/agent skill indexes and rules
├── .planning/codebase/       # Generated codebase maps for GSD commands
├── graphify-out/             # Graphify knowledge graph and reports
├── compose.yaml              # Docker Compose profiles for dev/staging/prod
├── pyrightconfig.json        # Python type checker config
├── AGENTS.md                 # Repo-specific agent instructions
└── README.md                 # Project overview and manual usage
```

## Directory Purposes

**`frontend/`:**
- Purpose: Public-facing kos map web application.
- Contains: Next.js App Router, MapLibre client components, public proxy routes.
- Key files: `frontend/app/page.tsx`, `frontend/components/Map.tsx`, `frontend/app/api/kos/route.ts`, `frontend/app/api/directions/route.ts`, `frontend/Dockerfile`.

**`frontend/app/`:**
- Purpose: Public app entry points and route handlers.
- Contains: `layout.tsx`, `page.tsx`, `api/` route handlers, `prototype/` routes.
- Key files: `frontend/app/page.tsx`, `frontend/app/api/kos/route.ts`, `frontend/app/api/master-uns/route.ts`, `frontend/app/api/directions/route.ts`.

**`frontend/components/`:**
- Purpose: Browser-only map UI components.
- Contains: Large client components using MapLibre and DOM APIs.
- Key files: `frontend/components/Map.tsx`, `frontend/components/CleanMapPrototype.tsx`.

**`admin/`:**
- Purpose: Private admin dashboard for CRUD, imports, parsing, review, jobs, and prototypes.
- Contains: Next.js App Router pages, local API proxy routes, middleware, e2e tests.
- Key files: `admin/app/layout.tsx`, `admin/middleware.ts`, `admin/lib/backend.ts`, `admin/playwright.config.ts`.

**`admin/app/`:**
- Purpose: Admin routes and local BFF API surface.
- Contains: `kos/`, `master-uns/`, `actions/parse/`, `login/`, `prototype/`, and `api/`.
- Key files: `admin/app/kos/page.tsx`, `admin/app/master-uns/page.tsx`, `admin/app/actions/parse/page.tsx`, `admin/app/api/kos/route.ts`.

**`admin/app/api/`:**
- Purpose: Same-origin admin API routes that proxy to FastAPI and manage auth cookies.
- Contains: One route file per backend endpoint or auth operation.
- Key files: `admin/app/api/auth/login/route.ts`, `admin/app/api/auth/refresh/route.ts`, `admin/app/api/kos/route.ts`, `admin/app/api/actions/parse/bulk/route.ts`.

**`admin/components/`:**
- Purpose: Shared admin UI components used across pages/layout.
- Contains: Background job indicator and clean-data inline editors.
- Key files: `admin/components/BackgroundTaskIndicator.tsx`, `admin/components/parse/InlineEditors.tsx`.

**`admin/hooks/`:**
- Purpose: Client-side stateful utilities for admin pages.
- Contains: Polling and saved LLM config hooks.
- Key files: `admin/hooks/useJobPoller.ts`, `admin/hooks/useUserLlmConfig.ts`.

**`admin/lib/`:**
- Purpose: Server-side shared logic for admin route handlers.
- Contains: backend proxy/auth refresh helper.
- Key files: `admin/lib/backend.ts`.

**`backend/`:**
- Purpose: FastAPI REST API, Mongo access, authentication, LLM parsing, seed scripts.
- Contains: Python package `app/`, pytest tests, Dockerfiles, `pyproject.toml`, `uv.lock`.
- Key files: `backend/app/main.py`, `backend/app/models.py`, `backend/app/job_queue.py`, `backend/app/parse_engine.py`.

**`backend/app/`:**
- Purpose: Backend application package.
- Contains: app factory, config, DB singleton, auth helpers, Pydantic models, routers, parser, queue, seed scripts.
- Key files: `backend/app/main.py`, `backend/app/config.py`, `backend/app/db.py`, `backend/app/auth.py`, `backend/app/models.py`.

**`backend/app/routers/`:**
- Purpose: REST endpoint modules grouped by API domain.
- Contains: Public read routers and authenticated admin routers.
- Key files: `backend/app/routers/kos.py`, `backend/app/routers/master_uns.py`, `backend/app/routers/auth.py`, `backend/app/routers/admin_kos.py`, `backend/app/routers/admin_master_uns.py`, `backend/app/routers/admin_actions.py`.

**`src/`:**
- Purpose: Standalone data preparation pipeline outside backend service runtime.
- Contains: PDF extraction, CSV conversion, geocoding, duplicate detection.
- Key files: `src/extract_pdf.py`, `src/geocoding_location.py`, `src/csv_to_json.py`, `src/check_duplicate.py`.

**`.github/workflows/`:**
- Purpose: CI/CD deployment orchestration for environments.
- Contains: Branch-triggered production/staging workflows.
- Key files: `.github/workflows/production.yml`, `.github/workflows/staging.yml`.

**`.agents/skills/`:**
- Purpose: Agent-maintained project skills and external best-practice rule indexes.
- Contains: Skill folders with `SKILL.md`, optional `rules/`, and skill-specific `AGENTS.md`.
- Key files: `.agents/skills/vercel-react-best-practices/SKILL.md`, `.agents/skills/docker-expert/SKILL.md`, `.agents/skills/github-actions-docs/SKILL.md`.

**`graphify-out/`:**
- Purpose: Knowledge graph output used before architecture/codebase answers.
- Contains: Graph report and generated graph artifacts.
- Key files: `graphify-out/GRAPH_REPORT.md`.

## Key File Locations

**Entry Points:**
- `frontend/app/page.tsx`: Public map page; dynamic-imports MapLibre component.
- `frontend/components/Map.tsx`: Main public map implementation.
- `admin/app/layout.tsx`: Admin HTML shell, navigation, theme bootstrap, background job indicator.
- `admin/app/page.tsx`: Admin home redirect/landing entry.
- `admin/app/login/page.tsx`: Admin login page.
- `admin/middleware.ts`: Admin protected-route guard.
- `backend/app/main.py`: FastAPI app factory and ASGI `app` export.
- `src/csv_to_json.py`: CSV-to-frontend JSON pipeline entry.

**Configuration:**
- `compose.yaml`: Development, staging, production Docker Compose service topology.
- `frontend/package.json`: Public app npm scripts and dependencies.
- `frontend/tsconfig.json`: Public app TypeScript config.
- `admin/package.json`: Admin app npm scripts and dependencies.
- `admin/next.config.js`: Admin Next.js config.
- `admin/playwright.config.ts`: Admin e2e configuration.
- `backend/pyproject.toml`: Backend Python package/dependency config.
- `backend/uv.lock`: Backend lockfile.
- `pyrightconfig.json`: Repo-level Python type checking config.
- `.env.development.example`, `.env.production.example`, `.env.staging.example`: Environment templates only; do not read real `.env*` values.

**Core Logic:**
- `backend/app/models.py`: Shared backend domain contracts and API schemas.
- `backend/app/db.py`: MongoDB client lifecycle and collection access.
- `backend/app/auth.py`: JWT auth dependency and login throttling helpers.
- `backend/app/parse_engine.py`: LLM JSON/schema parsing and validation.
- `backend/app/job_queue.py`: Background parse job execution and persistence.
- `admin/lib/backend.ts`: Admin token-aware backend proxy helper.
- `admin/hooks/useJobPoller.ts`: Client polling abstraction for parse jobs.
- `frontend/app/api/directions/route.ts`: Google Routes proxy and validation boundary.

**Testing:**
- `backend/tests/`: Backend pytest suite.
- `admin/e2e/crud.spec.ts`: Admin Playwright CRUD e2e spec.
- `admin/playwright.config.ts`: E2E runner config.
- `compose.yaml`: `admin_e2e` service for Dockerized Playwright.

**Generated / Runtime Artifacts:**
- `frontend/public/data/`: Generated frontend dataset target from `src/csv_to_json.py`; gitignored.
- `admin/.next/`, `frontend/.next/`: Next build cache; generated.
- `admin/tsconfig.tsbuildinfo`, `frontend/tsconfig.tsbuildinfo`: TypeScript incremental cache; generated.
- `backend/.venv/`, `.venv/`: Python virtual environments; generated.
- `graphify-out/GRAPH_REPORT.md`: Generated architecture graph report.

## Naming Conventions

**Files:**
- Next pages use App Router names: `page.tsx`, `layout.tsx`, `route.ts` under route directories (`admin/app/kos/page.tsx`, `admin/app/api/kos/route.ts`).
- Dynamic route folders use bracket syntax: `admin/app/kos/[id]/edit/page.tsx`, `admin/app/api/actions/parse/jobs/[jobId]/route.ts`.
- CSS modules live beside route pages: `admin/app/kos/kos.module.css`, `admin/app/actions/parse/parse.module.css`.
- React components use PascalCase files in component folders: `admin/components/BackgroundTaskIndicator.tsx`, `frontend/components/CleanMapPrototype.tsx`.
- Hooks use `use*.ts`: `admin/hooks/useJobPoller.ts`, `admin/hooks/useUserLlmConfig.ts`.
- Backend routers use snake_case domain names: `backend/app/routers/admin_master_uns.py`, `backend/app/routers/admin_actions.py`.
- Backend modules use snake_case: `backend/app/job_queue.py`, `backend/app/parse_engine.py`.
- Data scripts use snake_case verbs/nouns: `src/geocoding_location.py`, `src/csv_to_json.py`.

**Directories:**
- Next route directories mirror URL paths: `admin/app/master-uns/`, `admin/app/actions/parse/`, `frontend/app/prototype/clean-map/`.
- API proxy directories mirror local API paths: `admin/app/api/actions/parse/jobs/[jobId]/cancel/`.
- Backend package keeps router modules in `backend/app/routers/` and top-level service modules in `backend/app/`.
- Prototype routes stay under `admin/app/prototype/` or `frontend/app/prototype/`; production routes stay outside `prototype/`.

## Where to Add New Code

**New Public Map Feature:**
- Primary UI code: `frontend/components/Map.tsx` for current production map, or extract new map-specific components under `frontend/components/` when component size grows.
- Route/page code: `frontend/app/<route>/page.tsx` for new public pages.
- API proxy: `frontend/app/api/<feature>/route.ts` when browser needs same-origin server-side proxying.
- Backend data endpoint: `backend/app/routers/<domain>.py`, then include router in `backend/app/main.py`.

**New Admin CRUD Feature:**
- Page: `admin/app/<resource>/page.tsx` for list, `admin/app/<resource>/new/page.tsx` for create, `admin/app/<resource>/[id]/edit/page.tsx` for edit.
- CSS: colocate as `admin/app/<resource>/<resource>.module.css`.
- API proxy: `admin/app/api/<resource>/route.ts` and `admin/app/api/<resource>/[id]/route.ts` using `proxyWithRetry()`.
- Backend router: `backend/app/routers/admin_<resource>.py` with `Depends(require_auth)` on mutations.
- Schema: add Pydantic models to `backend/app/models.py`.

**New Admin Action / Workflow:**
- Page: `admin/app/actions/<action>/page.tsx`.
- Proxy routes: `admin/app/api/actions/<action>/route.ts`.
- Backend endpoint: extend `backend/app/routers/admin_actions.py` for action endpoints unless domain warrants its own router.
- Hooks/components: shared workflow pieces in `admin/hooks/` and `admin/components/`.

**New Background Job Type:**
- Backend job orchestration: extend or split from `backend/app/job_queue.py`; keep persisted state in Mongo.
- Backend API: add start/poll/cancel endpoints in `backend/app/routers/admin_actions.py` or a new router.
- UI polling: reuse `admin/hooks/useJobPoller.ts` pattern or create `admin/hooks/use<Thing>Poller.ts`.
- Global UI notification: add to `admin/components/BackgroundTaskIndicator.tsx` only for cross-route status.

**New Backend Public Read Endpoint:**
- Router: add to `backend/app/routers/<domain>.py` or create a new router under `backend/app/routers/`.
- Schema: add response model to `backend/app/models.py`.
- App registration: include router in `backend/app/main.py`.
- Public frontend proxy: add `frontend/app/api/<domain>/route.ts` if public app consumes it.

**New Data Pipeline Step:**
- Script: add `src/<step_name>.py`.
- Inputs/outputs: use `Path` constants at module top like `src/csv_to_json.py:12`.
- Runtime: use host Python/uv, not backend service package.
- Generated frontend data target: write under `frontend/public/data/` only when artifact is meant for public app.

**Utilities:**
- Backend shared utilities: prefer small functions in relevant backend module; create `backend/app/<utility>.py` only when used by multiple routers/services.
- Admin server route utilities: `admin/lib/`.
- Admin client hooks: `admin/hooks/`.
- Admin shared visual components: `admin/components/`.
- Public frontend components/helpers: `frontend/components/` until a broader `frontend/lib/` exists.

## Special Directories

**`frontend/public/data/`:**
- Purpose: Generated data artifact target for old/static map workflows.
- Generated: Yes.
- Committed: No; gitignored.

**`data/`, `dump/`, `notebooks/`, `notes/`:**
- Purpose: Closed-source/local dataset and analysis assets.
- Generated: Mixed/manual.
- Committed: No; gitignored and absent from normal repo reads.

**`admin/.next/` and `frontend/.next/`:**
- Purpose: Next.js build/dev cache.
- Generated: Yes.
- Committed: No.

**`admin/node_modules/` and `frontend/node_modules/`:**
- Purpose: npm dependencies.
- Generated: Yes.
- Committed: No.

**`backend/.venv/` and `.venv/`:**
- Purpose: uv/Python virtual environments.
- Generated: Yes.
- Committed: No.

**`backend/tests/`:**
- Purpose: Backend pytest tests for FastAPI/service logic.
- Generated: No.
- Committed: Yes.

**`admin/e2e/`:**
- Purpose: Playwright admin end-to-end tests.
- Generated: No.
- Committed: Yes.

**`.planning/codebase/`:**
- Purpose: GSD codebase maps used by planning/execution commands.
- Generated: Yes.
- Committed: Yes when orchestrator chooses.

**`graphify-out/`:**
- Purpose: Generated knowledge graph and architecture summary.
- Generated: Yes.
- Committed: Project-dependent; read `graphify-out/GRAPH_REPORT.md` before architecture/codebase answers.

**`.agents/skills/`:**
- Purpose: Project skill definitions and rules.
- Generated: Tool-managed.
- Committed: Project-dependent; read `SKILL.md` indexes before codebase mapping or implementation.

---

*Structure analysis: 2026-05-02*
