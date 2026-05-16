"""Public read-only Kos endpoints."""

from __future__ import annotations

import logging
import math

from fastapi import APIRouter, HTTPException
from pymongo import ASCENDING

from app.db import get_collection
from app.models import KosClean, KosOut

router = APIRouter(prefix="/api/kos", tags=["kos"])

COLLECTION = "kos"
logger = logging.getLogger(__name__)


def _doc_to_kos(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc["jenis_kos"] = doc.pop("jenis", "Tidak diketahui")
    doc["narahubung"] = doc.pop("kontak", "")
    doc["long"] = doc.pop("lon", 0.0)
    doc["plus_code"] = doc.get("plus_code", "")
    doc["narahubung_nama"] = doc.get("narahubung_nama", "")
    doc["ac_status"] = doc.get("ac_status", "")
    doc["tipe_pembayaran"] = doc.get("tipe_pembayaran", None)
    doc["data_status"] = doc.get("data_status", "raw")
    doc["parsed_data"] = doc.get("parsed_data", None)
    doc["last_parsed_at"] = doc.get("last_parsed_at", None)
    doc["reviewed_at"] = doc.get("reviewed_at", None)
    doc["reviewed_by"] = doc.get("reviewed_by", None)
    doc.pop("source_id", None)
    doc.pop("location", None)
    doc.pop("updated_at", None)
    return doc


def _doc_to_clean_kos(doc: dict) -> dict | None:
    parsed = doc.get("parsed_data")
    if not isinstance(parsed, dict):
        return None

    lat = parsed.get("lat")
    lon = parsed.get("lon")
    if not isinstance(lat, int | float) or not isinstance(lon, int | float):
        return None
    if not math.isfinite(lat) or not math.isfinite(lon):
        return None

    clean = parsed.copy()
    clean["id"] = str(clean.get("id") or doc.get("_id"))
    return clean


@router.get("", response_model=list[KosOut])
async def list_kos() -> list[dict]:
    """Return all kos sorted by nama ascending."""
    coll = get_collection(COLLECTION)
    cursor = coll.find(sort=[("nama", ASCENDING)])
    results = []
    async for doc in cursor:
        results.append(_doc_to_kos(doc))
    return results


@router.get("/map", response_model=list[KosClean])
async def list_kos_map() -> list[dict]:
    """Return reviewed kos with valid parsed map data."""
    coll = get_collection(COLLECTION)
    cursor = coll.find(
        {"data_status": "reviewed", "parsed_data": {"$exists": True}},
        sort=[("nama", ASCENDING)],
    )
    results = []
    skipped = 0
    async for doc in cursor:
        clean = _doc_to_clean_kos(doc)
        if clean is None:
            skipped += 1
            continue
        results.append(clean)
    if skipped:
        logger.warning("Skipped %s reviewed kos docs with invalid parsed_data", skipped)
    return results


@router.get("/{kos_id}", response_model=KosOut)
async def get_kos(kos_id: str) -> dict:
    """Return single kos by ID or 404."""
    from bson import ObjectId

    _id = ObjectId(kos_id) if ObjectId.is_valid(kos_id) else kos_id

    coll = get_collection(COLLECTION)
    doc = await coll.find_one({"_id": _id})
    if doc is None:
        raise HTTPException(status_code=404, detail={"error": "Kos not found"})
    return _doc_to_kos(doc)
