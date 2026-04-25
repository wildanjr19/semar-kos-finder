from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from app.auth import require_auth
from app.db import get_collection
from app.models import MasterUnsCreate, MasterUnsUpdate, MasterUnsOut

router = APIRouter(prefix="/api/admin/master-uns", tags=["admin-master-uns"])

COLLECTION = "master_uns"


def _doc_to_out(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("location", None)
    doc.pop("updated_at", None)
    return doc


@router.get("", response_model=list[MasterUnsOut])
async def list_master_uns(_username: str = Depends(require_auth)) -> list[dict]:
    coll = get_collection(COLLECTION)
    cursor = coll.find(sort=[("nama", 1)])
    results = []
    async for doc in cursor:
        results.append(_doc_to_out(doc))
    return results


@router.post("", status_code=201, response_model=MasterUnsOut)
async def create_master_uns(
    body: MasterUnsCreate, _username: str = Depends(require_auth)
) -> dict:
    coll = get_collection(COLLECTION)
    existing = await coll.find_one({"id": body.id})
    if existing is not None:
        raise HTTPException(
            status_code=409, detail={"error": f"Location with id '{body.id}' already exists"}
        )

    doc = {
        "id": body.id,
        "nama": body.nama,
        "lat": body.lat,
        "lon": body.lon,
        "location": {"type": "Point", "coordinates": [body.lon, body.lat]},
        "updated_at": datetime.now(timezone.utc),
    }
    await coll.insert_one(doc)
    return _doc_to_out(doc)


@router.put("/{loc_id}", response_model=MasterUnsOut)
async def update_master_uns(
    loc_id: str, body: MasterUnsUpdate, _username: str = Depends(require_auth)
) -> dict:
    coll = get_collection(COLLECTION)
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail={"error": "No fields to update"})

    if "lat" in updates or "lon" in updates:
        current = await coll.find_one({"id": loc_id})
        if current is None:
            raise HTTPException(status_code=404, detail={"error": "Location not found"})
        lat = updates.get("lat", current["lat"])
        lon = updates.get("lon", current["lon"])
        updates["location"] = {"type": "Point", "coordinates": [lon, lat]}

    updates["updated_at"] = datetime.now(timezone.utc)

    after = await coll.find_one_and_update(
        {"id": loc_id},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if after is None:
        raise HTTPException(status_code=404, detail={"error": "Location not found"})
    return _doc_to_out(after)


@router.delete("/{loc_id}", status_code=204)
async def delete_master_uns(loc_id: str, _username: str = Depends(require_auth)) -> None:
    coll = get_collection(COLLECTION)
    result = await coll.delete_one({"id": loc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail={"error": "Location not found"})


@router.delete("/bulk", status_code=200)
async def bulk_delete_master_uns(
    body: dict, _username: str = Depends(require_auth)
) -> dict:
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail={"error": "No ids provided"})

    coll = get_collection(COLLECTION)
    result = await coll.delete_many({"id": {"$in": ids}})
    return {"deleted": result.deleted_count}


@router.post("/bulk-import", status_code=201)
async def bulk_import_master_uns(
    body: list[dict], _username: str = Depends(require_auth)
) -> dict:
    """Import array of {id, nama, lat, lon} objects. Upserts by id."""
    if not isinstance(body, list):
        raise HTTPException(status_code=400, detail={"error": "Body must be a JSON array"})

    coll = get_collection(COLLECTION)
    inserted = 0
    updated = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for row in body:
        loc_id = row.get("id")
        nama = row.get("nama")
        lat = row.get("lat")
        lon = row.get("lon")

        if not loc_id or not nama or lat is None or lon is None:
            skipped += 1
            continue

        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except (ValueError, TypeError):
            skipped += 1
            continue

        if not (-90 <= lat_f <= 90 and -180 <= lon_f <= 180):
            skipped += 1
            continue

        doc = {
            "id": loc_id,
            "nama": nama,
            "lat": lat_f,
            "lon": lon_f,
            "location": {"type": "Point", "coordinates": [lon_f, lat_f]},
            "updated_at": now,
        }

        result = await coll.update_one(
            {"id": loc_id},
            {"$set": doc},
            upsert=True,
        )
        if result.upserted_id is not None:
            inserted += 1
        elif result.modified_count > 0:
            updated += 1

    return {"inserted": inserted, "updated": updated, "skipped": skipped}
