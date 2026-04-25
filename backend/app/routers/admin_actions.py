"""Admin action parsing endpoints with background job support."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import require_auth
from app.db import get_collection
from app.job_queue import cancel_job, create_job, get_job
from app.parse_engine import parse_single_entry, test_llm_connection

router = APIRouter(prefix="/api/admin/actions", tags=["admin-actions"])


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


@router.post("/parse/entry")
async def parse_entry(req: ParseEntryRequest, _username: str = Depends(require_auth)) -> dict:
    """Parse single entry synchronously (blocking, returns clean data immediately)."""
    try:
        result = await parse_single_entry(
            req.entry,
            custom_prompt=req.custom_prompt,
            override_config=req.override_config,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": str(e)}) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)}) from e


@router.post("/parse/bulk")
async def parse_bulk(req: ParseBulkRequest, _username: str = Depends(require_auth)) -> dict:
    """Start background batch parse job. Returns job_id immediately."""
    if not req.entries:
        raise HTTPException(status_code=400, detail={"error": "No entries provided"})
    job = create_job(
        req.entries,
        prompt_overrides=req.prompt_overrides,
        override_config=req.override_config,
    )
    return {
        "job_id": job.job_id,
        "status": job.status,
        "total": job.total,
    }


@router.get("/parse/jobs/{job_id}")
async def get_parse_job(job_id: str, _username: str = Depends(require_auth)) -> dict:
    """Poll job status and partial results."""
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"error": "Job not found"})
    return job.to_dict()


@router.post("/parse/jobs/{job_id}/cancel")
async def cancel_parse_job(job_id: str, _username: str = Depends(require_auth)) -> dict:
    """Cancel a running parse job."""
    ok = await cancel_job(job_id)
    if not ok:
        raise HTTPException(
            status_code=404, detail={"error": "Job not found or not running"}
        )
    return {"status": "cancelled"}


class ParseImportRequest(BaseModel):
    items: list[dict]
    dry_run: bool = False


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


@router.post("/llm/test")
async def test_llm(req: LlmTestRequest, _username: str = Depends(require_auth)) -> dict:
    """Test LLM connection with given config."""
    override = {
        "api_base": req.api_base,
        "api_key": req.api_key,
        "model": req.model,
        "max_tokens": req.max_tokens,
        "temperature": req.temperature,
    }
    result = await test_llm_connection(override)
    if result.get("status") == "error":
        # Return 200 with error body so UI can read it; or 422 if you prefer
        return result
    return result
