import csv
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('duplicates_check.log', mode='w')
    ]
)
logger = logging.getLogger(__name__)


def normalize_name(name: str) -> str:
    """Normalize kos name for comparison."""
    if not name:
        return ""
    return name.lower().strip()


def load_kos_names(filepath: str) -> dict:
    """Load kos names from CSV and return dict with normalized name as key."""
    kos_data = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                # Try common column names for kos name
                nama_kos = row.get('Nama kos') or row.get('nama_kos') or row.get('Nama Kos') or row.get('name') or row.get('nama')
                if nama_kos:
                    normalized = normalize_name(nama_kos)
                    if normalized:
                        kos_data[normalized] = {
                            'original': nama_kos,
                            'row': row_num,
                            'data': row
                        }
    except FileNotFoundError:
        logger.error(f"File not found: {filepath}")
        raise
    except Exception as e:
        logger.error(f"Error reading {filepath}: {e}")
        raise
    return kos_data


def check_duplicates(file1: str, file2: str):
    """Check for duplicate kos names between two CSV files."""
    logger.info("=" * 60)
    logger.info("MEMULAI CEK DUPLIKAT")
    logger.info("=" * 60)
    
    logger.info(f"File 1: {file1}")
    logger.info(f"File 2: {file2}")
    logger.info("")
    
    # Load data dari kedua file
    logger.info("Loading data dari file 1...")
    data1 = load_kos_names(file1)
    logger.info(f"  Total entries: {len(data1)}")
    
    logger.info("Loading data dari file 2...")
    data2 = load_kos_names(file2)
    logger.info(f"  Total entries: {len(data2)}")
    logger.info("")
    
    # Cari duplikat
    duplicates = []
    for normalized_name, info1 in data1.items():
        if normalized_name in data2:
            info2 = data2[normalized_name]
            duplicates.append({
                'nama_kos': info1['original'],
                'normalized': normalized_name,
                'file1_row': info1['row'],
                'file2_row': info2['row'],
                'file1_data': info1['data'],
                'file2_data': info2['data']
            })
    
    # Output hasil
    logger.info("=" * 60)
    logger.info("HASIL CEK DUPLIKAT")
    logger.info("=" * 60)
    
    if not duplicates:
        logger.info("Tidak ditemukan duplikat antara kedua file.")
    else:
        logger.info(f"Ditemukan {len(duplicates)} duplikat:")
        logger.info("")
        
        for i, dup in enumerate(duplicates, 1):
            logger.info(f"  [{i}] {dup['nama_kos']}")
            logger.info(f"       File 1 (baris {dup['file1_row']}): {dup['file1_data']}")
            logger.info(f"       File 2 (baris {dup['file2_row']}): {dup['file2_data']}")
            logger.info("")
    
    # Statistik tambahan
    logger.info("=" * 60)
    logger.info("RINGKASAN")
    logger.info("=" * 60)
    logger.info(f"Total data file 1: {len(data1)}")
    logger.info(f"Total data file 2: {len(data2)}")
    logger.info(f"Total duplikat: {len(duplicates)}")
    logger.info(f"Unik di file 1: {len(data1) - len(duplicates)}")
    logger.info(f"Unik di file 2: {len(data2) - len(duplicates)}")
    logger.info("=" * 60)
    
    return duplicates


if __name__ == "__main__":
    FILE1 = "data/final/data_kos_geo_v1.csv"
    FILE2 = "data/preprocessed/data_kost_2023_fixed.csv"
    
    check_duplicates(FILE1, FILE2)
