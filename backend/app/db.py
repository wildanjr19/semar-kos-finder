from __future__ import annotations

import asyncio
import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import load_config

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None  # type: ignore[type-arg]
_db: AsyncIOMotorDatabase | None = None  # type: ignore[type-arg]
_ready: bool = False

MAX_RETRY_SECONDS: int = 30
INITIAL_BACKOFF: float = 0.5
MAX_BACKOFF: float = 5.0


def is_ready() -> bool:
    return _ready


def get_db() -> AsyncIOMotorDatabase:  # type: ignore[type-arg]
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


def get_collection(name: str):
    return get_db()[name]


async def init_db() -> None:
    global _client, _db, _ready

    config = load_config()
    client = AsyncIOMotorClient(config.mongo_url)
    _client = client
    _db = client.get_default_database()

    elapsed = 0.0
    backoff = INITIAL_BACKOFF

    while elapsed < MAX_RETRY_SECONDS:
        try:
            await client.admin.command("ping")
            _ready = True
            logger.info("MongoDB connected (ping ok after %.1fs)", elapsed)
            return
        except Exception as exc:
            logger.warning("MongoDB ping failed (%.1fs elapsed): %s", elapsed, exc)
            await asyncio.sleep(backoff)
            elapsed += backoff
            backoff = min(backoff * 2, MAX_BACKOFF)

    logger.error("MongoDB unreachable after %ds — app will report db:down", MAX_RETRY_SECONDS)
