"""Admin action parsing endpoints with background job support."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import require_auth
from app.db import get_collection
from app.job_queue import cancel_job, create_job, get_job, list_jobs
from app.parse_engine import parse_single_entry, test_llm_connection

router = APIRouter(prefix="/api/admin/actions", tags=["admin-actions"])


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
    try:
        merged = await _get_merged_llm_config(username, req.override_config)
        result = await parse_single_entry(
            req.entry,
            custom_prompt=req.custom_prompt,
            override_config=merged,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": str(e)}) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)}) from e


@router.post("/parse/bulk")
async def parse_bulk(req: ParseBulkRequest, username: str = Depends(require_auth)) -> dict:
    """Start background batch parse job. Returns job_id immediately."""
    if not req.entries:
        raise HTTPException(status_code=400, detail={"error": "No entries provided"})
    merged = await _get_merged_llm_config(username, req.override_config)
    job = await create_job(
        req.entries,
        username=username,
        prompt_overrides=req.prompt_overrides,
        override_config=merged,
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
