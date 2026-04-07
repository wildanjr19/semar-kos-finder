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
OUTPUT_CSV = PROJECT_ROOT / "data" / "final" / "new_kos_data.csv"
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
    return LOG_DIR / f"new_kos_geocoding_{timestamp}.log"


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


def build_query(nama_kos: str, alamat: str, plus_code: str) -> str:
    """Susun query dari nama kos, alamat, dan plus code. Selalu sertakan konteks Surakarta."""
    parts = []
    if nama_kos and nama_kos != "-":
        parts.append(nama_kos)
    if alamat and alamat != "-":
        parts.append(alamat)
    if plus_code and plus_code != "-":
        parts.append(plus_code)

    if parts:
        query = ", ".join(parts)
    else:
        query = ""

    # Suffix Surakarta ditambahkan di sini supaya query awal sudah kontekstual
    return _ensure_surakarta_suffix(query)


def save_to_csv(data: dict, output_path: Path) -> None:
    """Simpan data ke CSV."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    fieldnames = ["Nama kos", "Alamat", "Plus_Code", "lat", "long"]
    file_exists = output_path.exists()
    
    with output_path.open("a", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow(data)


def main() -> None:
    load_dotenv(dotenv_path=ENV_PATH)
    api_key = os.getenv("GMAPS_API_KEY")
    if not api_key:
        raise RuntimeError("GMAPS_API_KEY tidak ditemukan di environment/.env")

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = _build_log_path()

    def log_line(message: str) -> None:
        print(message)
        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(message + "\n")

    print("=" * 50)
    print("INPUT DATA KOS BARU")
    print("=" * 50)
    
    # Input dari user
    nama_kos = input("Nama Kos: ").strip()
    alamat = input("Alamat: ").strip()
    plus_code = input("Plus Code (opsional, ketik - jika tidak ada): ").strip()
    
    # Validasi input minimal
    if not nama_kos or nama_kos == "-":
        print("Error: Nama kos wajib diisi!")
        return
    if not alamat or alamat == "-":
        print("Error: Alamat wajib diisi!")
        return
    
    # Set default untuk plus_code jika kosong atau -
    if not plus_code or plus_code == "-":
        plus_code = "-"

    log_line(f"Input - Nama Kos: {nama_kos}")
    log_line(f"Input - Alamat: {alamat}")
    log_line(f"Input - Plus Code: {plus_code}")

    # Build query dan geocoding
    query = build_query(nama_kos, alamat, plus_code)
    log_line(f"Query untuk geocoding: {query}")
    
    print(f"\nMencari koordinat untuk: {query}")
    lat, lng = geocode_address(query, api_key)

    # Siapkan data hasil
    result = {
        "Nama kos": nama_kos,
        "Alamat": alamat,
        "Plus_Code": plus_code,
        "lat": str(lat) if lat is not None else "",
        "long": str(lng) if lng is not None else ""
    }

    # Tampilkan hasil
    print("\n" + "=" * 50)
    print("HASIL GEOCODING")
    print("=" * 50)
    print(f"Nama Kos: {nama_kos}")
    print(f"Alamat: {alamat}")
    print(f"Plus Code: {plus_code}")
    print(f"Latitude: {result['lat'] if result['lat'] else 'GAGAL'}")
    print(f"Longitude: {result['long'] if result['long'] else 'GAGAL'}")
    
    if lat is not None and lng is not None:
        print("\nStatus: BERHASIL")
        log_line(f"Status: BERHASIL - lat={lat}, lng={lng}")
    else:
        print("\nStatus: GAGAL - Tidak dapat menemukan koordinat")
        log_line("Status: GAGAL - Tidak dapat menemukan koordinat")

    # Simpan ke CSV
    save_to_csv(result, OUTPUT_CSV)
    print(f"\nData disimpan ke: {OUTPUT_CSV}")
    log_line(f"Data disimpan ke: {OUTPUT_CSV}")
    log_line(f"File log: {log_path}")


if __name__ == "__main__":
    main()
