from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app

_TEST_ENV = {
    "MONGO_URL": "mongodb://localhost:27017/test",
    "JWT_SECRET": "test-secret",
    "ADMIN_USERNAME": "admin",
    "ADMIN_PASSWORD_BCRYPT": "$2b$12$LJ3m4ys3Lk0TSwFhO0RyAOKMH8J2VvGMqD5l0QJ0Y0QJ0Y0QJ0Y0O",
    "JWT_EXPIRE_MINUTES": "60",
}


@pytest.fixture
def app():
    with patch("app.db.init_db", new_callable=AsyncMock):
        app = create_app()
        yield app


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    for key, val in _TEST_ENV.items():
        monkeypatch.setenv(key, val)


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _clean_doc(doc_id: str = "kos-1", *, lat: float = -7.56, lon: float = 110.82) -> dict:
    return {
        "_id": doc_id,
        "nama": "Kos Mawar",
        "data_status": "reviewed",
        "parsed_data": {
            "id": doc_id,
            "nama": "Kos Mawar",
            "jenis_kos": "Putri",
            "alamat": "Jl. Mawar",
            "plus_code": "ABC+123",
            "lat": lat,
            "lon": lon,
            "ac_status": "non_ac",
            "tipe_pembayaran": ["bulanan"],
            "harga": [
                {
                    "min": 500000,
                    "max": 500000,
                    "periode": "bulanan",
                    "tipe_kamar": None,
                    "catatan": None,
                }
            ],
            "fasilitas": {
                "dalam_kamar": ["kasur"],
                "bersama": ["dapur"],
                "utilitas": ["wifi"],
                "catatan": "",
            },
            "peraturan": {
                "jam_malam": None,
                "tamu_lawan_jenis": [],
                "tamu_menginap": None,
                "boleh_hewan": None,
                "lainnya": [],
            },
            "kontak": [
                {
                    "nama": "Ibu Mawar",
                    "nomor_wa": "628123456789",
                    "url_wa": "https://wa.me/628123456789",
                }
            ],
        },
    }


class FakeKosCollection:
    def __init__(self, docs: list[dict]):
        self.docs = docs
        self.last_query = None

    def find(self, query, sort=None):
        self.last_query = query

        async def _cursor():
            for doc in self.docs:
                if doc.get("data_status") != query["data_status"]:
                    continue
                if query["parsed_data"] == {"$exists": True} and "parsed_data" not in doc:
                    continue
                yield doc.copy()

        return _cursor()


async def _get_map(client_docs: list[dict]):
    collection = FakeKosCollection(client_docs)
    with patch("app.routers.kos.get_collection", return_value=collection):
        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/kos/map")
    return response, collection


@pytest.mark.anyio
async def test_kos_map_returns_reviewed_doc_with_valid_parsed_data():
    response, collection = await _get_map([_clean_doc()])

    assert response.status_code == 200
    assert collection.last_query == {
        "data_status": "reviewed",
        "parsed_data": {"$exists": True},
    }
    assert response.json() == [_clean_doc()["parsed_data"]]


@pytest.mark.anyio
async def test_kos_map_excludes_non_reviewed_docs():
    raw_doc = _clean_doc("raw-1")
    raw_doc["data_status"] = "raw"
    parsed_doc = _clean_doc("parsed-1")
    parsed_doc["data_status"] = "parsed"
    rejected_doc = _clean_doc("rejected-1")
    rejected_doc["data_status"] = "rejected"
    reviewed_doc = _clean_doc("reviewed-1")

    response, _ = await _get_map([raw_doc, parsed_doc, rejected_doc, reviewed_doc])

    assert response.status_code == 200
    assert response.json() == [reviewed_doc["parsed_data"]]


@pytest.mark.anyio
async def test_kos_map_skips_reviewed_docs_with_missing_or_non_finite_coords():
    missing_lat = _clean_doc("missing-lat")
    missing_lat["parsed_data"].pop("lat")
    infinite_lon = _clean_doc("infinite-lon", lon=float("inf"))
    valid_doc = _clean_doc("valid")

    response, _ = await _get_map([missing_lat, infinite_lon, valid_doc])

    assert response.status_code == 200
    assert response.json() == [valid_doc["parsed_data"]]
