# Issues / Gaps

- **Expected outcome mismatch**: `compose.yaml` dev profile has **6** services (`mongodb`, `backend_dev`, `admin_dev`, `web_dev`, `admin_e2e`, plus prod/staging outside profile). Requirement says "compose.yaml has 4 services for dev profile".
- **Evidence gap**: `.sisyphus/evidence/` contains only 5 files; plan TODO list has 13 tasks; many tasks lack captured evidence artifacts.
- **Seed bug risk**: `backend/app/seed.py` uses `$setOnInsert: {"_id": None}` on upsert; Mongo `_id` unique → second insert likely `DuplicateKeyError` when seeding more than 1 new doc.
- Auth plan mentioned sleep/backoff on failures; current backend rate limit only returns 429 after threshold (no sleep/backoff).

- **passlib/bcrypt incompatibility**: `passlib[bcrypt]` crashes with bcrypt 4.1+ due to `detect_wrap_bug` ValueError. Fixed by replacing with direct `bcrypt` library. Login was returning 500 before fix.
- **KosOut alias serialization**: FastAPI defaults `response_model_by_alias=True`, so `KosOut.id` (alias `_id`) serializes as `_id` in JSON responses instead of `id`. Functional but inconsistent with typical REST conventions.
