"""In-memory background job queue for batch kos parsing."""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.parse_engine import parse_single_entry


@dataclass
class Job:
    job_id: str
    status: str  # "pending" | "running" | "done" | "cancelled"
    total: int
    completed: int = 0
    failed: int = 0
    results: list[dict] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)
    created_at: str = ""
    prompt_overrides: dict[int, str] | None = None
    override_config: dict | None = None
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
        }


# In-memory store — cleared on restart. Acceptable for MVP.
_jobs: dict[str, Job] = {}
_lock = asyncio.Lock()


def create_job(
    entries: list[dict],
    prompt_overrides: dict[int, str] | None = None,
    override_config: dict | None = None,
) -> Job:
    """Create new job and start background processing."""
    job_id = uuid.uuid4().hex[:12]
    job = Job(
        job_id=job_id,
        status="pending",
        total=len(entries),
        prompt_overrides=prompt_overrides,
        override_config=override_config,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    _jobs[job_id] = job
    job._task = asyncio.create_task(_run_job(job, entries))
    return job


async def get_job(job_id: str) -> Job | None:
    return _jobs.get(job_id)


async def cancel_job(job_id: str) -> bool:
    async with _lock:
        job = _jobs.get(job_id)
        if job and job.status in ("pending", "running"):
            if job._task:
                job._task.cancel()
            job.status = "cancelled"
            return True
    return False


def cleanup_old_jobs(max_age_seconds: int = 3600) -> None:
    now = datetime.now(timezone.utc)
    to_remove: list[str] = []
    for jid, job in _jobs.items():
        if job.status in ("done", "cancelled"):
            created = datetime.fromisoformat(job.created_at)
            if (now - created).total_seconds() > max_age_seconds:
                to_remove.append(jid)
    for jid in to_remove:
        del _jobs[jid]


async def _run_job(job: Job, entries: list[dict]) -> None:
    job.status = "running"

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
            return
        except Exception as e:
            async with _lock:
                job.errors.append({
                    "index": idx,
                    "raw": entry,
                    "error": str(e),
                })
                job.failed += 1

    async with _lock:
        job.status = "done"
