# Learnings

- Dev profile core services present: `web_dev` (3000), `admin_dev` (3001), `backend_dev` (8000), `mongodb` (internal).
- Frontend Map switched to `fetch("/api/kos")` and supports backend DTO + legacy JSON row shape.
- Backend Mongo readiness uses retry ping loop + `_ready` flag; `/health` reports `db: ok|down`.
- Admin auth flow: Next route proxies backend login; sets HttpOnly `admin_token` cookie; middleware protects `/kos` + `/actions`.

- **passlib→bcrypt migration**: Replace `passlib[bcrypt]` with `bcrypt>=4.0,<5.0` in pyproject.toml. Use `bcrypt.checkpw(plain.encode(), hashed.encode())` instead of `passlib.hash.bcrypt.verify()`. Passlib's internal `detect_wrap_bug` is incompatible with bcrypt 4.1+.
- **Admin CRUD endpoints**: Under `/api/admin/kos` (not `/api/kos`). Public `/api/kos` is read-only. Action parse at `/api/admin/actions/parse` returns 501 with `expected_format` contract.
- **rtk curl output distortion**: `rtk` wrapper transforms JSON output (shows type annotations instead of values). Use `/usr/bin/curl` directly for programmatic parsing.
