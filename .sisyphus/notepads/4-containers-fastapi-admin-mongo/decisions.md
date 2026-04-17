# Decisions (observed)

- Backend: FastAPI + `uv` + Motor (Mongo).
- Auth: JWT (HS256) + bcrypt; admin session via HttpOnly cookie in admin app.
- Frontend/backend integration: Next proxy route `/api/kos` → backend `/api/kos`.
- Action parsing: stub endpoint returns HTTP 501 with stable `expected_format` JSON.
