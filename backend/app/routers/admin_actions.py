"""Admin action parsing endpoints with background job support."""

from __future__ import annotations

import logging
import json
import asyncio
from datetime import datetime
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

from app.auth import require_auth
from app.db import get_collection
from app.job_queue import cancel_job, create_job, get_job, list_jobs
from app.parse_engine import parse_single_entry, test_llm_connection

router = APIRouter(prefix="/api/admin/actions", tags=["admin-actions"])
logger = logging.getLogger(__name__)
SSE_HEARTBEAT_SECONDS = 15.0
SSE_POLL_SECONDS = 0.25


def _duration_ms(start: float) -> int:
    return round((monotonic() - start) * 1000)


def _entry_id(entry: dict) -> str:
    return str(entry.get("id") or entry.get("_id") or entry.get("No") or "")


def _job_event_id(job: dict) -> str:
    return ":".join(
        [
            str(job.get("job_id", "")),
            str(job.get("status", "")),
            str(job.get("completed", 0)),
            str(job.get("failed", 0)),
            str(job.get("current_index")),
        ]
    )


def _job_progress_signature(job: dict) -> tuple:
    return (
        job.get("status"),
        job.get("completed"),
        job.get("failed"),
        job.get("current_index"),
    )


def _sse_frame(event: str, data: dict, event_id: str) -> str:
    return f"event: {event}\nid: {event_id}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


def _terminal_job_event(status: str) -> str | None:
    return {
        "done": "job.completed",
        "error": "job.error",
        "cancelled": "job.cancelled",
    }.get(status)


def _user_llm_coll():
    return get_collection("user_settings")


async def _get_merged_llm_config(username: str, override: dict | None = None) -> dict | None:
    """Fetch saved user config and merge with request override."""
    saved = await _user_llm_coll().find_one({"username": username})
    if not saved and not override:
        return None
    base = {
        "api_base": saved.get("api_base", "") if saved else "",
        "api_key": saved.get("api_key", "") if saved else "",
        "model": saved.get("model", "") if saved else "",
        "max_tokens": saved.get("max_tokens", 4096) if saved else 4096,
        "temperature": saved.get("temperature", 0.1) if saved else 0.1,
    }
    if override:
        for k, v in override.items():
            if v is not None and v != "":
                base[k] = v
    return base


class ParseEntryRequest(BaseModel):
    entry: dict
    custom_prompt: str | None = None
    override_config: dict | None = None


class ParseBulkRequest(BaseModel):
    entries: list[dict]
    prompt_overrides: dict[int, str] | None = None
    override_config: dict | None = None


class LlmTestRequest(BaseModel):
    api_base: str
    api_key: str
    model: str = Field(default="gpt-4o")
    max_tokens: int = Field(default=4096)
    temperature: float = Field(default=0.1)


class LlmConfigResponse(BaseModel):
    api_base: str
    api_key: str
    model: str
    max_tokens: int
    temperature: float


class LlmConfigSaveRequest(BaseModel):
    api_base: str
    api_key: str
    model: str
    max_tokens: int = Field(default=4096)
    temperature: float = Field(default=0.1)


@router.post("/parse/entry")
async def parse_entry(req: ParseEntryRequest, username: str = Depends(require_auth)) -> dict:
    """Parse single entry synchronously (blocking, returns clean data immediately)."""
    started = monotonic()
    entry_id = _entry_id(req.entry)
    logger.info(
        "parse_entry_request_started username=%s entry_id=%s has_override_config=%s has_custom_prompt=%s",
        username,
        entry_id,
        req.override_config is not None,
        bool(req.custom_prompt),
    )
    try:
        merged = await _get_merged_llm_config(username, req.override_config)
        result = await parse_single_entry(
            req.entry,
            custom_prompt=req.custom_prompt,
            override_config=merged,
        )
        logger.info(
            "parse_entry_request_finished username=%s entry_id=%s duration_ms=%s",
            username,
            entry_id,
            _duration_ms(started),
        )
        return result
    except ValueError as e:
        logger.warning(
            "parse_entry_request_invalid username=%s entry_id=%s duration_ms=%s error=%s",
            username,
            entry_id,
            _duration_ms(started),
            str(e),
        )
        raise HTTPException(status_code=422, detail={"error": str(e)}) from e
    except Exception as e:
        logger.exception(
            "parse_entry_request_failed username=%s entry_id=%s duration_ms=%s error=%s",
            username,
            entry_id,
            _duration_ms(started),
            str(e),
        )
        raise HTTPException(status_code=500, detail={"error": str(e)}) from e


@router.post("/parse/bulk")
async def parse_bulk(req: ParseBulkRequest, username: str = Depends(require_auth)) -> dict:
    """Start background batch parse job. Returns job_id immediately."""
    if not req.entries:
        raise HTTPException(status_code=400, detail={"error": "No entries provided"})
    started = monotonic()
    logger.info(
        "parse_bulk_request_started username=%s total=%s has_override_config=%s prompt_override_count=%s",
        username,
        len(req.entries),
        req.override_config is not None,
        len(req.prompt_overrides or {}),
    )
    merged = await _get_merged_llm_config(username, req.override_config)
    job = await create_job(
        req.entries,
        username=username,
        prompt_overrides=req.prompt_overrides,
        override_config=merged,
    )
    logger.info(
        "parse_bulk_request_finished username=%s job_id=%s total=%s duration_ms=%s",
        username,
        job.job_id,
        job.total,
        _duration_ms(started),
    )
    return {
        "job_id": job.job_id,
        "status": job.status,
        "total": job.total,
    }


@router.get("/parse/jobs")
async def list_parse_jobs(
    status: str | None = Query(None),
    username: str = Depends(require_auth),
) -> list[dict]:
    """List persisted parse jobs for the current user."""
    return await list_jobs(username=username, status=status)


@router.get("/parse/jobs/{job_id}")
async def get_parse_job(job_id: str, username: str = Depends(require_auth)) -> dict:
    """Poll job status and partial results."""
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"error": "Job not found"})
    if job.username != username:
        raise HTTPException(status_code=403, detail={"error": "Forbidden"})
    return job.to_dict()


@router.get("/parse/jobs/{job_id}/events")
async def stream_parse_job_events(
    job_id: str,
    request: Request,
    username: str = Depends(require_auth),
) -> StreamingResponse:
    """Stream job state changes via manually-framed Server-Sent Events."""
    # SSE proxy buffering must be disabled (X-Accel-Buffering: no, no-transform cache)
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"error": "Job not found"})
    if job.username != username:
        raise HTTPException(status_code=403, detail={"error": "Forbidden"})

    async def event_stream():
        current = job.to_dict()
        last_signature = _job_progress_signature(current)
        last_event_at = monotonic()
        yield _sse_frame("job.snapshot", current, _job_event_id(current))

        terminal_event = _terminal_job_event(str(current.get("status")))
        if terminal_event:
            yield _sse_frame(terminal_event, current, _job_event_id(current))
            return

        while True:
            if await request.is_disconnected():
                return

            await asyncio.sleep(SSE_POLL_SECONDS)
            latest_job = await get_job(job_id)
            if not latest_job:
                payload = {"job_id": job_id, "status": "error", "error": "Job not found"}
                yield _sse_frame("job.error", payload, f"{job_id}:missing")
                return

            payload = latest_job.to_dict()
            signature = _job_progress_signature(payload)
            event_id = _job_event_id(payload)
            terminal_event = _terminal_job_event(str(payload.get("status")))

            if terminal_event:
                yield _sse_frame(terminal_event, payload, event_id)
                return

            if signature != last_signature:
                last_signature = signature
                last_event_at = monotonic()
                yield _sse_frame("job.progress", payload, event_id)
                continue

            if monotonic() - last_event_at >= SSE_HEARTBEAT_SECONDS:
                last_event_at = monotonic()
                yield _sse_frame("heartbeat", {}, f"{job_id}:heartbeat")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/parse/jobs/{job_id}/cancel")
async def cancel_parse_job(job_id: str, username: str = Depends(require_auth)) -> dict:
    """Cancel a running parse job."""
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"error": "Job not found"})
    if job.username != username:
        raise HTTPException(status_code=403, detail={"error": "Forbidden"})
    ok = await cancel_job(job_id)
    if not ok:
        raise HTTPException(
            status_code=404, detail={"error": "Job not found or not running"}
        )
    return {"status": "cancelled"}


class ParseImportRequest(BaseModel):
    items: list[dict]
    dry_run: bool = False


class ParseReviewItem(BaseModel):
    id: str
    status: str = Field(pattern="^(reviewed|rejected)$")
    parsed_data: dict | None = None


class ParseReviewRequest(BaseModel):
    items: list[ParseReviewItem]


@router.post("/parse/import")
async def parse_import(req: ParseImportRequest, _username: str = Depends(require_auth)) -> dict:
    """Import approved clean data into DB. Updates existing kos docs."""
    coll = get_collection("kos")
    updated = 0
    skipped = 0
    errors: list[str] = []

    for item in req.items:
        kos_id = item.get("id")
        parsed_data = item.get("parsed_data")
        data_status = item.get("data_status", "reviewed")

        if not kos_id or not parsed_data:
            skipped += 1
            continue

        from bson import ObjectId

        _id = ObjectId(kos_id) if ObjectId.is_valid(kos_id) else kos_id

        updates = {
            "parsed_data": parsed_data,
            "data_status": data_status,
            "reviewed_at": datetime.utcnow() if data_status == "reviewed" else None,
            "reviewed_by": _username if data_status == "reviewed" else None,
            "updated_at": datetime.utcnow(),
        }

        if req.dry_run:
            # Just verify the doc exists
            doc = await coll.find_one({"_id": _id})
            if not doc:
                errors.append(f"ID {kos_id} not found")
            continue

        result = await coll.update_one({"_id": _id}, {"$set": updates})
        if result.matched_count:
            updated += 1
        else:
            errors.append(f"ID {kos_id} not found")

    return {"updated": updated, "skipped": skipped, "errors": errors, "dry_run": req.dry_run}


@router.post("/parse/review")
async def parse_review(req: ParseReviewRequest, username: str = Depends(require_auth)) -> dict:
    """Persist review decision (reviewed/rejected) for parsed entries."""
    coll = get_collection("kos")
    updated = 0
    skipped = 0
    errors: list[str] = []

    from bson import ObjectId

    for item in req.items:
        _id = ObjectId(item.id) if ObjectId.is_valid(item.id) else item.id
        updates: dict = {
            "data_status": item.status,
            "updated_at": datetime.utcnow(),
        }

        if item.status == "reviewed":
            updates["reviewed_at"] = datetime.utcnow()
            updates["reviewed_by"] = username
            if item.parsed_data is not None:
                updates["parsed_data"] = item.parsed_data
        else:
            updates["reviewed_at"] = None
            updates["reviewed_by"] = None

        result = await coll.update_one({"_id": _id}, {"$set": updates})
        if result.matched_count:
            updated += 1
        else:
            skipped += 1
            errors.append(f"ID {item.id} not found")

    return {"updated": updated, "skipped": skipped, "errors": errors}


@router.post("/llm/test")
async def test_llm(req: LlmTestRequest, username: str = Depends(require_auth)) -> dict:
    """Test LLM connection with given config, merged with saved user config."""
    override = {
        "api_base": req.api_base,
        "api_key": req.api_key,
        "model": req.model,
        "max_tokens": req.max_tokens,
        "temperature": req.temperature,
    }
    merged = await _get_merged_llm_config(username, override)
    result = await test_llm_connection(merged or override)
    if result.get("status") == "error":
        return result
    return result


@router.get("/config/llm")
async def get_llm_config(username: str = Depends(require_auth)) -> dict:
    """Return saved LLM config for current user (keys masked for safety)."""
    doc = await _user_llm_coll().find_one({"username": username})
    if not doc:
        raise HTTPException(status_code=404, detail={"error": "No config saved"})
    return {
        "api_base": doc.get("api_base", ""),
        "api_key": doc.get("api_key", ""),
        "model": doc.get("model", ""),
        "max_tokens": doc.get("max_tokens", 4096),
        "temperature": doc.get("temperature", 0.1),
    }


@router.put("/config/llm")
async def save_llm_config(req: LlmConfigSaveRequest, username: str = Depends(require_auth)) -> dict:
    """Save or update LLM config for current user."""
    await _user_llm_coll().update_one(
        {"username": username},
        {
            "$set": {
                "username": username,
                "api_base": req.api_base,
                "api_key": req.api_key,
                "model": req.model,
                "max_tokens": req.max_tokens,
                "temperature": req.temperature,
                "updated_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )
    return {"status": "saved"}
