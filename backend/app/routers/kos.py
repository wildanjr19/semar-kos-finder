"""Public read-only Kos endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pymongo import ASCENDING

from app.db import get_collection
from app.models import KosOut

router = APIRouter(prefix="/api/kos", tags=["kos"])

COLLECTION = "kos"


def _doc_to_kos(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc["jenis_kos"] = doc.pop("jenis", "Tidak diketahui")
    doc["narahubung"] = doc.pop("kontak", "")
    doc["long"] = doc.pop("lon", 0.0)
    doc["plus_code"] = doc.get("plus_code", "")
    doc["narahubung_nama"] = doc.get("narahubung_nama", "")
    doc.pop("source_id", None)
    doc.pop("location", None)
    doc.pop("updated_at", None)
    return doc


@router.get("", response_model=list[KosOut])
async def list_kos() -> list[dict]:
    """Return all kos sorted by nama ascending."""
    coll = get_collection(COLLECTION)
    cursor = coll.find(sort=[("nama", ASCENDING)])
    results = []
    async for doc in cursor:
        results.append(_doc_to_kos(doc))
    return results


@router.get("/{kos_id}", response_model=KosOut)
async def get_kos(kos_id: str) -> dict:
    """Return single kos by ID or 404."""
    from bson import ObjectId

    if not ObjectId.is_valid(kos_id):
        raise HTTPException(status_code=404, detail={"error": "Kos not found"})

    coll = get_collection(COLLECTION)
    doc = await coll.find_one({"_id": ObjectId(kos_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail={"error": "Kos not found"})
    return _doc_to_kos(doc)
