"""Idempotent seed script for master UNS locations."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import load_config

SEED_PATH = Path("/seed-data/master_uns.json")
COLLECTION = "master_uns"


async def seed() -> None:
    if not SEED_PATH.exists():
        print("seed_master_uns skipped: dataset not present")
        return

    config = load_config()
    client = AsyncIOMotorClient(config.mongo_url)
    db = client.get_default_database()
    col = db[COLLECTION]

    await col.create_index("id", unique=True)

    raw_rows: list[dict] = json.loads(SEED_PATH.read_text(encoding="utf-8"))

    inserted = 0
    updated = 0
    skipped = 0

    for row in raw_rows:
        loc_id = row.get("id")
        nama = row.get("nama")
        lat = row.get("lat")
        lon = row.get("lon")

        if not loc_id or not nama or lat is None or lon is None:
            skipped += 1
            print(f"  skipped: missing required fields — {loc_id or '<unknown>'}")
            continue

        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except (ValueError, TypeError):
            skipped += 1
            print(f"  skipped: invalid lat/lon — {loc_id}")
            continue

        if not (-90 <= lat_f <= 90 and -180 <= lon_f <= 180):
            skipped += 1
            print(f"  skipped: out of range coordinates — {loc_id}")
            continue

        doc = {
            "id": loc_id,
            "nama": nama,
            "lat": lat_f,
            "lon": lon_f,
            "location": {"type": "Point", "coordinates": [lon_f, lat_f]},
            "updated_at": datetime.now(timezone.utc),
        }

        result = await col.update_one(
            {"id": loc_id},
            {"$set": doc},
            upsert=True,
        )
        if result.upserted_id is not None:
            inserted += 1
        elif result.modified_count > 0:
            updated += 1

    print(f"seed_master_uns done: inserted={inserted} updated={updated} skipped={skipped}")
    client.close()


def main() -> None:
    import asyncio

    asyncio.run(seed())


if __name__ == "__main__":
    main()
