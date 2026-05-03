"""LLM-powered parsing engine: raw kos entry -> structured KosClean."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from time import monotonic
from urllib.parse import urlparse

from openai import AsyncOpenAI, BadRequestError
from pydantic import ValidationError

from app.config import Config, load_config
from app.models import FasilitasCleaned, HargaItem, KontakItem, KosClean, PeraturanCleaned

logger = logging.getLogger(__name__)


@dataclass
class LlmCallResult:
    content: str
    parsed: KosClean | None
    mode: str
    duration_ms: int
    model: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None

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
    "tamu_lawan_jenis": ["dilarang | terbatas | bebas"],
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

4. Ekstrak tipe_kamar dari konteks harga. Info tipe kamar WAJIB masuk ke tipe_kamar, BUKAN catatan:
   - Teks dalam kurung "(AC, km dlm)" → tipe_kamar: "AC, kamar mandi dalam"
   - Prefix/suffix harga seperti "Non AC 700.000/bulan km dalam" → tipe_kamar: "non AC, kamar mandi dalam"
   - "kamar standar" / "kamar jumbo" / "kamar kecil" / "kamar besar" / "kamar bawah" / "kamar atas" / "lantai 1" / "3x3" → tipe_kamar
   - Jika tidak ada info tipe kamar, isi null

5. Ekstrak catatan dari konteks:
   - "belum include listrik" → catatan
   - "(harga bisa berubah)" → catatan
   - "deposit", "bisa nego", "harga bisa berubah", "per orang", "setiap kamar beda-beda" → catatan
   - Jangan taruh AC/non AC/KM dalam/KM luar/ukuran kamar/standar/jumbo/bawah/atas di catatan.

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
   - Return ARRAY, bisa lebih dari satu nilai bila aturan campuran.
   - "dilarang", "tidak boleh", "gaboleh bawa cowo/cewe" → tambahkan "dilarang"
   - "boleh di luar", "hanya sampai ruang tamu", "sampai jam 9", "batas jam" → tambahkan "terbatas"
   - "boleh", "bebas", "diperbolehkan" → tambahkan "bebas"
   - Tidak ada info → []
   - Jangan duplikasi nilai di array.

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

3. Jika peraturan kosong ("-", ".", "") → jam_malam/tamu_menginap/boleh_hewan null, tamu_lawan_jenis: [], lainnya: []

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
        jwt_refresh_expire_days=base.jwt_refresh_expire_days,
        llm_api_key=override.get("api_key", base.llm_api_key),
        llm_api_base=override.get("api_base", base.llm_api_base),
        llm_model=override.get("model", base.llm_model),
        llm_max_tokens=override.get("max_tokens", base.llm_max_tokens),
        llm_temperature=override.get("temperature", base.llm_temperature),
    )


def _duration_ms(start: float) -> int:
    return round((monotonic() - start) * 1000)


def _entry_id(raw_entry: dict) -> str:
    return str(raw_entry.get("id") or raw_entry.get("_id") or raw_entry.get("No") or "")


def _entry_name(raw_entry: dict) -> str:
    return str(raw_entry.get("Nama kos") or raw_entry.get("nama") or raw_entry.get("name") or "")


def _api_base_host(api_base: str) -> str:
    parsed = urlparse(api_base)
    return parsed.netloc or api_base


def _error_text(exc: Exception, limit: int = 500) -> str:
    text = str(exc).replace("\n", " ")
    return text[:limit]


def _tokens(response) -> tuple[int | None, int | None, int | None]:
    usage = getattr(response, "usage", None)
    if not usage:
        return None, None, None
    return (
        getattr(usage, "prompt_tokens", None),
        getattr(usage, "completion_tokens", None),
        getattr(usage, "total_tokens", None),
    )


async def _structured_completion(client: AsyncOpenAI, config: Config, messages: list[dict]):
    parse_method = getattr(client.chat.completions, "parse", None)
    if parse_method is None:
        parse_method = getattr(client.beta.chat.completions, "parse", None)
    if parse_method is None:
        raise TypeError("OpenAI SDK parse helper is not available")

    return await parse_method(
        model=config.llm_model,
        messages=messages,
        temperature=config.llm_temperature,
        max_tokens=config.llm_max_tokens,
        response_format=KosClean,
    )


async def _call_llm(
    raw_entry: dict,
    custom_prompt: str | None = None,
    override_config: dict | None = None,
) -> LlmCallResult:
    config = _effective_config(override_config)

    if not config.llm_api_key:
        raise RuntimeError("LLM API key is not configured")

    client = AsyncOpenAI(
        api_key=config.llm_api_key,
        base_url=config.llm_api_base,
        default_headers={"User-Agent": "UNSKosFinder-Parser/1.0"},
    )

    system_prompt = _SYSTEM_PROMPT
    if custom_prompt:
        system_prompt += f"\n\nINSTRUKSI TAMBAHAN DARI ADMIN:\n{custom_prompt}"

    user_message = f"Parse this raw JSON:\n{json.dumps(raw_entry, separators=(',', ':'), ensure_ascii=False)}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    logger.info(
        "llm_call_started entry_id=%s model=%s api_base=%s max_tokens=%s temperature=%s system_chars=%s user_chars=%s",
        _entry_id(raw_entry),
        config.llm_model,
        _api_base_host(config.llm_api_base),
        config.llm_max_tokens,
        config.llm_temperature,
        len(system_prompt),
        len(user_message),
    )

    started = monotonic()
    try:
        response = await _structured_completion(client, config, messages)
        prompt_tokens, completion_tokens, total_tokens = _tokens(response)
        message = response.choices[0].message
        parsed = getattr(message, "parsed", None)
        refusal = getattr(message, "refusal", None)
        content = (message.content or "").strip()
        if refusal:
            raise RuntimeError(f"LLM refused structured output: {refusal}")
        if parsed is None:
            if not content:
                raise RuntimeError("LLM returned empty structured content")
            parsed = KosClean.model_validate(json.loads(_sanitize_llm_json(content)))
        elif not isinstance(parsed, KosClean):
            parsed = KosClean.model_validate(parsed)
        return LlmCallResult(
            content=content,
            parsed=parsed,
            mode="json_schema",
            duration_ms=_duration_ms(started),
            model=getattr(response, "model", config.llm_model),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        )
    except (BadRequestError, TypeError, AttributeError) as exc:
        logger.warning(
            "llm_structured_output_fallback entry_id=%s model=%s api_base=%s duration_ms=%s error=%s",
            _entry_id(raw_entry),
            config.llm_model,
            _api_base_host(config.llm_api_base),
            _duration_ms(started),
            _error_text(exc),
        )

    started = monotonic()
    try:
        response = await client.chat.completions.create(
            model=config.llm_model,
            messages=messages,
            temperature=config.llm_temperature,
            max_tokens=config.llm_max_tokens,
            response_format={"type": "json_object"},
        )
        mode = "json_object"
    except BadRequestError as exc:
        logger.warning(
            "llm_json_mode_fallback entry_id=%s model=%s api_base=%s duration_ms=%s error=%s",
            _entry_id(raw_entry),
            config.llm_model,
            _api_base_host(config.llm_api_base),
            _duration_ms(started),
            _error_text(exc),
        )
        started = monotonic()
        response = await client.chat.completions.create(
            model=config.llm_model,
            messages=messages,
            temperature=config.llm_temperature,
            max_tokens=config.llm_max_tokens,
        )
        mode = "plain_json"

    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("LLM returned empty content")
    prompt_tokens, completion_tokens, total_tokens = _tokens(response)
    return LlmCallResult(
        content=content.strip(),
        parsed=None,
        mode=mode,
        duration_ms=_duration_ms(started),
        model=getattr(response, "model", config.llm_model),
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
    )


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


_ROOM_TYPE_PATTERNS: list[tuple[re.Pattern[str], str | None]] = [
    (re.compile(r"\bnon\s*-?\s*ac\b", re.IGNORECASE), "non AC"),
    (re.compile(r"\btanpa\s+ac\b", re.IGNORECASE), "non AC"),
    (re.compile(r"\bac\b", re.IGNORECASE), "AC"),
    (re.compile(r"\bkm\s*(?:dalam|dalem|dlm)\b", re.IGNORECASE), "kamar mandi dalam"),
    (re.compile(r"\bkamar\s+mandi\s*(?:dalam|dalem|dlm)\b", re.IGNORECASE), "kamar mandi dalam"),
    (re.compile(r"\bkm\s*(?:luar|lwr)\b", re.IGNORECASE), "kamar mandi luar"),
    (re.compile(r"\bkamar\s+mandi\s*(?:luar|lwr)\b", re.IGNORECASE), "kamar mandi luar"),
    (re.compile(r"\bkamar\s+(?:standar|standard)\b", re.IGNORECASE), "kamar standar"),
    (re.compile(r"\bkamar\s+jumbo\b", re.IGNORECASE), "kamar jumbo"),
    (re.compile(r"\bkamar\s+(?:vip|eksklusif|exclusive)\b", re.IGNORECASE), None),
    (re.compile(r"\b(?:vip|eksklusif|exclusive)\b", re.IGNORECASE), None),
    (re.compile(r"\bkamar\s+(?:kecil|besar|luas)\b", re.IGNORECASE), None),
    (re.compile(r"\bkamar\s+(?:atas|bawah)\b", re.IGNORECASE), None),
    (re.compile(r"\blantai\s*\d+\b", re.IGNORECASE), None),
    (re.compile(r"\blt\.?\s*\d+\b", re.IGNORECASE), None),
    (re.compile(r"\b\d+(?:[x×]\d+)+\b", re.IGNORECASE), None),
]


def _cleanup_room_note_remainder(text: str) -> str | None:
    text = re.sub(r"[()\[\]{}]", " ", text)
    text = re.sub(r"\b(?:yang|yg|pake|pakai|dengan|include|dn|dan|untuk|kamar|room)\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*(?:,|;|/|\||&|\+|-)\s*", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" .,;:-")
    return text or None


def _extract_room_type_from_note(note: str) -> tuple[str | None, str | None]:
    matches: list[tuple[int, int, str]] = []
    for pattern, label in _ROOM_TYPE_PATTERNS:
        for match in pattern.finditer(note):
            room_label = label or re.sub(r"\s+", " ", match.group(0)).strip().lower()
            matches.append((match.start(), match.end(), room_label))

    if not matches:
        return None, note.strip() or None

    matches.sort(key=lambda item: (item[0], -(item[1] - item[0])))
    selected: list[tuple[int, int, str]] = []
    for start, end, label in matches:
        if any(start < used_end and end > used_start for used_start, used_end, _ in selected):
            continue
        selected.append((start, end, label))

    labels: list[str] = []
    for _, _, label in selected:
        if label.lower() not in {existing.lower() for existing in labels}:
            labels.append(label)

    remainder = note
    for start, end, _ in sorted(selected, key=lambda item: item[0], reverse=True):
        remainder = f"{remainder[:start]} {remainder[end:]}"

    return ", ".join(labels), _cleanup_room_note_remainder(remainder)


def _merge_room_type(existing: str | None, extracted: str | None) -> str | None:
    if not extracted:
        return existing.strip() if existing and existing.strip() else None
    parts: list[str] = []
    for value in (existing, extracted):
        if not value:
            continue
        for part in value.split(","):
            clean = part.strip()
            if clean and clean.lower() not in {item.lower() for item in parts}:
                parts.append(clean)
    return ", ".join(parts) if parts else None


def _normalize_harga_room_notes(clean: KosClean) -> tuple[KosClean, int]:
    moved = 0
    for harga in clean.harga:
        if not harga.catatan:
            continue
        extracted, remainder = _extract_room_type_from_note(harga.catatan)
        if not extracted:
            continue
        next_tipe_kamar = _merge_room_type(harga.tipe_kamar, extracted)
        if next_tipe_kamar != harga.tipe_kamar:
            moved += 1
        harga.tipe_kamar = next_tipe_kamar
        harga.catatan = remainder
    return clean, moved


async def parse_single_entry(
    raw_entry: dict,
    custom_prompt: str | None = None,
    override_config: dict | None = None,
    max_retries: int = 2,
) -> dict:
    """Parse one raw kos entry into a KosClean dict via LLM with retry."""
    entry_id = _entry_id(raw_entry)
    entry_name = _entry_name(raw_entry)
    started = monotonic()
    for attempt in range(max_retries + 1):
        attempt_started = monotonic()
        logger.info(
            "llm_parse_attempt_start entry_id=%s entry_name=%s attempt=%s max_retries=%s",
            entry_id,
            entry_name,
            attempt + 1,
            max_retries,
        )
        try:
            llm_response = await _call_llm(raw_entry, custom_prompt, override_config)
            if llm_response.parsed is not None:
                validated = llm_response.parsed
            else:
                sanitized = _sanitize_llm_json(llm_response.content)
                parsed = json.loads(sanitized)
                validated = KosClean.model_validate(parsed)
            validated, moved_room_notes = _normalize_harga_room_notes(validated)
            harga_count = len(validated.harga)
            tipe_kamar_count = sum(1 for harga in validated.harga if harga.tipe_kamar)
            logger.info(
                "llm_parse_attempt_success entry_id=%s entry_name=%s attempt=%s mode=%s model=%s "
                "call_duration_ms=%s attempt_duration_ms=%s total_duration_ms=%s prompt_tokens=%s "
                "completion_tokens=%s total_tokens=%s response_chars=%s harga_count=%s tipe_kamar_count=%s moved_room_notes=%s",
                entry_id,
                entry_name,
                attempt + 1,
                llm_response.mode,
                llm_response.model,
                llm_response.duration_ms,
                _duration_ms(attempt_started),
                _duration_ms(started),
                llm_response.prompt_tokens,
                llm_response.completion_tokens,
                llm_response.total_tokens,
                len(llm_response.content),
                harga_count,
                tipe_kamar_count,
                moved_room_notes,
            )
            return validated.model_dump()
        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(
                "llm_parse_attempt_invalid entry_id=%s entry_name=%s attempt=%s duration_ms=%s error=%s",
                entry_id,
                entry_name,
                attempt + 1,
                _duration_ms(attempt_started),
                _error_text(e),
            )
            if attempt == max_retries:
                raise ValueError(f"LLM response invalid after {max_retries} retries: {e}") from e
            # Inject error feedback for next retry
            custom_prompt = (custom_prompt or "") + f"\nPrevious parsing error: {e}. Pastikan output adalah JSON valid tanpa markdown."
        except Exception as e:
            logger.exception(
                "llm_parse_attempt_error entry_id=%s entry_name=%s attempt=%s duration_ms=%s error=%s",
                entry_id,
                entry_name,
                attempt + 1,
                _duration_ms(attempt_started),
                _error_text(e),
            )
            raise
    raise RuntimeError("Unreachable")


async def test_llm_connection(override_config: dict) -> dict:
    """Send a minimal prompt to verify LLM connectivity."""
    config = _effective_config(override_config)

    client = AsyncOpenAI(
        api_key=config.llm_api_key or "dummy",
        base_url=config.llm_api_base,
        default_headers={"User-Agent": "UNSKosFinder-Parser/1.0"},
    )

    import time

    start = time.monotonic()
    try:
        response = await client.chat.completions.create(
            model=config.llm_model,
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=5,
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
        # Try to extract richer error from OpenAI-style exceptions
        if hasattr(e, "body") and e.body:
            if isinstance(e.body, dict):
                error_msg = e.body.get("message", error_msg)
            elif isinstance(e.body, str):
                error_msg = e.body
        # Some providers embed error in response JSON
        if hasattr(e, "response") and e.response:
            try:
                err_json = e.response.json()
                if isinstance(err_json, dict):
                    err_detail = err_json.get("error", {})
                    if isinstance(err_detail, dict):
                        error_msg = err_detail.get("message", error_msg)
                    elif isinstance(err_detail, str):
                        error_msg = err_detail
            except Exception:
                pass
        return {
            "status": "error",
            "error": error_msg,
            "latency_ms": latency_ms,
        }
