# Coding Conventions

**Analysis Date:** 2026-05-02

## Naming Patterns

**Files:**
- Next.js App Router route files use framework names: `admin/app/api/kos/route.ts`, `frontend/app/api/directions/route.ts`, `admin/app/kos/page.tsx`.
- React page components live in `page.tsx`; local CSS Modules use sibling `*.module.css`: `admin/app/kos/page.tsx` + `admin/app/kos/kos.module.css`.
- Shared admin utilities use lower camel/kebab-ish descriptive names in folders: `admin/lib/backend.ts`, `admin/hooks/useJobPoller.ts`, `admin/hooks/useUserLlmConfig.ts`.
- Python backend modules use snake_case: `backend/app/job_queue.py`, `backend/app/parse_engine.py`, `backend/app/routers/admin_kos.py`.
- Root data scripts use snake_case in `src/`: `src/csv_to_json.py`, `src/geocoding_location.py`, `src/check_duplicate.py`.

**Functions:**
- React hooks start with `use` and return state/actions objects: `useJobPoller()` in `admin/hooks/useJobPoller.ts`, `useUserLlmConfig()` in `admin/hooks/useUserLlmConfig.ts`.
- React event handlers use `handle*`, `open*`, `close*`, `toggle*`: `handleSingleDelete`, `handleBulkDelete`, `openDetail`, `closeDetail`, `toggleSelectOne` in `admin/app/kos/page.tsx`.
- Next route handlers export HTTP verbs in uppercase: `GET`, `POST`, `PUT`, `DELETE` in `admin/app/api/kos/route.ts` and `frontend/app/api/directions/route.ts`.
- Python private helpers start with `_`: `_doc_to_kos()` in `backend/app/routers/admin_kos.py`, `_duration_ms()` in `backend/app/job_queue.py`, `_error_text()` in `backend/app/parse_engine.py`.
- Python FastAPI endpoint functions use snake_case verb phrases: `create_kos()`, `update_kos()`, `bulk_create_kos()` in `backend/app/routers/admin_kos.py`.

**Variables:**
- Module constants use uppercase snake case in Python and uppercase camel/snake in TypeScript: `COLLECTION` in `backend/app/routers/admin_kos.py`, `JOBS_STORAGE_KEY` in `admin/components/BackgroundTaskIndicator.tsx`, `API_INTERNAL_URL` in `admin/lib/backend.ts`.
- React state follows `[value, setValue]`: `items/setItems`, `loading/setLoading`, `error/setError`, `selectedIds/setSelectedIds` in `admin/app/kos/page.tsx`.
- TypeScript local booleans use `is*`, `has*`, `matches*`: `isRecord()` and `isJobState()` in `admin/hooks/useJobPoller.ts`, `hasFailedItems` in `admin/components/BackgroundTaskIndicator.tsx`, `matchesSearch` in `admin/app/kos/page.tsx`.
- Python locals favor explicit nouns: `updates`, `object_ids`, `source_id`, `incoming`, `internal_dups` in `backend/app/routers/admin_kos.py`.

**Types:**
- TypeScript domain types use PascalCase `type` or `interface`: `Kos`, `KosClean`, `RouteApiResponse` in `frontend/components/Map.tsx`; `JobState`, `JobItemState`, `UseJobPollerOptions` in `admin/hooks/useJobPoller.ts`.
- Pydantic models use PascalCase domain/action names: `KosCreate`, `KosUpdate`, `KosOut`, `KosBulkCreate`, `MasterUnsCreate` in `backend/app/models.py`.
- Literal unions encode finite states: `JobItemStatus` in `admin/hooks/useJobPoller.ts`; `Literal["pending", "running", "done", "cancelled", "error"]` in `backend/app/models.py`.

## Code Style

**Formatting:**
- No Prettier, ESLint, Ruff, or Black config detected in repo root, `admin/`, `frontend/`, or `backend/`.
- TypeScript formatting is mixed by app: `admin/` generally uses single quotes and semicolons (`admin/lib/backend.ts`), while `frontend/` generally uses double quotes and semicolons (`frontend/components/Map.tsx`). Match the directory-local style when editing.
- Python backend uses 4-space indentation and type hints (`backend/app/auth.py`, `backend/app/job_queue.py`). Root data scripts may use tabs (`src/csv_to_json.py`); preserve local indentation in script edits unless reformatting whole file.
- CSS Modules use camelCase class names in `admin/app/kos/kos.module.css` and are imported as `styles` in `admin/app/kos/page.tsx`.

**Linting:**
- Frontend/admin package scripts expose only `dev`, `build`, and `start` in `frontend/package.json` and `admin/package.json`; no lint script detected.
- Backend type checking uses Pyright config at `pyrightconfig.json`; run `uv run pyright backend/` from repo root or follow AGENTS instruction for backend.
- TypeScript strictness differs: `admin/tsconfig.json` has `strict: true`; `frontend/tsconfig.json` has `strict: false`. Write new admin TypeScript with explicit unknown handling and type guards.

## Import Organization

**Order:**
1. Framework/runtime imports first: `import { NextRequest, NextResponse } from 'next/server';` in `admin/lib/backend.ts`; `from fastapi import APIRouter, Depends, HTTPException` in `backend/app/routers/admin_kos.py`.
2. Third-party imports next: `import maplibregl from "maplibre-gl"` in `frontend/components/Map.tsx`; `from jose import JWTError, jwt` in `backend/app/auth.py`.
3. Internal aliases or app imports last: `import { proxyWithRetry } from '@/lib/backend';` in `admin/app/api/kos/route.ts`; `from app.auth import require_auth` in `backend/app/routers/admin_kos.py`.
4. Style imports after component/runtime imports in React pages: `import styles from './kos.module.css';` in `admin/app/kos/page.tsx`.

**Path Aliases:**
- Admin uses `@/*` path alias from `admin/tsconfig.json`; use imports such as `@/lib/backend` and `@/hooks/useJobPoller` in `admin/app/**`, `admin/components/**`, and `admin/hooks/**`.
- Frontend has no path alias in `frontend/tsconfig.json`; use relative imports or same-file helpers in `frontend/app/**` and `frontend/components/**`.
- Backend imports use absolute package path `app.*`: `from app.db import get_collection` in `backend/app/routers/admin_kos.py`.

## Error Handling

**Patterns:**
- Backend API errors use `HTTPException` with `detail={"error": "..."}` and status codes: `backend/app/auth.py`, `backend/app/routers/admin_kos.py`.
- Backend global exception handler converts errors to `{ "error": ... }` JSON in `backend/app/main.py`; keep new FastAPI errors compatible with this shape.
- Frontend/admin route handlers return `NextResponse.json({ error: ... }, { status })` for validation and upstream errors, as in `frontend/app/api/directions/route.ts`.
- Admin client pages catch unknown exceptions and normalize with `e instanceof Error ? e.message : 'fallback'`, as in `admin/app/kos/page.tsx` and `admin/hooks/useUserLlmConfig.ts`.
- Silent resilience is used for localStorage/sessionStorage parsing and optional background work: `catch { /* ignore */ }` in `admin/components/BackgroundTaskIndicator.tsx`; preserve only for non-critical local cache reads.

## Logging

**Framework:** Python `logging` in backend and data scripts; browser/server `console` in frontend route/components.

**Patterns:**
- Configure backend logging once in `backend/app/main.py` via `LOG_LEVEL` and named `app` logger.
- Use `logger = logging.getLogger(__name__)` in backend modules: `backend/app/parse_engine.py`, `backend/app/job_queue.py`, `backend/app/routers/admin_actions.py`.
- Use structured message templates for backend operational logs: `logger.info("parse_job_created job_id=%s username=%s total=%s concurrency=%s", ...)` in `backend/app/job_queue.py`.
- Use `logger.exception(...)` when stack traces matter, as in `backend/app/parse_engine.py` and `backend/app/job_queue.py`.
- Frontend route handlers may use `console.error` for upstream failures (`frontend/app/api/kos/route.ts`); avoid noisy `console.log` in new production UI unless debugging map lifecycle like `frontend/components/Map.tsx`.

## Comments

**When to Comment:**
- Comment phase-based backend import/dedup logic where it clarifies algorithm stages: `# Phase 1`, `# Phase 2`, `# Phase 3` in `backend/app/routers/admin_kos.py`.
- Use comments for lifecycle or product rationale in larger admin pages: `// 5e: auto-refresh after coming back from parse wizard` in `admin/app/kos/page.tsx`.
- Avoid comments that repeat the code; prefer extracted helper names such as `_entry_name()`, `_persist_job()`, `normalizeWaHref()`.

**JSDoc/TSDoc:**
- TSDoc is not a dominant pattern; TypeScript relies on named types/interfaces in `admin/hooks/useJobPoller.ts` and `frontend/components/Map.tsx`.
- Python docstrings appear on module-level or behavior-heavy helpers: module docstring in `backend/app/parse_engine.py`, `Job.to_dict()` context in `backend/app/job_queue.py`, script docstring in `src/csv_to_json.py`.

## Function Design

**Size:**
- Prefer small helpers for normalization, parsing, conversion, and route proxying: `toNumber()`, `normalizeJenisKos()`, `parseContact()` in `frontend/components/Map.tsx`; `_doc_to_kos()` in `backend/app/routers/admin_kos.py`.
- Existing admin pages can be large (`admin/app/kos/page.tsx`, `admin/app/actions/parse/page.tsx`); new code should extract hooks/components into `admin/hooks/` or `admin/components/` when logic becomes reusable.

**Parameters:**
- Type every exported TypeScript function parameter and options object: `proxyWithRetry(request: NextRequest, options: ProxyOptions)` in `admin/lib/backend.ts`.
- Use FastAPI dependency injection parameters with underscore when only authentication side effect matters: `_username: str = Depends(require_auth)` in `backend/app/routers/admin_kos.py`.
- Use Pydantic request body models for backend mutations: `body: KosCreate`, `body: KosUpdate`, `body: KosBulkCreate` in `backend/app/routers/admin_kos.py`.

**Return Values:**
- Next API route handlers return `NextResponse` or proxy response directly: `admin/app/api/kos/route.ts`, `frontend/app/api/directions/route.ts`.
- Python endpoint return types should be explicit `dict`, `None`, or Pydantic response models: `create_kos(...)-> dict`, `delete_kos(...)-> None` in `backend/app/routers/admin_kos.py`.
- React hooks return plain objects or state maps: `return jobs;` in `admin/hooks/useJobPoller.ts`, `return { config, loading, error, fetchConfig, saveConfig };` in `admin/hooks/useUserLlmConfig.ts`.

## Module Design

**Exports:**
- Export Next route handlers as named `GET`, `POST`, etc. only from `route.ts` files.
- Export shared hooks and types from hook files: `export type JobItemStatus`, `export interface JobState`, `export function useJobPoller` in `admin/hooks/useJobPoller.ts`.
- Export default React components for standalone components/pages when framework expects defaults: `BackgroundTaskIndicator` in `admin/components/BackgroundTaskIndicator.tsx`.
- Backend modules expose routers as module-level `router = APIRouter(...)` in `backend/app/routers/*.py` and include them from `backend/app/main.py`.

**Barrel Files:**
- No TypeScript barrel files detected. Import directly from source paths, e.g. `@/lib/backend`, `@/hooks/useJobPoller`.
- Python router package `backend/app/routers/__init__.py` exists for package structure; `backend/app/main.py` imports concrete router modules directly.

---

*Convention analysis: 2026-05-02*
