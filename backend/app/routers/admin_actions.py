"""Action parsing stub endpoint — returns 501 with contract shape."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth import require_auth

router = APIRouter(prefix="/api/admin/actions", tags=["admin-actions"])

EXPECTED_FORMAT = {
    "action": "upsert_kos",
    "payload": {
        "nama": "string",
        "jenis": "Putra|Putri|Campuran|Tidak diketahui",
        "alamat": "string",
        "harga": "string",
        "fasilitas": "string",
        "peraturan": "string",
        "kontak": "string",
        "lat": -7.55,
        "lon": 110.85,
    },
}


@router.post("/parse", status_code=501)
async def parse_action(_username: str = Depends(require_auth)) -> dict:
    """Stub: returns expected format contract. LLM parsing not implemented."""
    return {
        "error": "Not implemented",
        "expected_format": EXPECTED_FORMAT,
    }