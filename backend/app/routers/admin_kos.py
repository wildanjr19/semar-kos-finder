from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument
from pymongo.errors import BulkWriteError

from app.auth import require_auth
from app.db import get_collection
from app.models import KosOut, KosCreate, KosUpdate, KosBulkCreate
from app.seed import make_source_id

router = APIRouter(prefix="/api/admin/kos", tags=["admin-kos"])

COLLECTION = "kos"


def _doc_to_kos(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc["jenis_kos"] = doc.pop("jenis", "Tidak diketahui")
    doc["narahubung"] = doc.pop("kontak", "")
    doc["long"] = doc.pop("lon", 0.0)
    doc["plus_code"] = doc.get("plus_code", "")
    doc["narahubung_nama"] = doc.get("narahubung_nama", "")
    doc["ac_status"] = doc.get("ac_status", "")
    doc["tipe_pembayaran"] = doc.get("tipe_pembayaran", None)
    doc.pop("source_id", None)
    doc.pop("location", None)
    doc.pop("updated_at", None)
    return doc


@router.post("", status_code=201, response_model=KosOut)
async def create_kos(body: KosCreate, _username: str = Depends(require_auth)) -> dict:

    coll = get_collection(COLLECTION)
    now = datetime.utcnow()
    doc = body.model_dump()
    doc["source_id"] = f"manual:{make_source_id(body.nama, body.alamat, body.kontak)}"
    doc["location"] = {"type": "Point", "coordinates": [body.lon, body.lat]}
    doc["updated_at"] = now

    result = await coll.insert_one(doc)
    created = await coll.find_one({"_id": result.inserted_id})
    return _doc_to_kos(created)


@router.put("/{kos_id}", response_model=KosOut)
async def update_kos(kos_id: str, body: KosUpdate, _username: str = Depends(require_auth)) -> dict:

    from bson import ObjectId

    _id = ObjectId(kos_id) if ObjectId.is_valid(kos_id) else kos_id

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail={"error": "No fields to update"})

    if "lat" in updates or "lon" in updates:
        coll = get_collection(COLLECTION)
        current = await coll.find_one({"_id": _id})
        if current is None:
            raise HTTPException(status_code=404, detail={"error": "Kos not found"})
        lat = updates.get("lat", current["lat"])
        lon = updates.get("lon", current["lon"])
        updates["location"] = {"type": "Point", "coordinates": [lon, lat]}

    updates["updated_at"] = datetime.utcnow()

    coll = get_collection(COLLECTION)
    after = await coll.find_one_and_update(
        {"_id": _id},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if after is None:
        raise HTTPException(status_code=404, detail={"error": "Kos not found"})
    return _doc_to_kos(after)


@router.delete("/bulk", status_code=200)
async def bulk_delete_kos(body: dict, _username: str = Depends(require_auth)) -> dict:
    from bson import ObjectId

    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail={"error": "No ids provided"})

    object_ids = []
    for kos_id in ids:
        if ObjectId.is_valid(kos_id):
            object_ids.append(ObjectId(kos_id))
        else:
            object_ids.append(kos_id)

    coll = get_collection(COLLECTION)
    result = await coll.delete_many({"_id": {"$in": object_ids}})
    return {"deleted": result.deleted_count}


@router.delete("/{kos_id}", status_code=204)
async def delete_kos(kos_id: str, _username: str = Depends(require_auth)) -> None:

    from bson import ObjectId

    _id = ObjectId(kos_id) if ObjectId.is_valid(kos_id) else kos_id

    coll = get_collection(COLLECTION)
    result = await coll.delete_one({"_id": _id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail={"error": "Kos not found"})


@router.post("/bulk", status_code=201)
async def bulk_create_kos(body: KosBulkCreate, _username: str = Depends(require_auth)) -> dict:
    coll = get_collection(COLLECTION)
    items = body.items
    id_strategy = body.id_strategy

    if id_strategy == "parse_json":
        no_values = [item.No for item in items if item.No is not None]
        if no_values:
            existing = coll.find({"_id": {"$in": no_values}})
            conflicts = [str(doc["_id"]) async for doc in existing]
            if conflicts:
                raise HTTPException(
                    status_code=409,
                    detail={"error": "ID conflict detected", "conflicts": conflicts},
                )

    # Phase 1: compute source_ids for all items
    incoming: list[dict] = []
    for idx, item in enumerate(items):
        source_id = f"bulk_json:{make_source_id(item.Nama_kos, item.Alamat, item.Narahubung)}"
        incoming.append({
            "idx": idx,
            "no": item.No,
            "nama": item.Nama_kos,
            "alamat": item.Alamat,
            "narahubung": item.Narahubung,
            "source_id": source_id,
            "lat": item.lat if item.lat is not None else 0.0,
            "lon": item.long if item.long is not None else 0.0,
            "item": item,
        })

    # Phase 2: detect internal duplicates
    first_seen: dict[str, dict] = {}
    internal_dups: list[dict] = []
    unique_incoming: list[dict] = []
    for inc in incoming:
        sid = inc["source_id"]
        if sid in first_seen:
            internal_dups.append({
                "type": "internal",
                "nama": inc["nama"],
                "incoming_idx": inc["idx"] + 1,
                "incoming_no": inc["no"],
                "existing_idx": first_seen[sid]["idx"] + 1,
                "existing_no": first_seen[sid]["no"],
            })
        else:
            first_seen[sid] = inc
            unique_incoming.append(inc)

    # Phase 3: check DB for existing source_ids
    db_existing = await coll.find(
        {"source_id": {"$in": [u["source_id"] for u in unique_incoming]}}
    ).to_list(length=None)
    db_by_sid = {doc["source_id"]: doc for doc in db_existing}

    db_dups: list[dict] = []
    to_insert: list[dict] = []
    for inc in unique_incoming:
        sid = inc["source_id"]
        if sid in db_by_sid:
            db_doc = db_by_sid[sid]
            db_dups.append({
                "type": "database",
                "nama": inc["nama"],
                "incoming_idx": inc["idx"] + 1,
                "incoming_no": inc["no"],
                "existing_nama": db_doc.get("nama", ""),
                "existing_alamat": db_doc.get("alamat", ""),
                "existing_narahubung": db_doc.get("kontak", ""),
            })
        else:
            to_insert.append(inc)

    # Phase 4: build docs and insert
    now = datetime.utcnow()
    docs = []
    for inc in to_insert:
        item = inc["item"]
        doc: dict = {
            "nama": item.Nama_kos,
            "jenis": item.Jenis_kos,
            "alamat": item.Alamat,
            "plus_code": item.Plus_Code,
            "harga": item.Harga,
            "fasilitas": item.Fasilitas,
            "peraturan": item.Peraturan,
            "kontak": item.Narahubung,
            "lat": inc["lat"],
            "lon": inc["lon"],
            "ac_status": item.ac_status,
            "tipe_pembayaran": item.tipe_pembayaran,
            "location": {"type": "Point", "coordinates": [inc["lon"], inc["lat"]]},
            "source_id": inc["source_id"],
            "updated_at": now,
            "narahubung_nama": "",
        }
        if id_strategy == "parse_json" and item.No is not None:
            doc["_id"] = item.No
        docs.append(doc)

    inserted_count = 0
    if docs:
        try:
            result = await coll.insert_many(docs, ordered=False)
            inserted_count = len(result.inserted_ids)
        except BulkWriteError as bwe:
            details = bwe.details
            inserted_count = details.get("nInserted", 0)

    return {
        "created": inserted_count,
        "skipped_internal": len(internal_dups),
        "skipped_db": len(db_dups),
        "duplicate_report": internal_dups + db_dups,
    }
