# Testing Patterns

**Analysis Date:** 2026-05-02

## Test Framework

**Runner:**
- Backend: `pytest` with async support from `pytest-asyncio`/AnyIO style markers. Dependencies declared in `backend/pyproject.toml`.
- Backend ASGI client: `httpx.AsyncClient` with `ASGITransport` in `backend/tests/test_smoke.py`.
- Admin E2E: Playwright `@playwright/test` configured by `admin/playwright.config.ts` and used in `admin/e2e/crud.spec.ts`.
- Frontend: Not detected; `frontend/package.json` has no test script and no `*.test.*`/`*.spec.*` files.

**Assertion Library:**
- Backend: bare Python `assert` in `backend/tests/test_smoke.py`.
- Admin E2E: Playwright `expect` from `@playwright/test` in `admin/e2e/crud.spec.ts`.

**Run Commands:**
```bash
cd backend && uv run pytest                         # Run backend pytest suite
cd backend && uv run pytest -k "test_health_ok"     # Run selected backend test
docker compose --profile development run --rm admin_e2e  # Run admin Playwright E2E in Docker
```

## Test File Organization

**Location:**
- Backend tests live in `backend/tests/`, currently `backend/tests/test_smoke.py` plus package marker `backend/tests/__init__.py`.
- Admin E2E tests live in `admin/e2e/`, currently `admin/e2e/crud.spec.ts`.
- Playwright config lives beside admin app in `admin/playwright.config.ts` with `testDir: "./e2e"`.
- Frontend tests: Not detected under `frontend/`.

**Naming:**
- Backend pytest files use `test_*.py`: `backend/tests/test_smoke.py`.
- Backend test functions use `test_*`: `test_health_ok`, `test_login_wrong_password`, `test_admin_write_requires_auth` in `backend/tests/test_smoke.py`.
- Playwright specs use `*.spec.ts`: `admin/e2e/crud.spec.ts`.
- Playwright test titles are human-readable strings: `"login and obtain auth token"`, `"create kos"`, `"delete kos and verify removed"` in `admin/e2e/crud.spec.ts`.

**Structure:**
```
backend/tests/
├── __init__.py
└── test_smoke.py        # FastAPI app smoke/auth/API tests

admin/e2e/
└── crud.spec.ts         # Admin CRUD Playwright API-flow E2E
```

## Test Structure

**Suite Organization:**
```typescript
// admin/e2e/crud.spec.ts
test.describe("Admin CRUD flow", () => {
  let token: string;
  let createdKosId: string;

  test.beforeAll(async ({ request }) => { /* cleanup */ });

  test("login and obtain auth token", async ({ request }) => { /* login */ });
  test("create kos", async ({ request }) => { /* create */ });
  test("verify kos appears in list", async ({ request }) => { /* verify */ });
  test("edit kos harga", async ({ request }) => { /* update */ });
  test("delete kos and verify removed", async ({ request }) => { /* delete */ });

  test.afterAll(async ({ request }) => { /* cleanup */ });
});
```

```python
# backend/tests/test_smoke.py
@pytest.fixture
def app():
    with patch("app.db.init_db", new_callable=AsyncMock):
        app = create_app()
        yield app

@pytest.mark.anyio
async def test_health_ok(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
```

**Patterns:**
- Backend setup uses fixtures for app construction and environment: `app`, `set_env`, `anyio_backend` in `backend/tests/test_smoke.py`.
- Backend tests instantiate `ASGITransport(app=app)` inside each test to avoid network and real server startup.
- Backend auth and DB dependencies are patched at import path used by code under test: `patch("app.db.init_db", new_callable=AsyncMock)`, `patch("app.routers.auth.verify_password", return_value=False)`, `patch("app.routers.master_uns.get_collection")` in `backend/tests/test_smoke.py`.
- Admin E2E stores cross-test state in suite variables (`token`, `createdKosId`, `createdKosName`) because CRUD tests run sequentially; `admin/playwright.config.ts` sets `fullyParallel: false`.
- Admin E2E cleanup runs before and after tests to delete records whose `nama` starts with `E2E Kos` in `admin/e2e/crud.spec.ts`.

## Mocking

**Framework:**
- Backend: `unittest.mock.patch`, `AsyncMock`, and `MagicMock` in `backend/tests/test_smoke.py`.
- Admin E2E: no mocking; uses Playwright `request` fixture against admin API proxy and backend URL.

**Patterns:**
```python
# backend/tests/test_smoke.py — patch async DB initialization
@pytest.fixture
def app():
    with patch("app.db.init_db", new_callable=AsyncMock):
        app = create_app()
        yield app

# backend/tests/test_smoke.py — patch auth verification branch
with patch("app.routers.auth.verify_password", return_value=False):
    resp = await client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})

# backend/tests/test_smoke.py — fake Motor collection cursor
async def _empty_cursor():
    if False:
        yield

with patch("app.routers.master_uns.get_collection") as mock_get_coll:
    mock_coll = MagicMock()
    mock_coll.find.return_value = _empty_cursor()
    mock_get_coll.return_value = mock_coll
```

**What to Mock:**
- Mock MongoDB initialization and collection access in backend unit/smoke tests; do not require live MongoDB for `backend/tests/`.
- Mock password verification for negative auth branches to avoid bcrypt fixture complexity: `backend/tests/test_smoke.py`.
- Mock filesystem-dependent seed paths for missing-file behavior: `patch("app.seed.SEED_PATH")` in `backend/tests/test_smoke.py`.
- For backend async DB methods, use `AsyncMock` when awaited and `MagicMock` when returning cursor-like objects.

**What NOT to Mock:**
- Do not mock FastAPI routing, HTTP status handling, or response JSON when testing API behavior; use `httpx.AsyncClient` with `ASGITransport` as in `backend/tests/test_smoke.py`.
- Do not mock admin E2E CRUD backend calls in `admin/e2e/crud.spec.ts`; these validate integration among admin proxy, backend, auth, and MongoDB inside Docker profile.
- Do not hit real external LLM or Google APIs in backend smoke tests; existing tests avoid those paths.

## Fixtures and Factories

**Test Data:**
```python
# backend/tests/test_smoke.py
_TEST_ENV = {
    "MONGO_URL": "mongodb://localhost:27017/test",
    "JWT_SECRET": "test-secret",
    "ADMIN_USERNAME": "admin",
    "ADMIN_PASSWORD_BCRYPT": "$2b$12$LJ3m4ys3Lk0TSwFhO0RyAOKMH8J2VvGMqD5l0QJ0Y0QJ0Y0QJ0Y0O",
    "JWT_EXPIRE_MINUTES": "60",
}
```

```typescript
// admin/e2e/crud.spec.ts
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://backend_dev:8000";
const createdKosName = `E2E Kos ${Date.now()}`;
```

**Location:**
- Backend test env fixture is inline in `backend/tests/test_smoke.py`; use `monkeypatch.setenv` in autouse fixtures for required environment keys.
- Admin E2E credentials and backend URL are inline constants in `admin/e2e/crud.spec.ts`, overridable via `E2E_ADMIN_USERNAME`, `E2E_ADMIN_PASSWORD`, and `E2E_BACKEND_URL`.
- No shared factories directory detected. Add local fixtures first; extract to `backend/tests/conftest.py` only when reused across multiple backend test files.

## Coverage

**Requirements:** None enforced. No coverage config detected in `backend/pyproject.toml`, `admin/package.json`, or `frontend/package.json`.

**View Coverage:**
```bash
# Not configured. Add pytest-cov or Playwright reporting before relying on coverage commands.
```

## Test Types

**Unit Tests:**
- Backend smoke/unit tests cover app health, auth failure, admin auth guard, seed missing-file behavior, and public master UNS list shape in `backend/tests/test_smoke.py`.
- Tests use direct app invocation and mocked dependencies rather than full Docker or real MongoDB.

**Integration Tests:**
- Admin Playwright spec exercises login and kos CRUD through HTTP APIs in `admin/e2e/crud.spec.ts`.
- Playwright base URL is `http://admin_dev:3001` in `admin/playwright.config.ts`; direct backend cleanup uses `http://backend_dev:8000` default in `admin/e2e/crud.spec.ts`.
- Admin E2E assumes Docker development network names and seeded admin credentials.

**E2E Tests:**
- Only admin E2E detected. It uses API-level `request` fixture, not browser page interactions, in `admin/e2e/crud.spec.ts`.
- Public frontend map has no E2E tests detected under `frontend/`.

## Common Patterns

**Async Testing:**
```python
# backend/tests/test_smoke.py
@pytest.mark.anyio
async def test_admin_write_requires_auth(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/admin/kos", json={"nama": "test", "lat": -7.56, "lon": 110.82})
    assert resp.status_code == 401
```

```typescript
// admin/e2e/crud.spec.ts
test("create kos", async ({ request }) => {
  test.skip(!token, "No auth token from login");
  const res = await request.post(`${BACKEND_URL}/api/admin/kos`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { nama: createdKosName, jenis: "Campuran", lat: -7.56, lon: 110.82 },
  });
  expect(res.status()).toBe(201);
});
```

**Error Testing:**
```python
# backend/tests/test_smoke.py
@pytest.mark.anyio
async def test_login_wrong_password(app):
    with patch("app.routers.auth.verify_password", return_value=False):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401
```

```typescript
// admin/e2e/crud.spec.ts
test.skip(!token, "No auth token");
expect(tokenCookie).toBeDefined();
expect(match).not.toBeNull();
expect(delRes.status()).toBe(204);
```

---

*Testing analysis: 2026-05-02*
