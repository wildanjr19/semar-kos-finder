from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class GeoJSONPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: list[float] = Field(
        min_length=2, max_length=2, description="[lon, lat]"
    )


# --- Clean data schemas (for LLM parsing output) ---


class HargaItem(BaseModel):
    min: int
    max: int
    periode: Literal["bulanan", "semesteran", "tahunan", "per3bulan", "mingguan"]
    tipe_kamar: str | None = None
    catatan: str | None = None


class FasilitasCleaned(BaseModel):
    dalam_kamar: list[str] = []
    bersama: list[str] = []
    utilitas: list[str] = []
    catatan: str = ""


class PeraturanCleaned(BaseModel):
    jam_malam: str | None = None
    tamu_lawan_jenis: Literal["dilarang", "terbatas", "bebas"] | None = None
    tamu_menginap: bool | None = None
    boleh_hewan: bool | None = None
    lainnya: list[str] = []


class KontakItem(BaseModel):
    nama: str = ""
    nomor_wa: str
    url_wa: str


class KosClean(BaseModel):
    id: str
    nama: str
    jenis_kos: Literal["Putri", "Putra", "Campuran"]
    alamat: str
    plus_code: str
    lat: float
    lon: float
    ac_status: Literal["ac", "non_ac", "keduanya"]
    tipe_pembayaran: list[str]
    harga: list[HargaItem]
    fasilitas: FasilitasCleaned
    peraturan: PeraturanCleaned
    kontak: list[KontakItem]


class KosBulkItem(BaseModel):
    No: str | None = None
    Nama_kos: str = Field(alias="Nama kos")
    Jenis_kos: str = Field(alias="Jenis kos", default="Tidak diketahui")
    Alamat: str = ""
    Plus_Code: str = ""
    Harga: str = ""
    Fasilitas: str = ""
    Peraturan: str = ""
    Narahubung: str = ""
    lat: float | None = None
    long: float | None = None
    ac_status: str = ""
    tipe_pembayaran: list[str] | None = None

    model_config = {"populate_by_name": True}

    @field_validator("lat", "long", mode="before")
    @classmethod
    def _parse_float(cls, v):
        if isinstance(v, str):
            try:
                return float(v)
            except ValueError:
                return None
        return v


class KosBulkCreate(BaseModel):
    items: list[KosBulkItem]
    id_strategy: Literal["parse_json", "auto_increment"] = "auto_increment"


class KosCreate(BaseModel):
    nama: str
    jenis: Literal["Putra", "Putri", "Campuran", "Tidak diketahui"] = "Tidak diketahui"
    alamat: str = ""
    plus_code: str = ""
    harga: str = ""
    fasilitas: str = ""
    peraturan: str = ""
    kontak: str = ""
    narahubung_nama: str = ""
    lat: float
    lon: float
    ac_status: str = ""
    tipe_pembayaran: list[str] | None = None


class KosUpdate(BaseModel):
    nama: str | None = None
    jenis: Literal["Putra", "Putri", "Campuran", "Tidak diketahui"] | None = None
    alamat: str | None = None
    plus_code: str | None = None
    harga: str | None = None
    fasilitas: str | None = None
    peraturan: str | None = None
    kontak: str | None = None
    narahubung_nama: str | None = None
    lat: float | None = None
    lon: float | None = None
    ac_status: str | None = None
    tipe_pembayaran: list[str] | None = None


class KosOut(BaseModel):
    id: str
    nama: str
    jenis_kos: str
    alamat: str = ""
    plus_code: str = ""
    fasilitas: str = ""
    peraturan: str = ""
    harga: str = ""
    narahubung: str
    narahubung_nama: str = ""
    lat: float
    long: float
    ac_status: str = ""
    tipe_pembayaran: list[str] | None = None
    data_status: str = "raw"
    parsed_data: KosClean | None = None
    last_parsed_at: datetime | None = None
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None


class Kos(BaseModel):
    id: str = Field(alias="_id", description="Mongo ObjectId as string")
    nama: str
    jenis: Literal["Putra", "Putri", "Campuran", "Tidak diketahui"] = "Tidak diketahui"
    alamat: str = ""
    plus_code: str = ""
    harga: str = ""
    fasilitas: str = ""
    peraturan: str = ""
    kontak: str = ""
    narahubung_nama: str = ""
    lat: float
    lon: float
    ac_status: str = ""
    tipe_pembayaran: list[str] | None = None
    source_id: str = ""
    location: GeoJSONPoint | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    data_status: str = "raw"
    parsed_data: KosClean | None = None
    last_parsed_at: datetime | None = None
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None

    model_config = {"populate_by_name": True}


class MasterUnsCreate(BaseModel):
    id: str
    nama: str
    lat: float
    lon: float

    @field_validator("lat", mode="before")
    @classmethod
    def _parse_lat(cls, v):
        if isinstance(v, str):
            try:
                return float(v)
            except ValueError:
                raise ValueError("lat must be a valid number")
        return v

    @field_validator("lon", mode="before")
    @classmethod
    def _parse_lon(cls, v):
        if isinstance(v, str):
            try:
                return float(v)
            except ValueError:
                raise ValueError("lon must be a valid number")
        return v


class MasterUnsUpdate(BaseModel):
    nama: str | None = None
    lat: float | None = None
    lon: float | None = None

    @field_validator("lat", mode="before")
    @classmethod
    def _parse_lat(cls, v):
        if isinstance(v, str):
            try:
                return float(v)
            except ValueError:
                raise ValueError("lat must be a valid number")
        return v

    @field_validator("lon", mode="before")
    @classmethod
    def _parse_lon(cls, v):
        if isinstance(v, str):
            try:
                return float(v)
            except ValueError:
                raise ValueError("lon must be a valid number")
        return v


class MasterUnsOut(BaseModel):
    id: str
    nama: str
    lat: float
    lon: float
