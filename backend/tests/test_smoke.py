from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app

_TEST_ENV = {
    "MONGO_URL": "mongodb://localhost:27017/test",
    "JWT_SECRET": "test-secret",
    "ADMIN_USERNAME": "admin",
    "ADMIN_PASSWORD_BCRYPT": "$2b$12$LJ3m4ys3Lk0TSwFhO0RyAOKMH8J2VvGMqD5l0QJ0Y0QJ0Y0QJ0Y0O",
    "JWT_EXPIRE_MINUTES": "60",
}


@pytest.fixture
def app():
    with patch("app.db.init_db", new_callable=AsyncMock):
        app = create_app()
        yield app


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    for key, val in _TEST_ENV.items():
        monkeypatch.setenv(key, val)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_health_ok(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"


@pytest.mark.anyio
async def test_login_wrong_password(app):
    with patch("app.routers.auth.verify_password", return_value=False):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/auth/login",
                json={"username": "admin", "password": "wrong"},
            )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_admin_write_requires_auth(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/admin/kos",
            json={
                "nama": "test",
                "lat": -7.56,
                "lon": 110.82,
            },
        )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_seed_missing_file_exits_ok():
    with patch("app.seed.SEED_PATH") as mock_path:
        mock_path.exists.return_value = False
        with patch("app.seed.load_config"):
            from app.seed import seed

            await seed()

@pytest.mark.anyio
async def test_master_uns_returns_list(app):
    async def _empty_cursor():
        return
        yield  # make it an async generator

    from unittest.mock import MagicMock

    with patch("app.routers.master_uns.get_collection") as mock_get_coll:
        mock_coll = MagicMock()
        mock_coll.find.return_value = _empty_cursor()
        mock_get_coll.return_value = mock_coll
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/master-uns")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)