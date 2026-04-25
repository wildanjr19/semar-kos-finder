"""LLM-powered parsing engine: raw kos entry -> structured KosClean."""

from __future__ import annotations

import json
import logging

from openai import AsyncOpenAI
from pydantic import ValidationError

from app.config import Config, load_config
from app.models import FasilitasCleaned, HargaItem, KontakItem, KosClean, PeraturanCleaned

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """
Kamu adalah pembersih data (data cleaner) untuk data rumah kos (kost)
di sekitar UNS Solo. Tugasmu: mengubah JSON mentah menjadi JSON
terstruktur yang bersih dan terstandarisasi.

INPUT: JSON mentah dari spreadsheet dengan field:
  No, Nama kos, Jenis kos, Alamat, Plus_Code, Fasilitas, Peraturan,
  Harga, Narahubung, lat, long, ac_status, tipe_pembayaran

OUTPUT: JSON bersih sesuai schema berikut. OUTPUT HARUS VALID JSON,
TANPA markdown code block, TANPA komentar.

{
  "id": "<No>",
  "nama": "<Nama kos>",
  "jenis_kos": "Putri | Putra | Campuran",
  "alamat": "<Alamat lengkap>",
  "plus_code": "<Plus_Code atau ''>",
  "lat": <float>,
  "lon": <float>,
  "ac_status": "ac | non_ac | keduanya",
  "tipe_pembayaran": ["bulanan", "semesteran", ...],
  "harga": [
    {
      "min": <int, harga terendah>,
      "max": <int, harga tertinggi, sama dengan min jika harga tunggal>,
      "periode": "bulanan | semesteran | tahunan | per3bulan | mingguan",
      "tipe_kamar": "<string atau null, misal 'AC, kamar mandi dalam'>",
      "catatan": "<string atau null, misal 'belum include listrik'>"
    }
  ],
  "fasilitas": {
    "dalam_kamar": ["<fasilitas di dalam kamar>"],
    "bersama": ["<fasilitas area bersama>"],
    "utilitas": ["listrik", "air"],
    "catatan": "<sisa teks yang tidak bisa dikategorikan>"
  },
  "peraturan": {
    "jam_malam": "<waktu 24 jam atau 'tidak ada' atau null>",
    "tamu_lawan_jenis": "dilarang | terbatas | bebas | null",
    "tamu_menginap": <true | false | null>,
    "boleh_hewan": <true | false | null>,
    "lainnya": ["<aturan lain dalam bentuk kalimat pendek>"]
  },
  "kontak": [
    {
      "nama": "<nama kontak, kosongkan jika tidak ada>",
      "nomor_wa": "<nomor WA format 628xxx, tanpa spasi>",
      "url_wa": "https://wa.me/<nomor>"
    }
  ]
}

──── RULES PARSING ────

=== HARGA ===
1. Pisahkan setiap varian harga menjadi objek terpisah.
   Contoh input: "13.000.000/tahun (AC, km dlm)  7.890.000/tahun (km dlm non ac)"
   Output: 2 objek harga dengan tipe_kamar berbeda.

2. "jt" = ×1.000.000, "juta" = ×1.000.000, "rb" = ×1.000, "ribu" = ×1.000
   Gunakan "." sebagai pemisah ribuan, "," sebagai desimal (format Indonesia).

3. Range harga "450.000-600.000/bulan" → min=450000, max=600000
   Harga tunggal "650.000/bulan" → min=650000, max=650000

4. Ekstrak tipe_kamar dari konteks:
   - Teks dalam kurung "(AC, km dlm)" → tipe_kamar: "AC, kamar mandi dalam"
   - "kamar standar" / "kamar jumbo" / "lantai 1" → jadikan tipe_kamar
   - Jika tidak ada info tipe kamar, isi null

5. Ekstrak catatan dari konteks:
   - "belum include listrik" → catatan
   - "(harga bisa berubah)" → catatan
   - "kamar 3x3" → catatan

6. Harga "-" atau kosong → harga: [] (array kosong)
   Harga "Setiap kamar beda-beda/Tahun" → harga: [], catatan: "setiap kamar beda-beda"

7. Periode: deteksi dari teks:
   "/bulan", "per bulan" → bulanan
   "/semester", "per semester", "smester" → semesteran
   "/tahun", "per tahun", "pertahun" → tahunan
   "per 3 bulan", "/3 bulan" → per3bulan
   "/minggu", "per minggu" → mingguan

=== FASILITAS ===
1. Parse string comma-separated. Pisahkan menjadi array per item.
2. Kategorikan setiap item:

   DALAM KAMAR (dalam_kamar):
   - "AC", "Ac", "AC (baru)" → "ac"
   - "Kamar mandi dalam", "KM dalam", "km dlm", "kamar mandi di dalam" → "kamar_mandi_dalam"
   - "Kamar mandi luar", "KM luar" → "kamar_mandi_luar"
   - "Lemari", "lemari pakaian" → "lemari"
   - "Kasur", "kasur spring bed", "ranjang" → "kasur"
   - "Meja belajar", "meja", "meja tulis" → "meja_belajar"
   - "Kipas angin", "Kipas", "fan" → "kipas_angin"
   - "TV", "televisi" → "tv"

   BERSAMA (bersama):
   - "WIFI", "WiFi", "wifi gratis", "internet" → "wifi"
   - "Kulkas", "Lemari es", "kulkas bersama" → "kulkas"
   - "Dapur", "dapur bersama", "kitchen" → "dapur"
   - "Mesin cuci", "laundry", "washing machine" → "mesin_cuci"
   - "CCTV", "kamera cctv", "cctv" → "cctv"
   - "Jemuran", "tempat jemur", "area jemur", "jemuran baju" → "jemuran"
   - "Parkir", "parkiran", "tempat parkir", "parkiran luas" → "parkir"
   - "Musholla", "mushola", "tempat ibadah" → "musholla"
   - "Dispenser", "dispenser air minum" → "dispenser"
   - "Ruang tamu", "sofa bersama" → "ruang_tamu"
   - "Rak sepatu" → "rak_sepatu"
   - "Setrika" → "setrika"

   UTILITAS (utilitas):
   - "Listrik" → "listrik"
   - "Air", "air bersih", "air PAM" → "air"

3. Teks yang TIDAK BISA dikategorikan → taruh di catatan (string).
   Contoh: "ada yang bersihin 1 Minggu 3 kali", "parkir motor yg rapi",
   "barang bawa sendiri", "gas gratis", "ada ibuk bersih2"

4. Jangan duplikasi. Satu item hanya masuk satu kategori.

=== PERATURAN ===
1. Baca teks peraturan. Ekstrak informasi terstruktur:

   jam_malam:
   - "Jam malam" tanpa waktu spesifik → null (ada jam malam, waktu tidak diketahui)
   - "jam 23.00", "jam 10 malam", "pukul 22.00" → "23:00", "22:00", dll (format 24 jam)
   - "tidak ada jam malam", "bebas jam malam", "24 jam" → "tidak ada"
   - Tidak ada info → null

   tamu_lawan_jenis:
   - "dilarang", "tidak boleh", "gaboleh bawa cowo/cewe" → "dilarang"
   - "boleh di luar", "hanya sampai ruang tamu", "sampai jam 9", "batas jam" → "terbatas"
   - "boleh", "bebas", "diperbolehkan" → "bebas"
   - Tidak ada info → null

   tamu_menginap:
   - Teks mengandung "tamu menginap" (konteks mengizinkan) → true
   - "tidak boleh menginap", "dilarang menginap" → false
   - "menginap harus ijin", "menginap bayar" → true
   - Tidak ada info → null

   boleh_hewan:
   - "boleh bawa hewan", "boleh peliharaan" → true
   - "dilarang bawa hewan", "tidak boleh bawa hewan", "gaboleh hewan" → false
   - Tidak ada info → null

2. Aturan yang TIDAK MASUK 4 flag di atas → lainnya[] (array string pendek).
   Contoh: "masak bayar 500", "wajib izin di grup", "ada piket bersih-bersih",
   "kunci gerbang dibawa masing-masing", "parkir rapi", "dilarang merokok"

3. Jika peraturan kosong ("-", ".", "") → semua null, lainnya: []

=== KONTAK ===
1. Parse string narahubung. Ekstrak semua kontak WhatsApp.
2. Format URL WA:
   - "https://wa.me/628123456789" → nomor_wa: "628123456789"
   - "628123456789" (plain number) → nomor_wa: "628123456789"
   - "https://628123456789" → nomor_wa: "628123456789"
   - "085123456789" (awalan 0) → nomor_wa: "6285123456789" (ganti 0 dengan 62)
3. Nama kontak: ekstrak dari kurung "628xxx (Nama)" → nama: "Nama"
4. Multiple kontak dipisah "atau", "&" → array multi-entry
5. "-" atau kosong → kontak: []

=== GENERAL ===
1. jenis_kos normalisasi: "Putri" / "Putra" — case insensitive
   "putri" → "Putri", "putra" → "Putra", "campur" → "Campuran"
2. ac_status: "ac" / "non_ac" / "keduanya"
3. tipe_pembayaran: keep as-is dari input
4. lat/lon: pastikan float, bukan string
5. Semua string field: trim whitespace

OUTPUT HARUS VALID JSON. TIDAK BOLEH ADA MARKDOWN CODE BLOCK.
JANGAN TAMBAH FIELD YANG TIDAK ADA DI SCHEMA.
""".strip()


def _effective_config(override: dict | None = None) -> Config:
    """Return config, allowing per-request overrides from admin UI."""
    base = load_config()
    if not override:
        return base
    return Config(
        mongo_url=base.mongo_url,
        jwt_secret=base.jwt_secret,
        admin_username=base.admin_username,
        admin_password_bcrypt=base.admin_password_bcrypt,
        jwt_expire_minutes=base.jwt_expire_minutes,
        llm_api_key=override.get("api_key", base.llm_api_key),
        llm_api_base=override.get("api_base", base.llm_api_base),
        llm_model=override.get("model", base.llm_model),
        llm_max_tokens=override.get("max_tokens", base.llm_max_tokens),
        llm_temperature=override.get("temperature", base.llm_temperature),
    )


async def _call_llm(
    raw_entry: dict,
    custom_prompt: str | None = None,
    override_config: dict | None = None,
) -> str:
    config = _effective_config(override_config)

    if not config.llm_api_key:
        raise RuntimeError("LLM API key is not configured")

    client = AsyncOpenAI(api_key=config.llm_api_key, base_url=config.llm_api_base)

    system_prompt = _SYSTEM_PROMPT
    if custom_prompt:
        system_prompt += f"\n\nINSTRUKSI TAMBAHAN DARI ADMIN:\n{custom_prompt}"

    user_message = f"Parse this raw JSON:\n{json.dumps(raw_entry, indent=2, ensure_ascii=False)}"

    response = await client.chat.completions.create(
        model=config.llm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=config.llm_temperature,
        max_tokens=config.llm_max_tokens,
    )
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("LLM returned empty content")
    return content.strip()


def _sanitize_llm_json(text: str) -> str:
    """Remove markdown code fences if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # Drop first line (```json or ```)
        if lines[0].startswith("```"):
            lines = lines[1:]
        # Drop last line if ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return text.strip()


async def parse_single_entry(
    raw_entry: dict,
    custom_prompt: str | None = None,
    override_config: dict | None = None,
    max_retries: int = 2,
) -> dict:
    """Parse one raw kos entry into a KosClean dict via LLM with retry."""
    for attempt in range(max_retries + 1):
        raw_response = await _call_llm(raw_entry, custom_prompt, override_config)
        sanitized = _sanitize_llm_json(raw_response)
        try:
            parsed = json.loads(sanitized)
            validated = KosClean.model_validate(parsed)
            return validated.model_dump()
        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning("Parse attempt %d failed for entry %s: %s", attempt + 1, raw_entry.get("No"), e)
            if attempt == max_retries:
                raise ValueError(f"LLM response invalid after {max_retries} retries: {e}") from e
            # Inject error feedback for next retry
            custom_prompt = (custom_prompt or "") + f"\nPrevious parsing error: {e}. Pastikan output adalah JSON valid tanpa markdown."
    raise RuntimeError("Unreachable")


async def test_llm_connection(override_config: dict) -> dict:
    """Send a minimal prompt to verify LLM connectivity."""
    config = _effective_config(override_config)
    if not config.llm_api_key:
        raise RuntimeError("LLM API key is not configured")

    client = AsyncOpenAI(api_key=config.llm_api_key, base_url=config.llm_api_base)

    import time

    start = time.monotonic()
    try:
        response = await client.chat.completions.create(
            model=config.llm_model,
            messages=[{"role": "user", "content": "Say 'ok' and nothing else."}],
            max_tokens=10,
            temperature=0,
        )
        latency_ms = round((time.monotonic() - start) * 1000)
        return {
            "status": "ok",
            "model": response.model,
            "latency_ms": latency_ms,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
            },
        }
    except Exception as e:
        latency_ms = round((time.monotonic() - start) * 1000)
        error_msg = str(e)
        if hasattr(e, "body") and e.body:
            error_msg = e.body.get("message", error_msg)
        return {
            "status": "error",
            "error": error_msg,
            "latency_ms": latency_ms,
        }
