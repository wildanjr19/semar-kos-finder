from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class GeoJSONPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: list[float] = Field(
        min_length=2, max_length=2, description="[lon, lat]"
    )


class KosCreate(BaseModel):
    nama: str
    jenis: Literal["Putra", "Putri", "Campuran", "Tidak diketahui"] = "Tidak diketahui"
    alamat: str = ""
    harga: str = ""
    fasilitas: str = ""
    peraturan: str = ""
    kontak: str = ""
    lat: float
    lon: float


class KosUpdate(BaseModel):
    nama: str | None = None
    jenis: Literal["Putra", "Putri", "Campuran", "Tidak diketahui"] | None = None
    alamat: str | None = None
    harga: str | None = None
    fasilitas: str | None = None
    peraturan: str | None = None
    kontak: str | None = None
    lat: float | None = None
    lon: float | None = None


class KosOut(BaseModel):
    id: str = Field(alias="_id")
    nama: str
    jenis: Literal["Putra", "Putri", "Campuran", "Tidak diketahui"] = "Tidak diketahui"
    alamat: str = ""
    harga: str = ""
    fasilitas: str = ""
    peraturan: str = ""
    kontak: str = ""
    lat: float
    lon: float

    model_config = {"populate_by_name": True}


class Kos(BaseModel):
    id: str = Field(alias="_id", description="Mongo ObjectId as string")
    nama: str
    jenis: Literal["Putra", "Putri", "Campuran", "Tidak diketahui"] = "Tidak diketahui"
    alamat: str = ""
    harga: str = ""
    fasilitas: str = ""
    peraturan: str = ""
    kontak: str = ""
    lat: float
    lon: float
    source_id: str = ""
    location: GeoJSONPoint | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True}
