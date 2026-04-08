# Semarkosfind

Aplikasi web peta interaktif untuk mencari dan menemukan kos (indekos) di sekitar Universitas Sebelas Maret (UNS) Surakarta.

## Deskripsi

**Semar Kos Finder** adalah platform berbasis peta yang membantu mahasiswa dan calon penghuni menemukan kos yang sesuai di sekitar kampus UNS. Aplikasi ini menampilkan lokasi kos pada peta interaktif lengkap dengan informasi detail seperti harga, fasilitas, peraturan, dan kontak pemilik.  
Aplikasi ini ditujukan untuk mahasiswa terutama mahasiswa baru agar mudah dalam mencari kos secara visual. Proyek ini menawarkan kemudahan dan akurasi, dimana titik-titik kos 95% terdapat pada titik-titik yang akurat sesuai lokasi asli kos tersebut berada

## Fitur

- **Peta Interaktif** - Menampilkan lokasi kos dengan marker pada peta
- **Informasi Detail** - Popup informasi lengkap untuk setiap kos:
  - Nama kos
  - Harga
  - Fasilitas
  - Peraturan
  - Kontak WhatsApp (langsung dapat diklik)
- **Geocoding Otomatis** - Konversi alamat menjadi koordinat latitude/longitude
- **Integrasi WhatsApp** - Link langsung ke WhatsApp pemilik kos

## Teknologi

### Frontend
- **Next.js 16** - Framework React untuk production
- **React 19** - Library UI
- **MapLibre GL** - Library peta open-source
- **TypeScript** - JavaScript dengan type safety

### Backend / Data Processing
- **Python 3.11** - Script pemrosesan data
- **pdfplumber** - Ekstraksi data dari PDF
- **pandas** - Manipulasi data
- **Google Maps Geocoding API** - Konversi alamat ke koordinat
- **Jupyter Notebooks** - Eksplorasi data interaktif

## Struktur Proyek

```
├── frontend/                   # Aplikasi Next.js
│   ├── app/                    # App router
│   ├── components/             # Komponen React
│   │   └── Map.tsx             # Komponen peta utama
│   └── public/data/            # Data JSON statis
├── src/                        # Script Python
│   ├── extract_pdf.py          # Ekstraksi data PDF
│   ├── geocoding_location.py   # Geocoding lokasi
│   ├── csv_to_json.py          # Konversi CSV ke JSON
│   └── get_new_data.py         # Tambah data kos baru
├── notebooks/                  # Jupyter notebooks
│   └── cleaning.ipynb          # Pembersihan data
└── data/                       # Data
    ├── raw/                    # Data mentah
    ├── preprocessed/           # Data yang sudah dibersihkan
    └── final/                  # Data final (geocoded)
```

## Data Pipeline

1. **Ekstraksi** (`extract_pdf.py`) - Ekstrak data dari dokumen PDF.
2. **Cleaning** (`notebooks/cleaning.ipynb`) - Bersihkan dan normalisasi data.
3. **Geocoding** (`geocoding_location.py`) - Konversi alamat ke koordinat.
4. **Konversi** (`csv_to_json.py`) - Ubah CSV ke JSON untuk frontend.

## Statistik Data
Data diperloleh dari hasil survei kos yang dilakukan BEM UNS pada tahun 2024 dan 2025. Data ini akan terus diupdate dan disesuaikan.
- **Total Kos**: ~310 kos
- **Berdasarkan Jenis**:
  - Putri: 
  - Putra: 
  - Campuran: 
- **Kontak Valid**: ~94%
> **Catatan :** Dataset masih bersifat close-source.
## Penggunaan

### Setup Environment

```bash
# Install dependencies Python
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Edit .env dan tambahkan GMAPS_API_KEY

# Install dependencies Frontend
cd frontend
npm install
```

### Menjalankan Aplikasi

```bash
# Jalankan frontend (Next.js)
cd frontend
npm run dev

# Akses aplikasi di http://localhost:3000
```

### Menambah Data Kos Baru

```bash
python src/get_new_data.py
```

## Data Schema

| Field | Deskripsi |
|-------|-----------|
| `Nama kos` | Nama kos |
| `Jenis kos` | Putra/Putri/Campuran |
| `Alamat` | Alamat lengkap |
| `Plus_Code` | Google Plus Code |
| `Fasilitas` | Fasilitas yang tersedia |
| `Peraturan` | Peraturan kos |
| `Harga` | Informasi harga |
| `Narahubung` | Kontak WhatsApp |
| `lat` | Latitude |
| `long` | Longitude |

## Log Update Data
Karena mengutamakan akurasi dan validitas data, maka untuk penambahan data baru akan memakan waktu. Jika ingin menambahkan kos kalian, bisa hubungi creator. Pembaruan data akan dilakukan secara batch atau gelombang.
|Date|Total Data|Update|Version|
|----|----------|------|-------|
|8/4/2026|310|0|v1|

## Future Work

- [ ] Parsing harga yang lebih baik.
- [ ] Tambah filter di frontend (harga, jenis, fasilitas)
- [ ] Fitur comparison antar kos.
- [x] Tampilkan rute dari kos ke fakultas/kampus.
- [x] Hitung jarak dari kos ke tujuan.

## Kontribusi

Terbuka untuk kolaborasi dan atau pull-request, baik dalam pengembangan maupun adanya bug. Untuk kolaborasi harap hubungi creator untuk mendapatkan akses data. Jika terdapat titik kos atau informasi yang kurang benar dan tidak akurat, mohon untuk menghubungi creator.

## Acknowledgement
Terima kasih untuk pihak BEM UNS dan collaborator lainnya dalam menyediakan data.