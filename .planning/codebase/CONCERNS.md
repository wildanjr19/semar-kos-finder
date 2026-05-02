# Codebase Concerns

**Analysis Date:** 2026-05-02

## Tech Debt

**Large god-node UI files:**
- Issue: Multiple high-change screens combine fetching, normalization, state machines, markup, and inline styling in single files.
- Files: `admin/app/prototype/clean-data/page.tsx` (1763 lines), `frontend/components/Map.tsx` (1118 lines), `admin/app/actions/parse/page.tsx` (1016 lines), `frontend/components/CleanMapPrototype.tsx` (888 lines)
- Impact: Small changes require editing large mixed-responsibility files; regressions in parse flow, map popups, and route rendering become hard to isolate.
- Fix approach: Extract typed normalizers, API hooks, presentational components, and state reducers. Keep route/page files as orchestration shells.

**Backend parse flow concentrated in two modules:**
- Issue: LLM prompting, OpenAI compatibility fallback, response cleanup, domain post-processing, logging, retry logic, and connection testing share `backend/app/parse_engine.py`; persistence, cancellation, execution, cleanup, and item state all share `backend/app/job_queue.py`.
- Files: `backend/app/parse_engine.py`, `backend/app/job_queue.py`
- Impact: Parser changes can break job execution and vice versa; targeted tests are difficult because responsibilities are interleaved.
- Fix approach: Split prompt contract, provider client, result validator, post-processors, job repository, and executor into separate modules under `backend/app/`.

**Duplicated document-to-response mappers:**
- Issue: `_doc_to_kos()` is duplicated for public and admin endpoints with the same mutation-heavy mapping behavior.
- Files: `backend/app/routers/kos.py`, `backend/app/routers/admin_kos.py`
- Impact: Response shape drift can expose fields in one surface but not another; mapper mutation via `pop()` makes reuse fragile.
- Fix approach: Move pure mapper to shared module, return a new dict, and cover with unit tests.

**No frontend/admin lint or typecheck scripts:**
- Issue: `package.json` scripts only run dev/build/start; no `lint`, `typecheck`, or test script for frontend/admin.
- Files: `frontend/package.json`, `admin/package.json`
- Impact: Type regressions, unsafe casts, and style drift only surface during build or runtime.
- Fix approach: Add `typecheck` and `lint` scripts; wire them into CI before Docker image build.

**Admin dependency/version mismatch:**
- Issue: Admin app runs React 18 / Next 14 but installs React 19 type packages and TypeScript 6 prerelease-range dependency.
- Files: `admin/package.json`
- Impact: Type definitions can describe APIs unavailable at runtime, causing subtle compile/runtime mismatch.
- Fix approach: Align `@types/react` and `@types/react-dom` to React 18-compatible versions, pin stable TypeScript supported by Next 14.

**CI deploy repeats secrets materialization logic:**
- Issue: Production and staging workflows duplicate SSH deploy scripts and write env files inline on VPS.
- Files: `.github/workflows/production.yml`, `.github/workflows/staging.yml`
- Impact: Security and deployment fixes must be made twice; drift between environments is likely.
- Fix approach: Extract reusable workflow or composite action; keep env generation minimal and validate required variables before writing files.

## Known Bugs

**Job detail and cancel endpoints ignore job ownership:**
- Symptoms: Any authenticated admin token can fetch or cancel any parse job by `job_id`; list endpoint filters by username, but detail/cancel do not.
- Files: `backend/app/routers/admin_actions.py`
- Trigger: Call `GET /api/admin/actions/parse/jobs/{job_id}` or `POST /api/admin/actions/parse/jobs/{job_id}/cancel` with a valid token for a different user.
- Workaround: Treat deployment as single-admin only until ownership checks exist.

**Saved LLM config endpoint returns raw API key despite masking comment:**
- Symptoms: `GET /api/admin/config/llm` returns `api_key` directly from MongoDB while docstring says keys are masked.
- Files: `backend/app/routers/admin_actions.py`, `admin/hooks/useUserLlmConfig.ts`, `admin/app/api/config/llm/route.ts`
- Trigger: Open admin parse page after saving config; client receives stored key.
- Workaround: Do not save provider keys unless admin host and browser are trusted.

**In-memory login rate limit never resets on successful login:**
- Symptoms: Failed attempts accumulate for 60 seconds per IP, and success does not clear `_fail_counts`; NAT/shared IP users can be blocked after another user fails.
- Files: `backend/app/auth.py`, `backend/app/routers/auth.py`
- Trigger: Five failed logins from same IP, then valid credentials within the window.
- Workaround: Wait for the 60-second cleanup window.

**Route proxy returns empty arrays on backend failures:**
- Symptoms: Public frontend silently shows no kos/master data when backend errors, because API proxy converts failures to `[]`.
- Files: `frontend/app/api/kos/route.ts`, `frontend/app/api/master-uns/route.ts`
- Trigger: Backend unavailable or returns non-2xx.
- Workaround: Check server logs; UI cannot distinguish empty dataset from backend failure.

## Security Considerations

**LLM API keys stored and returned in plaintext:**
- Risk: Provider API keys are stored in `user_settings` and returned to browser/admin client. LocalStorage profile copies also persist keys in browser storage.
- Files: `backend/app/routers/admin_actions.py`, `admin/hooks/useUserLlmConfig.ts`, `admin/app/actions/parse/page.tsx`, `admin/app/prototype/clean-data/page.tsx`
- Current mitigation: Admin routes require JWT via `require_auth`; cookies are `httpOnly`, `sameSite=lax`, and `secure` in production in `admin/app/api/auth/login/route.ts`.
- Recommendations: Store keys encrypted at rest, return masked keys only, avoid localStorage for secrets, and support “keep existing key” updates without echoing secret values.

**Custom LLM base URL allows backend-origin outbound requests:**
- Risk: Admin-provided `api_base` flows into `AsyncOpenAI(base_url=...)`; malicious or mistaken values can make backend call arbitrary hosts.
- Files: `backend/app/parse_engine.py`, `backend/app/routers/admin_actions.py`, `admin/app/actions/parse/page.tsx`
- Current mitigation: Endpoint requires admin JWT; UI presets list known providers.
- Recommendations: Add allowlist for provider hosts or explicit `ALLOW_CUSTOM_LLM_BASE_URL` gate; block localhost/link-local/private network ranges.

**Refresh tokens are bearer tokens with no rotation or revocation:**
- Risk: Stolen refresh token remains valid until expiry and can mint access tokens repeatedly.
- Files: `backend/app/auth.py`, `backend/app/routers/auth.py`, `admin/lib/backend.ts`, `admin/app/api/auth/login/route.ts`
- Current mitigation: Refresh cookie is `httpOnly`, `sameSite=lax`, and `secure` in production.
- Recommendations: Add refresh token ID, server-side revocation, rotation on refresh, and logout invalidation.

**Admin UI middleware checks token presence only:**
- Risk: Protected pages render when any `admin_token` cookie exists, even if expired or invalid; API calls still fail later.
- Files: `admin/middleware.ts`
- Current mitigation: Backend API proxy enforces backend JWT validation through `proxyWithRetry()`.
- Recommendations: Keep middleware as UX optimization only; consider lightweight signed-token validation or redirect on failed bootstrap API call.

**Public data endpoint returns contact and parsed fields:**
- Risk: Public `/api/kos` includes `narahubung`, `parsed_data`, `reviewed_by`, and other review metadata; contact data may be intentionally public but should be explicit.
- Files: `backend/app/routers/kos.py`, `frontend/app/api/kos/route.ts`
- Current mitigation: Mapper removes `source_id`, `location`, and `updated_at` only.
- Recommendations: Define dedicated public response model with least fields needed by map UI.

## Performance Bottlenecks

**Public kos API loads entire collection without pagination or projection:**
- Problem: `list_kos()` iterates all documents sorted by name and returns all fields accepted by `KosOut`.
- Files: `backend/app/routers/kos.py`, `frontend/app/api/kos/route.ts`, `frontend/components/Map.tsx`
- Cause: No pagination, bounding-box query, field projection, or cache headers.
- Improvement path: Add projection for map fields, pagination or tile/bounds endpoint, HTTP caching/ETag, and optional reviewed-only filter.

**Map renders one DOM marker and popup tree per kos item:**
- Problem: Large datasets create many DOM nodes and MapLibre markers in a single effect.
- Files: `frontend/components/Map.tsx`, `frontend/components/CleanMapPrototype.tsx`
- Cause: `data.map()` creates `maplibregl.Marker` elements for every item; no clustering or viewport virtualization.
- Improvement path: Use GeoJSON source + symbol/circle layers, clustering, or only render selected popup DOM.

**Background job persistence rewrites full job document often:**
- Problem: Each item state transition persists complete `items`, `results`, and `errors` arrays; results include raw entries and cleaned data.
- Files: `backend/app/job_queue.py`
- Cause: `_persist_job()` uses `$set` of whole arrays after start, completion, failure, cancellation, and finalization.
- Improvement path: Store job summary separately from item/result documents, use incremental `$set`/`$push`, and cap retained raw payloads.

**Synchronous parse endpoint blocks request on LLM round trips:**
- Problem: `/api/admin/actions/parse/entry` waits for LLM call and retries before returning.
- Files: `backend/app/routers/admin_actions.py`, `backend/app/parse_engine.py`
- Cause: `parse_entry()` directly awaits `parse_single_entry()`.
- Improvement path: Use job queue for all parse operations or add strict timeout and streaming/progress UX.

**Directions API has no timeout, cache, or rate limit:**
- Problem: Every route request calls Google Routes API and can hang until fetch default timeout.
- Files: `frontend/app/api/directions/route.ts`, `frontend/components/Map.tsx`, `frontend/components/CleanMapPrototype.tsx`
- Cause: Direct `fetch()` call with user-controlled coordinates and no `AbortSignal`, quota guard, or response cache.
- Improvement path: Add timeout via `AbortController`, cache frequent origin/destination/mode pairs, and throttle per client/session.

## Fragile Areas

**LLM parsing contract and post-processing:**
- Files: `backend/app/parse_engine.py`, `backend/app/models.py`, `admin/components/parse/InlineEditors.tsx`
- Why fragile: Hard-coded Indonesian system prompt, strict Pydantic schema, OpenAI structured-output fallback stack, and regex post-processing must stay aligned.
- Safe modification: Add golden fixtures for raw entries and expected `KosClean`; change prompt/schema/post-processing together.
- Test coverage: Only smoke tests exist in `backend/tests/test_smoke.py`; parser behavior lacks unit/regression tests.

**Background parse job lifecycle:**
- Files: `backend/app/job_queue.py`, `backend/app/routers/admin_actions.py`, `admin/hooks/useJobPoller.ts`, `admin/components/BackgroundTaskIndicator.tsx`
- Why fragile: Runtime `_jobs` cache, Mongo fallback, localStorage job IDs, polling timers, and cancellation all represent job state separately.
- Safe modification: Treat MongoDB as source of truth; add state-transition tests for pending/running/done/error/cancelled.
- Test coverage: No tests cover cancellation, process restart rehydration, partial failures, or concurrent updates.

**Admin parse UX duplicated between production and prototype pages:**
- Files: `admin/app/actions/parse/page.tsx`, `admin/app/prototype/clean-data/page.tsx`, `admin/app/prototype/jobs/page.tsx`
- Why fragile: LLM config, job tracking, status normalization, and review logic exist in multiple pages with different storage keys and UI flows.
- Safe modification: Extract shared hooks/modules before adding new parse states.
- Test coverage: Admin E2E only covers CRUD in `admin/e2e/crud.spec.ts`; parse workflow has no automated E2E coverage.

**Docker/Compose production hardening inconsistent across services:**
- Files: `compose.yaml`, `backend/Dockerfile`, `frontend/Dockerfile`, `admin/Dockerfile`
- Why fragile: `web_prod` uses `read_only` and tmpfs, but `backend_prod` and `admin_prod` do not; staging differs from production in exposed backend port.
- Safe modification: Apply security options consistently and test with production profile locally.
- Test coverage: CI health checks hit only public web URLs in `.github/workflows/production.yml` and `.github/workflows/staging.yml`.

## Scaling Limits

**Single-process in-memory job execution:**
- Current capacity: `PARSE_JOB_CONCURRENCY` defaults to 3 and caps at 10 per backend process.
- Limit: Jobs do not distribute across processes/containers; in-flight runtime tasks are lost on process restart even though job documents persist.
- Scaling path: Move to durable queue (Mongo work queue with leases, Redis/RQ, Celery, or task runner) and resumable item state.

**MongoDB single container per environment:**
- Current capacity: One `mongo:7` service and one named volume per profile in `compose.yaml`.
- Limit: No replica set, backups, auth, or managed failover represented in repo configuration.
- Scaling path: Use managed MongoDB or documented backup/restore, auth, and replica set strategy.

**Map UI assumes all data fits client memory:**
- Current capacity: Entire kos list loaded into React state and marker array.
- Limit: Browser memory and main-thread work grow linearly with dataset size.
- Scaling path: Serve bounds-based data, clustering, and selected-detail fetch.

## Dependencies at Risk

**Unpinned Python backend dependencies:**
- Risk: `fastapi`, `motor`, `pydantic`, `pydantic-settings`, and `uvicorn` are unconstrained in `backend/pyproject.toml`; lockfile helps local reproducibility but broad dependency specs increase upgrade surprise.
- Impact: Fresh lock updates can introduce breaking API behavior across FastAPI/Pydantic/Motor.
- Migration plan: Add compatible upper/lower bounds and Dependabot/renovate strategy with backend test expansion.

**OpenAI SDK compatibility fallback:**
- Risk: Parser depends on `.chat.completions.parse`, `.beta.chat.completions.parse`, JSON mode, and plain JSON fallback behavior.
- Impact: Provider differences can break structured parse quality or silently downgrade schema guarantees.
- Migration plan: Wrap provider behavior behind adapter interface and test OpenAI/OpenRouter/DeepSeek/Groq presets with mocked responses.

**GitHub actions pinned by major tag only:**
- Risk: Workflows use `actions/checkout@v6`, `docker/setup-buildx-action@v4`, `docker/login-action@v4`, `appleboy/ssh-action@v1`, and `appleboy/scp-action@v1`.
- Impact: Major tags can move within major version and change behavior; SSH deploy is supply-chain sensitive.
- Migration plan: Pin full commit SHA for deploy-critical actions or use organization-approved reusable actions.

## Missing Critical Features

**No automated backups or restore docs for MongoDB:**
- Problem: Compose defines persistent volumes but no backup job, dump retention, or restore runbook.
- Blocks: Safe production operations, migrations, and recovery after host/volume failure.

**No parser regression fixture suite:**
- Problem: LLM prompt and schema changes cannot be validated deterministically.
- Blocks: Safe prompt iteration and provider migration.

**No public API contract tests:**
- Problem: Public/frontend shape is inferred from UI normalizers and backend models.
- Blocks: Safe refactor of `_doc_to_kos()`, public field pruning, and pagination.

## Test Coverage Gaps

**Backend CRUD and parse actions:**
- What's not tested: Create/update/delete kos, bulk import duplicate handling, parse review persistence, LLM config save/get, job ownership, cancellation, and cleanup.
- Files: `backend/app/routers/admin_kos.py`, `backend/app/routers/admin_actions.py`, `backend/app/job_queue.py`
- Risk: Data loss, unauthorized job access, and silent parse failures ship unnoticed.
- Priority: High

**Frontend public map and directions:**
- What's not tested: Marker rendering, popup content, route request error states, API proxy failure behavior, and large dataset behavior.
- Files: `frontend/components/Map.tsx`, `frontend/components/CleanMapPrototype.tsx`, `frontend/app/api/directions/route.ts`
- Risk: Broken public UX or runaway Google API calls.
- Priority: High

**Admin parse workflow:**
- What's not tested: LLM config management, bulk parse, job polling, cancellation, approve/reject, feedback reparse, and background task indicator.
- Files: `admin/app/actions/parse/page.tsx`, `admin/app/prototype/clean-data/page.tsx`, `admin/hooks/useJobPoller.ts`, `admin/components/BackgroundTaskIndicator.tsx`
- Risk: Admin cannot safely clean data after UI/state refactors.
- Priority: High

**Deployment and container hardening:**
- What's not tested: Compose profile validation, service-to-service connectivity, production read-only filesystem compatibility, and staging backend exposure.
- Files: `compose.yaml`, `backend/Dockerfile`, `frontend/Dockerfile`, `admin/Dockerfile`, `.github/workflows/production.yml`, `.github/workflows/staging.yml`
- Risk: Deployment succeeds with insecure or nonfunctional runtime configuration.
- Priority: Medium

---

*Concerns audit: 2026-05-02*
