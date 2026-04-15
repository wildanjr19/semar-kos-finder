'''
Ekstraksi data dari dokumen PDF menggunakan pdfplumber.
'''

import logging
import re
from typing import List

import pandas as pd
import pdfplumber

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)


def _normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _clean_jenis_kos_text(text: str) -> str:
    # Hapus label artefak formulir/survei yang sering ikut terbaca di kolom Jenis Kos.
    cleaned = re.sub(r"\bSURVEI\s+KOS\s+BEM\s+UNS\b", "", text, flags=re.IGNORECASE)
    return _normalize_spaces(cleaned)


def _postprocess_row(row: List[str]) -> List[str]:
    row = [_normalize_spaces(cell) for cell in row]

    # Index 2 = Jenis Kos
    if len(row) > 2:
        row[2] = _clean_jenis_kos_text(row[2])

    return row


def _clean_row(row: List[str]) -> List[str]:
    return [str(cell).replace("\n", " ").strip() if cell else "" for cell in row]


def _is_header_row(row: List[str]) -> bool:
    non_empty = [cell for cell in row if cell]
    if not non_empty:
        return False

    row_text = " ".join(non_empty).lower()
    return (
        "nama kos" in row_text
        and "jenis kos" in row_text
        and "narahubung" in row_text
    )


def _extract_rows_from_words(page, jumlah_kolom=8, anchors_hint=None):
    words = page.extract_words(x_tolerance=1, y_tolerance=3, use_text_flow=True) or []
    if not words:
        return []

    words = sorted(words, key=lambda w: (w["top"], w["x0"]))

    # Kelompokkan kata per baris berdasarkan posisi Y.
    lines = []
    tolerance_y = 3
    for word in words:
        if not lines:
            lines.append({"top": word["top"], "words": [word]})
            continue

        if abs(word["top"] - lines[-1]["top"]) <= tolerance_y:
            lines[-1]["words"].append(word)
        else:
            lines.append({"top": word["top"], "words": [word]})

    for line in lines:
        line["words"] = sorted(line["words"], key=lambda w: w["x0"])

    # Cari baris header untuk mendapatkan anchor posisi kolom.
    idx_header = -1
    for idx, line in enumerate(lines):
        line_text = " ".join(w["text"] for w in line["words"]).lower()
        if (
            "nama" in line_text
            and "kos" in line_text
            and "jenis" in line_text
            and "alamat" in line_text
            and "fasilitas" in line_text
        ):
            idx_header = idx
            break

    if idx_header == -1 and not anchors_hint:
        return [], anchors_hint

    anchors = None
    start_line_idx = 0
    if idx_header != -1:
        header_words = lines[idx_header]["words"]

        def _find_anchor_x(prefixes: List[str]):
            for w in header_words:
                text = w["text"].strip().lower()
                if any(text.startswith(prefix) for prefix in prefixes):
                    return float(w["x0"])
            return None

        anchors = [
            _find_anchor_x(["no"]),
            _find_anchor_x(["nama"]),
            _find_anchor_x(["jenis"]),
            _find_anchor_x(["alamat"]),
            _find_anchor_x(["ukuran"]),
            _find_anchor_x(["harga"]),
            _find_anchor_x(["fasilitas"]),
            _find_anchor_x(["narahubung", "narahubung/wa", "narahubung-wa", "narahubungwa"]),
        ]

        if any(anchor is None for anchor in anchors):
            if anchors_hint:
                anchors = anchors_hint
                start_line_idx = 0
            else:
                return [], anchors_hint
        else:
            start_line_idx = idx_header + 1
    else:
        anchors = anchors_hint
        start_line_idx = 0

    # Hitung batas antar kolom dari titik tengah anchor.
    boundaries = [0.0]
    for i in range(len(anchors) - 1):
        boundaries.append((anchors[i] + anchors[i + 1]) / 2)
    boundaries.append(float(page.width))

    data_rows = []
    for line in lines[start_line_idx:]:
        cols = ["" for _ in range(jumlah_kolom)]
        for w in line["words"]:
            x = float(w["x0"])
            col_idx = jumlah_kolom - 1
            for i in range(jumlah_kolom):
                if boundaries[i] <= x < boundaries[i + 1]:
                    col_idx = i
                    break

            if cols[col_idx]:
                cols[col_idx] += " " + w["text"]
            else:
                cols[col_idx] = w["text"]

        cols = [c.strip() for c in cols]
        if not any(cols):
            continue

        # Baris baru jika kolom "No" berisi angka. Selain itu dianggap lanjutan baris sebelumnya.
        is_new_row = bool(re.match(r"^\d+[\.)]?$", cols[0]))
        if data_rows and not is_new_row:
            prev = data_rows[-1]
            for i, value in enumerate(cols):
                if value:
                    prev[i] = (prev[i] + " " + value).strip() if prev[i] else value
            continue

        if not is_new_row:
            continue

        data_rows.append(cols)

    return data_rows, anchors


def ekstrak_kolom_pilihan(file_path):
    all_data = []

    # Header sesuai struktur PDF (8 kolom)
    headers = [
        "No",
        "Nama Kos",
        "Jenis Kos",
        "Alamat",
        "Ukuran",
        "Harga Kos",
        "Fasilitas",
        "Narahubung",
    ]

    with pdfplumber.open(file_path) as pdf:
        total_halaman = len(pdf.pages)
        logger.info(f"Mulai ekstraksi PDF: {file_path} ({total_halaman} halaman)")

        anchors_cache = None

        for halaman_ke, page in enumerate(pdf.pages, start=1):
            extracted_rows, anchors_cache = _extract_rows_from_words(
                page, jumlah_kolom=8, anchors_hint=anchors_cache
            )

            if extracted_rows:
                logger.info(
                    f"Halaman {halaman_ke}: ekstraksi words berhasil ({len(extracted_rows)} baris)"
                )
                for row in extracted_rows:
                    if _is_header_row(row):
                        continue
                    if row[1].lower() in ["", "nama kos"]:
                        continue
                    all_data.append(_postprocess_row(row))
                logger.info(f"Selesai ekstrak halaman {halaman_ke}/{total_halaman}")
                continue

            logger.warning(
                f"Halaman {halaman_ke}: ekstraksi words gagal (baris data tidak ditemukan)"
            )

            logger.info(f"Selesai ekstrak halaman {halaman_ke}/{total_halaman}")

        logger.info(f"Ekstraksi selesai: total {total_halaman} halaman diproses")

    df = pd.DataFrame(all_data, columns=headers)
    return df


# --- EKSEKUSI ---
file_input = "data/raw/SURVEI_KOS_UNS_2023.pdf"
try:
    df_hasil = ekstrak_kolom_pilihan(file_input)

    # Simpan hasil
    #df_hasil.to_excel("data/data_kost_extracted.xlsx", index=False)
    df_hasil.to_csv("data/raw/data_kost_2023.csv", index=False)
    logger.info(
        f"Berhasil mengekstrak {len(df_hasil)} baris dengan {len(df_hasil.columns)} kolom"
    )
    print(df_hasil.head())

except Exception as e:
    logger.exception(f"Terjadi kesalahan: {e}")
