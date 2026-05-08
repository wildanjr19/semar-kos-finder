"""Background job queue for batch kos parsing with DB persistence."""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.db import get_collection
from app.parse_engine import parse_single_entry

logger = logging.getLogger(__name__)


@dataclass
class Job:
    job_id: str
    status: str  # "pending" | "running" | "done" | "cancelled" | "error"
    total: int
    completed: int = 0
    failed: int = 0
    results: list[dict] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)
    created_at: str = ""
    prompt_overrides: dict[int, str] | None = None
    override_config: dict | None = None
    username: str = ""
    _task: asyncio.Task | None = None

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "total": self.total,
            "completed": self.completed,
            "failed": self.failed,
            "results": self.results,
            "errors": self.errors,
            "created_at": self.created_at,
            "username": self.username,
        }


# In-memory store for runtime speed; DB is source of truth.
_jobs: dict[str, Job] = {}
_lock = asyncio.Lock()


def _jobs_coll():
    return get_collection("parse_jobs")


def _kos_coll():
    return get_collection("kos")


async def _persist_parsed_result(raw_entry: dict, clean: dict) -> None:
    from bson import ObjectId

    kos_id = raw_entry.get("id")
    if not kos_id:
        return
    _id = ObjectId(kos_id) if ObjectId.is_valid(kos_id) else kos_id
    now = datetime.now(timezone.utc)
    await _kos_coll().update_one(
        {"_id": _id},
        {
            "$set": {
                "parsed_data": clean,
                "data_status": "parsed",
                "last_parsed_at": now,
                "updated_at": now,
            },
            "$unset": {
                "reviewed_at": "",
                "reviewed_by": "",
            },
        },
    )


async def _persist_job(job: Job) -> None:
    """Upsert job state into MongoDB."""
    try:
        await _jobs_coll().update_one(
            {"job_id": job.job_id},
            {
                "$set": {
                    "job_id": job.job_id,
                    "username": job.username,
                    "status": job.status,
                    "total": job.total,
                    "completed": job.completed,
                    "failed": job.failed,
                    "results": job.results,
                    "errors": job.errors,
                    "created_at": job.created_at,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True,
        )
    except Exception as exc:
        logger.warning("Failed to persist job %s: %s", job.job_id, exc)


async def create_job(
    entries: list[dict],
    username: str,
    prompt_overrides: dict[int, str] | None = None,
    override_config: dict | None = None,
) -> Job:
    """Create new job, persist to DB, and start background processing."""
    job_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    job = Job(
        job_id=job_id,
        status="pending",
        total=len(entries),
        prompt_overrides=prompt_overrides,
        override_config=override_config,
        created_at=now,
        username=username,
    )
    _jobs[job_id] = job
    await _persist_job(job)
    job._task = asyncio.create_task(_run_job(job, entries))
    return job


async def get_job(job_id: str) -> Job | None:
    # Runtime cache first
    job = _jobs.get(job_id)
    if job:
        return job
    # Fallback to DB
    try:
        doc = await _jobs_coll().find_one({"job_id": job_id})
        if doc:
            # Rehydrate minimal Job for read-only usage
            job = Job(
                job_id=doc["job_id"],
                status=doc["status"],
                total=doc["total"],
                completed=doc.get("completed", 0),
                failed=doc.get("failed", 0),
                results=doc.get("results", []),
                errors=doc.get("errors", []),
                created_at=doc.get("created_at", ""),
                username=doc.get("username", ""),
            )
            _jobs[job_id] = job
            return job
    except Exception as exc:
        logger.warning("DB fallback get_job failed: %s", exc)
    return None


async def list_jobs(username: str | None = None, status: str | None = None) -> list[dict]:
    """List persisted jobs from DB, optionally filtered."""
    query: dict = {}
    if username:
        query["username"] = username
    if status:
        query["status"] = status
    try:
        cursor = _jobs_coll().find(query).sort("created_at", -1).limit(200)
        docs = await cursor.to_list(length=200)
        return [
            {
                "job_id": d["job_id"],
                "username": d.get("username", ""),
                "status": d["status"],
                "total": d["total"],
                "completed": d.get("completed", 0),
                "failed": d.get("failed", 0),
                "created_at": d.get("created_at", ""),
                "updated_at": d.get("updated_at", ""),
            }
            for d in docs
        ]
    except Exception as exc:
        logger.warning("DB list_jobs failed: %s", exc)
        return []


async def cancel_job(job_id: str) -> bool:
    async with _lock:
        job = _jobs.get(job_id)
        if job and job.status in ("pending", "running"):
            if job._task:
                job._task.cancel()
            job.status = "cancelled"
            await _persist_job(job)
            return True
    return False


def cleanup_old_jobs(max_age_seconds: int = 3600) -> None:
    """Remove old done/cancelled jobs from memory and DB."""
    now = datetime.now(timezone.utc)
    to_remove_mem: list[str] = []
    for jid, job in _jobs.items():
        if job.status in ("done", "cancelled", "error"):
            created = datetime.fromisoformat(job.created_at)
            if (now - created).total_seconds() > max_age_seconds:
                to_remove_mem.append(jid)
    for jid in to_remove_mem:
        del _jobs[jid]

    # DB cleanup (async inside sync function is tricky; schedule fire-and-forget)
    try:
        cutoff = (now - __import__("datetime").timedelta(seconds=max_age_seconds)).isoformat()
        asyncio.create_task(
            _jobs_coll().delete_many({
                "status": {"$in": ["done", "cancelled", "error"]},
                "updated_at": {"$lt": cutoff},
            })
        )
    except Exception as exc:
        logger.warning("DB cleanup_old_jobs failed: %s", exc)


async def _run_job(job: Job, entries: list[dict]) -> None:
    job.status = "running"
    await _persist_job(job)

    for idx, entry in enumerate(entries):
        async with _lock:
            if job.status == "cancelled":
                return

        try:
            custom = None
            if job.prompt_overrides and idx in job.prompt_overrides:
                custom = job.prompt_overrides[idx]

            result = await parse_single_entry(
                entry,
                custom_prompt=custom,
                override_config=job.override_config,
            )
            await _persist_parsed_result(entry, result)

            async with _lock:
                job.results.append({
                    "index": idx,
                    "raw": entry,
                    "clean": result,
                    "error": None,
                })
                job.completed += 1
        except asyncio.CancelledError:
            async with _lock:
                job.status = "cancelled"
            await _persist_job(job)
            return
        except Exception as e:
            async with _lock:
                job.errors.append({
                    "index": idx,
                    "raw": entry,
                    "error": str(e),
                })
                job.failed += 1

        # Persist incremental progress every 3 items or on last item
        if (idx + 1) % 3 == 0 or idx == len(entries) - 1:
            await _persist_job(job)

    async with _lock:
        job.status = "done"
    await _persist_job(job)
