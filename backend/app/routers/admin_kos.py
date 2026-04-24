from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from app.auth import require_auth
from app.db import get_collection
from app.models import KosOut, KosCreate, KosUpdate

router = APIRouter(prefix="/api/admin/kos", tags=["admin-kos"])

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


@router.post("", status_code=201, response_model=KosOut)
async def create_kos(body: KosCreate, _username: str = Depends(require_auth)) -> dict:

    coll = get_collection(COLLECTION)
    now = datetime.utcnow()
    doc = body.model_dump()
    doc["source_id"] = f"manual:{hash((body.nama, body.alamat, body.kontak))}"
    doc["location"] = {"type": "Point", "coordinates": [body.lon, body.lat]}
    doc["updated_at"] = now

    result = await coll.insert_one(doc)
    created = await coll.find_one({"_id": result.inserted_id})
    return _doc_to_kos(created)


@router.put("/{kos_id}", response_model=KosOut)
async def update_kos(kos_id: str, body: KosUpdate, _username: str = Depends(require_auth)) -> dict:

    from bson import ObjectId

    if not ObjectId.is_valid(kos_id):
        raise HTTPException(status_code=404, detail={"error": "Kos not found"})

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail={"error": "No fields to update"})

    if "lat" in updates or "lon" in updates:
        coll = get_collection(COLLECTION)
        current = await coll.find_one({"_id": ObjectId(kos_id)})
        if current is None:
            raise HTTPException(status_code=404, detail={"error": "Kos not found"})
        lat = updates.get("lat", current["lat"])
        lon = updates.get("lon", current["lon"])
        updates["location"] = {"type": "Point", "coordinates": [lon, lat]}

    updates["updated_at"] = datetime.utcnow()

    coll = get_collection(COLLECTION)
    after = await coll.find_one_and_update(
        {"_id": ObjectId(kos_id)},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if after is None:
        raise HTTPException(status_code=404, detail={"error": "Kos not found"})
    return _doc_to_kos(after)


@router.delete("/{kos_id}", status_code=204)
async def delete_kos(kos_id: str, _username: str = Depends(require_auth)) -> None:

    from bson import ObjectId

    if not ObjectId.is_valid(kos_id):
        raise HTTPException(status_code=404, detail={"error": "Kos not found"})

    coll = get_collection(COLLECTION)
    result = await coll.delete_one({"_id": ObjectId(kos_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail={"error": "Kos not found"})
