from __future__ import annotations

from fastapi import APIRouter
from pymongo import ASCENDING

from app.db import get_collection

router = APIRouter(prefix="/api/master-uns", tags=["master-uns"])

COLLECTION = "master_uns"


def _doc_to_location(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("location", None)
    doc.pop("updated_at", None)
    return doc


@router.get("")
async def list_locations() -> list[dict]:
    coll = get_collection(COLLECTION)
    cursor = coll.find(sort=[("nama", ASCENDING)])
    results = []
    async for doc in cursor:
        results.append(_doc_to_location(doc))
    return results
