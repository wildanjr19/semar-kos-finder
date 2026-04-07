'''
Ekstraksi data dari dokumen PDF menggunakan pdfplumber.
'''

import logging

import pandas as pd
import pdfplumber

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)


def ekstrak_kolom_pilihan(file_path):
    all_data = []

    # Header baru sesuai keinginanmu (9 kolom)
    headers = [
        "No",
        "Nama Kos",
        "Jenis",
        "Alamat",
        "Ukuran",
        "Harga Kos",
        "Fasilitas",
        "Peraturan",
        "Narahubung",
    ]

    with pdfplumber.open(file_path) as pdf:
        total_halaman = len(pdf.pages)
        logger.info(f"Mulai ekstraksi PDF: {file_path} ({total_halaman} halaman)")

        for halaman_ke, page in enumerate(pdf.pages, start=1):
            table = page.extract_table(
                {
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                    "snap_tolerance": 3,
                }
            )

            if table:
                for row in table:
                    # 1. Bersihkan teks
                    clean_row = [
                        str(cell).replace("\n", " ").strip() if cell else ""
                        for cell in row
                    ]

                    # 2. Logika filter header & baris kosong
                    if not clean_row or clean_row[1].lower() in ["nama kos", ""]:
                        continue

                    # 3. Penyesuaian Kolom:
                    # Jika tabel asli punya 10 kolom (termasuk Foto di indeks ke-8),
                    # kita ambil semua kecuali indeks ke-8 (Foto).
                    if len(clean_row) >= 10:
                        # Ambil No sampai Peraturan (indeks 0-7), lalu ambil Narahubung (indeks 9)
                        filtered_row = clean_row[0:8] + [clean_row[9]]
                        all_data.append(filtered_row)
                    elif len(clean_row) == 9:
                        # Jika tabel memang hanya 9 kolom, ambil semua
                        all_data.append(clean_row)

            logger.info(f"Selesai ekstrak halaman {halaman_ke}/{total_halaman}")

        logger.info(f"Ekstraksi selesai: total {total_halaman} halaman diproses")

    df = pd.DataFrame(all_data, columns=headers)
    return df


# --- EKSEKUSI ---
file_input = "data/data_kost_69pg.pdf"
try:
    df_hasil = ekstrak_kolom_pilihan(file_input)

    # Simpan hasil
    df_hasil.to_excel("data/data_kost_extracted.xlsx", index=False)
    df_hasil.to_csv("data/data_kost_extracted.csv", index=False)
    logger.info(
        f"Berhasil mengekstrak {len(df_hasil)} baris dengan {len(df_hasil.columns)} kolom"
    )
    print(df_hasil.head())

except Exception as e:
    logger.exception(f"Terjadi kesalahan: {e}")
