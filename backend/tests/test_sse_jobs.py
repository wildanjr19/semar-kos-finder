from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth import create_access_token
from app.job_queue import RESTART_INTERRUPTED_MESSAGE, Job
from app.main import create_app

_TEST_ENV = {
    "MONGO_URL": "mongodb://localhost:27017/test",
    "JWT_SECRET": "test-secret",
    "ADMIN_USERNAME": "admin",
    "ADMIN_PASSWORD_BCRYPT": "$2b$12$LJ3m4ys3Lk0TSwFhO0RyAOKMH8J2VvGMqD5l0QJ0Y0QJ0Y0QJ0Y0O",
    "JWT_EXPIRE_MINUTES": "60",
}


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    for key, val in _TEST_ENV.items():
        monkeypatch.setenv(key, val)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def app():
    with patch("app.db.init_db", new_callable=AsyncMock):
        yield create_app()


@pytest.fixture
def auth_headers():
    token = create_access_token("admin")
    return {"Authorization": f"Bearer {token}"}


def _job(status: str = "running", **overrides) -> Job:
    data = {
        "job_id": "job-1",
        "status": status,
        "total": 2,
        "completed": 0,
        "failed": 0,
        "current_index": None,
        "items": [],
        "results": [],
        "errors": [],
        "created_at": "2026-05-16T00:00:00+00:00",
        "username": "admin",
    }
    data.update(overrides)
    return Job(**data)


def _sse_events(body: str) -> list[dict[str, str]]:
    events = []
    for block in body.strip().split("\n\n"):
        parsed = {}
        for line in block.splitlines():
            key, value = line.split(": ", 1)
            parsed[key] = value
        events.append(parsed)
    return events


async def _get_events(app, headers: dict[str, str] | None = None) -> list[dict[str, str]]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await asyncio.wait_for(
            client.get("/api/admin/actions/parse/jobs/job-1/events", headers=headers),
            timeout=2,
        )
    assert resp.status_code == 200
    return _sse_events(resp.text)


@pytest.mark.anyio
async def test_sse_job_events_requires_auth(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/admin/actions/parse/jobs/job-1/events")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_authenticated_stream_emits_initial_snapshot(app, auth_headers):
    with patch("app.routers.admin_actions.get_job", AsyncMock(return_value=_job("done"))):
        events = await _get_events(app, auth_headers)

    assert events[0]["event"] == "job.snapshot"
    assert events[0]["id"] == "job-1:done:0:0:None"
    assert '"job_id":"job-1"' in events[0]["data"]


@pytest.mark.anyio
async def test_progress_changes_emit_job_progress_within_timeout(app, auth_headers, monkeypatch):
    monkeypatch.setattr("app.routers.admin_actions.SSE_POLL_SECONDS", 0.01)
    states = iter([
        _job("running", completed=0, current_index=None),
        _job("running", completed=1, current_index=1),
        _job("done", completed=2, current_index=None),
    ])

    async def fake_get_job(_job_id: str):
        return next(states)

    with patch("app.routers.admin_actions.get_job", fake_get_job):
        events = await _get_events(app, auth_headers)

    assert [event["event"] for event in events] == [
        "job.snapshot",
        "job.progress",
        "job.completed",
    ]
    assert '"completed":1' in events[1]["data"]


@pytest.mark.anyio
async def test_unchanged_running_job_emits_heartbeat(app, auth_headers, monkeypatch):
    monkeypatch.setattr("app.routers.admin_actions.SSE_POLL_SECONDS", 0.01)
    monkeypatch.setattr("app.routers.admin_actions.SSE_HEARTBEAT_SECONDS", 0)
    states = iter([
        _job("running", completed=0, current_index=None),
        _job("running", completed=0, current_index=None),
        _job("done", completed=2, current_index=None),
    ])

    async def fake_get_job(_job_id: str):
        return next(states)

    with patch("app.routers.admin_actions.get_job", fake_get_job):
        events = await _get_events(app, auth_headers)

    assert [event["event"] for event in events] == [
        "job.snapshot",
        "heartbeat",
        "job.completed",
    ]
    assert events[1]["data"] == "{}"


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("status", "event"),
    [
        ("done", "job.completed"),
        ("error", "job.error"),
        ("cancelled", "job.cancelled"),
    ],
)
async def test_terminal_events_close_cleanly(app, auth_headers, status, event):
    with patch("app.routers.admin_actions.get_job", AsyncMock(return_value=_job(status))):
        events = await _get_events(app, auth_headers)

    assert [item["event"] for item in events] == ["job.snapshot", event]


@pytest.mark.anyio
async def test_db_only_running_job_becomes_stale_error(monkeypatch):
    from app import job_queue

    job_queue._jobs.clear()
    coll = MagicMock()
    coll.find_one = AsyncMock(return_value={
        "job_id": "job-db",
        "status": "running",
        "total": 3,
        "completed": 1,
        "failed": 0,
        "current_index": 1,
        "items": [],
        "results": [],
        "errors": [],
        "created_at": "2026-05-16T00:00:00+00:00",
        "username": "admin",
    })
    coll.update_one = AsyncMock()
    monkeypatch.setattr(job_queue, "_jobs_coll", lambda: coll)

    job = await job_queue.get_job("job-db")

    assert job is not None
    assert job.status == "error"
    assert job.current_index is None
    assert job.errors == [{"error": RESTART_INTERRUPTED_MESSAGE}]
    coll.update_one.assert_awaited_once()
    update = coll.update_one.await_args.args[1]
    assert update["$set"]["status"] == "error"
    assert update["$set"]["errors"] == [{"error": RESTART_INTERRUPTED_MESSAGE}]
    job_queue._jobs.clear()
