import os
import csv
import time
import logging
from datetime import datetime
from dotenv import load_dotenv
import requests

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f'geocoding_log_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
GMAPS_API_KEY = os.getenv('GMAPS_API_KEY')

if not GMAPS_API_KEY:
    logger.error("GMAPS_API_KEY tidak ditemukan di file .env")
    raise ValueError("GMAPS_API_KEY harus diatur di file .env")

# Konstanta
GEOCODING_API_URL = "https://maps.googleapis.com/maps/api/geocode/json"
INPUT_FILE = r"data\preprocessed\data_kos_cleaned.csv"
OUTPUT_FILE = r"data\preprocessed\data_kos_cleaned_with_address.csv"

# Koordinat Surakarta untuk bias pencarian
SURAKARTA_LAT = -7.5667
SURAKARTA_LNG = 110.8167


def get_address_and_plus_code(kos_name):
    """
    Mendapatkan alamat lengkap dan plus code dari Google Maps Geocoding API.
    
    Args:
        kos_name: Nama kos yang akan dicari
        
    Returns:
        tuple: (alamat_lengkap, plus_code, status)
               status: 'success', 'no_plus_code', atau 'failed'
    """
    try:
        # Tambahkan "Surakarta" atau "Solo" ke query untuk meningkatkan akurasi
        query = f"{kos_name}, Surakarta"
        
        params = {
            'address': query,
            'key': GMAPS_API_KEY,
            'region': 'id',  # Batasi ke Indonesia
            # Bias lokasi ke Surakarta (optional, tidak strict)
            'bounds': f"{SURAKARTA_LAT-0.5},{SURAKARTA_LNG-0.5}|{SURAKARTA_LAT+0.5},{SURAKARTA_LNG+0.5}"
        }
        
        response = requests.get(GEOCODING_API_URL, params=params, timeout=30)
        data = response.json()
        
        if data.get('status') != 'OK':
            logger.warning(f"Geocoding gagal untuk '{kos_name}': {data.get('status')}")
            return None, None, 'failed'
        
        results = data.get('results', [])
        if not results:
            logger.warning(f"Tidak ada hasil untuk '{kos_name}'")
            return None, None, 'failed'
        
        # Ambil hasil pertama
        result = results[0]
        
        # Alamat lengkap
        formatted_address = result.get('formatted_address', '')
        
        # Plus code (jika ada)
        plus_code = None
        if 'plus_code' in result:
            plus_code = result['plus_code'].get('global_code', '')
        
        # Tentukan status
        if plus_code:
            status = 'success'
            logger.info(f"[OK] Berhasil: '{kos_name}' - Plus code: {plus_code}")
        else:
            status = 'no_plus_code'
            logger.info(f"[INFO] Alamat ditemukan tapi tanpa plus code: '{kos_name}'")
        
        return formatted_address, plus_code, status
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error network untuk '{kos_name}': {str(e)}")
        return None, None, 'failed'
    except Exception as e:
        logger.error(f"Error tidak terduga untuk '{kos_name}': {str(e)}")
        return None, None, 'failed'


def process_kos_data():
    """
    Memproses data kos dari CSV dan menambahkan alamat lengkap serta plus code.
    """
    logger.info("=" * 60)
    logger.info("MULAI PROSES GEOCODING")
    logger.info("=" * 60)
    
    # Cek file input ada
    if not os.path.exists(INPUT_FILE):
        logger.error(f"File input tidak ditemukan: {INPUT_FILE}")
        return
    
    # Baca data dari CSV
    data_rows = []
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            data_rows = list(reader)
        logger.info(f"Berhasil membaca {len(data_rows)} baris dari {INPUT_FILE}")
    except Exception as e:
        logger.error(f"Gagal membaca file CSV: {str(e)}")
        return
    
    # Tambahkan kolom baru (hanya Plus_Code, Alamat akan di-overwrite)
    if fieldnames is None:
        logger.error("Tidak dapat membaca header CSV")
        return
    new_fieldnames = list(fieldnames) + ['Plus_Code']
    
    # Statistik
    stats = {
        'total': len(data_rows),
        'success': 0,        # Berhasil dengan plus code
        'no_plus_code': 0,   # Berhasil tapi tanpa plus code
        'failed': 0          # Gagal total
    }
    
    # Proses setiap kos
    processed_rows = []
    
    for idx, row in enumerate(data_rows, 1):
        kos_name = row.get('Nama kos', '').strip()
        
        if not kos_name:
            logger.warning(f"Baris {idx}: Nama kos kosong, dilewati")
            row['Plus_Code'] = ''
            processed_rows.append(row)
            continue
        
        logger.info(f"[{idx}/{len(data_rows)}] Memproses: {kos_name}")
        
        # Panggil API
        address, plus_code, status = get_address_and_plus_code(kos_name)
        
        # Update statistik
        if status == 'success':
            stats['success'] += 1
        elif status == 'no_plus_code':
            stats['no_plus_code'] += 1
        else:
            stats['failed'] += 1
        
        # Simpan hasil (overwrite kolom Alamat, tambah Plus_Code)
        if address:
            row['Alamat'] = address
        row['Plus_Code'] = plus_code if plus_code else ''
        processed_rows.append(row)
        
        # Delay untuk menghindari rate limit (200ms = 5 request/detik)
        time.sleep(0.2)
        
        # Log progress setiap 10 item
        if idx % 10 == 0:
            logger.info(f"Progress: {idx}/{len(data_rows)} ({(idx/len(data_rows)*100):.1f}%)")
    
    # Simpan ke CSV baru
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=new_fieldnames)
            writer.writeheader()
            writer.writerows(processed_rows)
        logger.info(f"\nBerhasil menyimpan hasil ke: {OUTPUT_FILE}")
    except Exception as e:
        logger.error(f"Gagal menyimpan file output: {str(e)}")
        return
    
    # Cetak ringkasan
    logger.info("\n" + "=" * 60)
    logger.info("RINGKASAN PROSES")
    logger.info("=" * 60)
    logger.info(f"Total data kos       : {stats['total']}")
    logger.info(f"Berhasil (dengan plus code) : {stats['success']} ({stats['success']/stats['total']*100:.1f}%)")
    logger.info(f"Berhasil (tanpa plus code)  : {stats['no_plus_code']} ({stats['no_plus_code']/stats['total']*100:.1f}%)")
    logger.info(f"Gagal              : {stats['failed']} ({stats['failed']/stats['total']*100:.1f}%)")
    logger.info("=" * 60)


if __name__ == "__main__":
    process_kos_data()
