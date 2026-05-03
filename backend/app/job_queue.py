"""Background job queue for batch kos parsing with DB persistence."""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from time import monotonic

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
    current_index: int | None = None
    items: list[dict] = field(default_factory=list)
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
            "current_index": self.current_index,
            "items": self.items,
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


def _entry_name(entry: dict) -> str:
    return str(
        entry.get("Nama kos")
        or entry.get("nama")
        or entry.get("name")
        or entry.get("id")
        or "Kos tanpa nama"
    )


def _entry_id(entry: dict) -> str:
    return str(entry.get("id") or entry.get("_id") or entry.get("No") or "")


def _duration_ms(start: float) -> int:
    return round((monotonic() - start) * 1000)


def _error_text(exc: Exception, limit: int = 500) -> str:
    text = str(exc).replace("\n", " ")
    return text[:limit]


def _job_concurrency() -> int:
    raw = os.getenv("PARSE_JOB_CONCURRENCY", "3")
    try:
        value = int(raw)
    except ValueError:
        logger.warning("Invalid PARSE_JOB_CONCURRENCY=%s, using 3", raw)
        return 3
    return max(1, min(value, 10))


def _refresh_current_index(job: Job) -> None:
    active = [item.get("index") for item in job.items if item.get("status") == "in_progress"]
    job.current_index = min(active) if active else None


def _job_item(index: int, entry: dict) -> dict:
    return {
        "index": index,
        "id": _entry_id(entry),
        "name": _entry_name(entry),
        "status": "todo",
        "error": None,
        "started_at": None,
        "finished_at": None,
        "duration_ms": None,
    }


def _mark_remaining_cancelled(job: Job) -> None:
    now = datetime.now(timezone.utc).isoformat()
    for item in job.items:
        if item.get("status") in ("todo", "in_progress"):
            item["status"] = "cancelled"
            item["finished_at"] = now


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
                    "current_index": job.current_index,
                    "items": job.items,
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
        items=[_job_item(index, entry) for index, entry in enumerate(entries)],
        prompt_overrides=prompt_overrides,
        override_config=override_config,
        created_at=now,
        username=username,
    )
    _jobs[job_id] = job
    await _persist_job(job)
    job._task = asyncio.create_task(_run_job(job, entries))
    logger.info(
        "parse_job_created job_id=%s username=%s total=%s concurrency=%s",
        job.job_id,
        username,
        job.total,
        _job_concurrency(),
    )
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
                current_index=doc.get("current_index"),
                items=doc.get("items", []),
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
                "current_index": d.get("current_index"),
                "created_at": d.get("created_at", ""),
                "updated_at": d.get("updated_at", ""),
            }
            for d in docs
        ]
    except Exception as exc:
        logger.warning("DB list_jobs failed: %s", exc)
        return []


async def cancel_job(job_id: str) -> bool:
    job_to_persist: Job | None = None
    async with _lock:
        job = _jobs.get(job_id)
        if job and job.status in ("pending", "running"):
            if job._task:
                job._task.cancel()
            job.status = "cancelled"
            _mark_remaining_cancelled(job)
            _refresh_current_index(job)
            job_to_persist = job
    if not job_to_persist:
        return False
    await _persist_job(job_to_persist)
    logger.info("parse_job_cancel_requested job_id=%s", job_id)
    return True


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


async def _run_job_item(job: Job, idx: int, entry: dict, semaphore: asyncio.Semaphore) -> None:
    async with semaphore:
        started = monotonic()
        item_id = _entry_id(entry)
        item_name = _entry_name(entry)
        now = datetime.now(timezone.utc).isoformat()

        async with _lock:
            if job.status == "cancelled":
                if idx < len(job.items):
                    job.items[idx]["status"] = "cancelled"
                    job.items[idx]["finished_at"] = now
                _refresh_current_index(job)
                return
            if idx < len(job.items):
                job.items[idx]["status"] = "in_progress"
                job.items[idx]["started_at"] = now
                job.items[idx]["error"] = None
                job.items[idx]["duration_ms"] = None
            _refresh_current_index(job)

        await _persist_job(job)
        logger.info(
            "parse_job_item_started job_id=%s index=%s entry_id=%s entry_name=%s",
            job.job_id,
            idx,
            item_id,
            item_name,
        )

        try:
            custom = None
            if job.prompt_overrides and idx in job.prompt_overrides:
                custom = job.prompt_overrides[idx]

            result = await parse_single_entry(
                entry,
                custom_prompt=custom,
                override_config=job.override_config,
            )

            async with _lock:
                if job.status == "cancelled":
                    if idx < len(job.items):
                        job.items[idx]["status"] = "cancelled"
                        job.items[idx]["finished_at"] = datetime.now(timezone.utc).isoformat()
                        job.items[idx]["duration_ms"] = _duration_ms(started)
                    _refresh_current_index(job)
                    return

            await _persist_parsed_result(entry, result)
            duration_ms = _duration_ms(started)

            async with _lock:
                if idx < len(job.items):
                    job.items[idx]["status"] = "done"
                    job.items[idx]["finished_at"] = datetime.now(timezone.utc).isoformat()
                    job.items[idx]["duration_ms"] = duration_ms
                job.results.append({
                    "index": idx,
                    "raw": entry,
                    "clean": result,
                    "error": None,
                })
                job.completed += 1
                _refresh_current_index(job)
            logger.info(
                "parse_job_item_done job_id=%s index=%s entry_id=%s duration_ms=%s completed=%s failed=%s total=%s",
                job.job_id,
                idx,
                item_id,
                duration_ms,
                job.completed,
                job.failed,
                job.total,
            )
        except asyncio.CancelledError:
            duration_ms = _duration_ms(started)
            async with _lock:
                if idx < len(job.items):
                    job.items[idx]["status"] = "cancelled"
                    job.items[idx]["finished_at"] = datetime.now(timezone.utc).isoformat()
                    job.items[idx]["duration_ms"] = duration_ms
                _mark_remaining_cancelled(job)
                _refresh_current_index(job)
            await _persist_job(job)
            logger.info(
                "parse_job_item_cancelled job_id=%s index=%s entry_id=%s duration_ms=%s",
                job.job_id,
                idx,
                item_id,
                duration_ms,
            )
            raise
        except Exception as e:
            duration_ms = _duration_ms(started)
            async with _lock:
                if idx < len(job.items):
                    job.items[idx]["status"] = "error"
                    job.items[idx]["error"] = str(e)
                    job.items[idx]["finished_at"] = datetime.now(timezone.utc).isoformat()
                    job.items[idx]["duration_ms"] = duration_ms
                job.errors.append({
                    "index": idx,
                    "raw": entry,
                    "error": str(e),
                })
                job.failed += 1
                _refresh_current_index(job)
            logger.exception(
                "parse_job_item_failed job_id=%s index=%s entry_id=%s duration_ms=%s error=%s",
                job.job_id,
                idx,
                item_id,
                duration_ms,
                _error_text(e),
            )

        await _persist_job(job)


async def _run_job(job: Job, entries: list[dict]) -> None:
    started = monotonic()
    concurrency = _job_concurrency()
    job.status = "running"
    await _persist_job(job)
    logger.info(
        "parse_job_started job_id=%s username=%s total=%s concurrency=%s",
        job.job_id,
        job.username,
        job.total,
        concurrency,
    )

    semaphore = asyncio.Semaphore(concurrency)
    tasks = [
        asyncio.create_task(_run_job_item(job, idx, entry, semaphore))
        for idx, entry in enumerate(entries)
    ]

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        async with _lock:
            job.status = "cancelled"
            _mark_remaining_cancelled(job)
            _refresh_current_index(job)
        await _persist_job(job)
        logger.info(
            "parse_job_cancelled job_id=%s duration_ms=%s completed=%s failed=%s total=%s",
            job.job_id,
            _duration_ms(started),
            job.completed,
            job.failed,
            job.total,
        )
        return

    async with _lock:
        if job.status != "cancelled":
            job.status = "done"
        _refresh_current_index(job)
    await _persist_job(job)
    logger.info(
        "parse_job_finished job_id=%s status=%s duration_ms=%s completed=%s failed=%s total=%s concurrency=%s",
        job.job_id,
        job.status,
        _duration_ms(started),
        job.completed,
        job.failed,
        job.total,
        concurrency,
    )
