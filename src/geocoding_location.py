import csv
import datetime
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"
INPUT_CSV = PROJECT_ROOT / "data" / "preprocessed" / "data_kost_2023_fixed.csv"
OUTPUT_CSV = PROJECT_ROOT / "data" / "final" / "data_kost_2023_geo.csv"
LOG_DIR = PROJECT_ROOT / "log"
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

# Bounding box Surakarta (sedikit diperlonggar untuk area perbatasan)
SURAKARTA_SW_LAT = -7.63
SURAKARTA_SW_LNG = 110.75
SURAKARTA_NE_LAT = -7.51
SURAKARTA_NE_LNG = 110.88

SURAKARTA_SUFFIX = "Surakarta, Jawa Tengah, Indonesia"

# Keyword yang menandakan hasil geocoding memang di Surakarta/Solo
SURAKARTA_KEYWORDS = {"surakarta", "solo", "kota surakarta"}


def _build_log_path() -> Path:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    return LOG_DIR / f"geocoding_location_{timestamp}.log"


def is_inside_surakarta(lat: float, lng: float) -> bool:
    return (
        SURAKARTA_SW_LAT <= lat <= SURAKARTA_NE_LAT
        and SURAKARTA_SW_LNG <= lng <= SURAKARTA_NE_LNG
    )


def is_surakarta_address(formatted_address: str) -> bool:
    """Validasi apakah formatted_address mengandung keyword Surakarta/Solo."""
    lowered = formatted_address.lower()
    return any(kw in lowered for kw in SURAKARTA_KEYWORDS)


def _do_request(
    query: str, api_key: str, use_locality_component: bool = False
) -> tuple[float | None, float | None]:
    """
    Kirim satu request ke Google Geocoding API.
    - Pakai `components=locality:Surakarta|country:ID` jika use_locality_component=True
    - Selalu pakai bounds Surakarta sebagai bias
    - Iterasi semua results, bukan hanya results[0]
    """
    components = (
        "locality:Surakarta|administrative_area:Jawa Tengah|country:ID"
        if use_locality_component
        else "country:ID"
    )

    params = urllib.parse.urlencode(
        {
            "address": query,
            "key": api_key,
            "region": "id",
            "components": components,
            "language": "id",
            "bounds": f"{SURAKARTA_SW_LAT},{SURAKARTA_SW_LNG}|{SURAKARTA_NE_LAT},{SURAKARTA_NE_LNG}",
        }
    )
    url = f"{GEOCODE_URL}?{params}"

    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return None, None

    if payload.get("status") != "OK" or not payload.get("results"):
        return None, None

    # Iterasi semua kandidat hasil, pilih yang paling cocok dengan Surakarta
    for result in payload["results"]:
        location = result.get("geometry", {}).get("location", {})
        lat = location.get("lat")
        lng = location.get("lng")
        formatted_address = result.get("formatted_address", "")

        if lat is None or lng is None:
            continue

        # Validasi ganda: bounding box + formatted_address
        if is_inside_surakarta(lat, lng) and is_surakarta_address(formatted_address):
            return lat, lng

    return None, None


def geocode_address(query: str, api_key: str) -> tuple[float | None, float | None]:
    """
    Strategi multi-tahap untuk memastikan hasil geocoding ada di Surakarta:
      1. Coba query asli + locality component filter
      2. Jika gagal, coba query dengan suffix Surakarta eksplisit + locality filter
      3. Jika masih gagal, coba query dengan suffix tanpa locality component (lebih longgar)
    """
    # Strategi 1: query asli, komponen ketat
    lat, lng = _do_request(query, api_key, use_locality_component=True)
    if lat is not None:
        return lat, lng

    # Strategi 2: tambahkan suffix Surakarta eksplisit, komponen ketat
    query_with_suffix = _ensure_surakarta_suffix(query)
    if query_with_suffix != query:
        lat, lng = _do_request(query_with_suffix, api_key, use_locality_component=True)
        if lat is not None:
            return lat, lng

    # Strategi 3: suffix + komponen lebih longgar (fallback)
    lat, lng = _do_request(query_with_suffix, api_key, use_locality_component=False)
    return lat, lng


def _ensure_surakarta_suffix(query: str) -> str:
    """Tambahkan suffix Surakarta jika belum ada."""
    lowered = query.lower()
    if "surakarta" in lowered or "solo" in lowered:
        return query
    return f"{query}, {SURAKARTA_SUFFIX}" if query else query


def pick_query(row: dict[str, str]) -> str:
    """Susun query dari nama kos, alamat, dan plus code. Selalu sertakan konteks Surakarta."""
    nama_kos = (row.get("Nama kos") or "").strip()
    alamat = (row.get("Alamat") or "").strip()
    plus_code = (row.get("Plus_Code") or "").strip()

    parts = []
    if nama_kos:
        parts.append(nama_kos)
    if alamat:
        parts.append(alamat)
    if plus_code:
        parts.append(plus_code)

    if parts:
        query = ", ".join(parts)
    else:
        query = ""

    # Suffix Surakarta ditambahkan di sini supaya query awal sudah kontekstual
    return _ensure_surakarta_suffix(query)


def run_geocoding() -> None:
    load_dotenv(dotenv_path=ENV_PATH)
    api_key = os.getenv("GMAPS_API_KEY")
    if not api_key:
        raise RuntimeError("GMAPS_API_KEY tidak ditemukan di environment/.env")

    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"File input tidak ditemukan: {INPUT_CSV}")

    with INPUT_CSV.open("r", encoding="utf-8-sig", newline="") as in_file:
        reader = csv.DictReader(in_file)
        rows = list(reader)
        if not reader.fieldnames:
            raise ValueError("Header CSV tidak ditemukan pada data_kost_cleaned.csv")
        fieldnames = list(reader.fieldnames)

    if "lat" not in fieldnames:
        fieldnames.append("lat")
    if "long" not in fieldnames:
        fieldnames.append("long")

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = _build_log_path()

    def log_line(message: str) -> None:
        print(message)
        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(message + "\n")

    log_line(f"Mulai geocoding. Total data: {len(rows)}")
    log_line(f"Input: {INPUT_CSV}")
    log_line(f"Output: {OUTPUT_CSV}")

    total = len(rows)
    failed = 0
    for idx, row in enumerate(rows, start=1):
        query = pick_query(row)

        if query:
            lat, lng = geocode_address(query, api_key)
        else:
            lat, lng = None, None

        if lat is None:
            failed += 1

        row["lat"] = "" if lat is None else str(lat)
        row["long"] = "" if lng is None else str(lng)

        status = "OK" if lat is not None else "GAGAL"
        log_line(
            f"[{idx}/{total}] [{status}] {query[:80]} -> lat={row['lat']} long={row['long']}"
        )
        time.sleep(0.12)

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open("w", encoding="utf-8-sig", newline="") as out_file:
        writer = csv.DictWriter(out_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    log_line(f"\nSelesai. Berhasil: {total - failed}/{total} | Gagal: {failed}/{total}")
    log_line(f"File hasil tersimpan di: {OUTPUT_CSV}")
    log_line(f"File log tersimpan di: {log_path}")


if __name__ == "__main__":
    run_geocoding()
