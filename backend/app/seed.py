"""Idempotent seed script for kos collection.

Run:  uv run python -m app.seed
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import load_config

SEED_PATH = Path("/seed-data/data_kost_geo.json")
COLLECTION = "kos"

_KEY_MAP: dict[str, str] = {
    "Nama kos": "nama",
    "Jenis kos": "jenis",
    "Alamat": "alamat",
    "Fasilitas": "fasilitas",
    "Peraturan": "peraturan",
    "Harga": "harga",
    "Narahubung": "kontak",
    "lat": "lat",
    "long": "lon",
}

VALID_JENIS = {"Putra", "Putri", "Campuran", "Tidak diketahui"}


def normalize_kontak(raw: str) -> str:
    """Strip non-digits; ensure leading 0 or 62 prefix."""
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("62"):
        return "0" + digits[2:]
    if digits.startswith("0"):
        return digits
    if digits:
        return "0" + digits
    return ""


def make_source_id(nama: str, alamat: str, kontak: str) -> str:
    key = f"{nama.lower().strip()}|{alamat.lower().strip()}|{normalize_kontak(kontak)}"
    return hashlib.sha256(key.encode()).hexdigest()


def _parse_row(row: dict) -> dict | None:
    mapped: dict = {}
    for json_key, field_name in _KEY_MAP.items():
        val = row.get(json_key, "")
        if val is None:
            val = ""
        mapped[field_name] = str(val).strip() if isinstance(val, str) else val

    try:
        mapped["lat"] = float(mapped["lat"])
        mapped["lon"] = float(mapped["lon"])
    except (ValueError, TypeError, KeyError):
        return None

    if not (-90 <= mapped["lat"] <= 90 and -180 <= mapped["lon"] <= 180):
        return None

    jenis = mapped.get("jenis", "")
    if jenis not in VALID_JENIS:
        mapped["jenis"] = "Tidak diketahui"

    mapped["source_id"] = make_source_id(
        mapped.get("nama", ""), mapped.get("alamat", ""), mapped.get("kontak", "")
    )
    mapped["location"] = {"type": "Point", "coordinates": [mapped["lon"], mapped["lat"]]}
    mapped["updated_at"] = datetime.now(timezone.utc)

    mapped.pop("_id", None)
    return mapped


async def seed() -> None:
    if not SEED_PATH.exists():
        print("seed skipped: dataset not present")
        return

    config = load_config()
    client = AsyncIOMotorClient(config.mongo_url)
    db = client.get_default_database()
    col = db[COLLECTION]

    await col.create_index("source_id", unique=True)
    await col.create_index([("location", "2dsphere")])

    raw_rows: list[dict] = json.loads(SEED_PATH.read_text(encoding="utf-8"))

    inserted = 0
    updated = 0
    skipped = 0

    for row in raw_rows:
        parsed = _parse_row(row)
        if parsed is None:
            skipped += 1
            nama = row.get("Nama kos", "<unknown>")
            print(f"  skipped: invalid lat/lon — {nama}")
            continue

        result = await col.update_one(
            {"source_id": parsed["source_id"]},
            {"$set": parsed},
            upsert=True,
        )
        if result.upserted_id is not None:
            inserted += 1
        elif result.modified_count > 0:
            updated += 1

    print(f"seed done: inserted={inserted} updated={updated} skipped={skipped}")
    client.close()


def main() -> None:
    import asyncio

    asyncio.run(seed())


if __name__ == "__main__":
    main()
