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

## Tech Stack

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

#### Untuk mendapatkan titik koordinat dari data baru 
```bash
python src/get_new_data.py
```
#### Untuk ingest/menambahkan data ke frontend
``` bash
python src/ingest_data.py
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
|14/04/2026|413|103|v2

## Future Work and To Do

### UI
- [x] Tambah web logo.
- [x] Logo untuk tiap titik by jenis.
- [ ] Mobile-friendly.

### UX
- [ ] Tambah filter di frontend (harga, jenis, fasilitas)
- [ ] Fitur comparison antar kos.
- [x] Tampilkan rute dari kos ke fakultas/kampus.
- [x] Hitung jarak dari kos ke tujuan.

### Data
- [ ] Parsing harga yang lebih baik.

### Other
- [x] Create staging area.
- [x] Migration to dedicated db.


## Port Matrix

| Environment | Service    | URL                     | Profile       | Network               | Exposed |
|-------------|------------|-------------------------|---------------|-----------------------|---------|
| Development | Frontend   | http://localhost:3000   | development   | semar-kos-dev         | Yes     |
| Development | Admin      | http://localhost:3001   | development   | semar-kos-dev         | Yes     |
| Development | Backend    | http://localhost:8000   | development   | semar-kos-dev         | Yes     |
| Development | MongoDB    | —                       | development   | semar-kos-dev         | No      |
| Production  | Web        | http://localhost:3002   | production    | semar-kos-production  | Yes     |
| Production  | Admin      | http://localhost:3005   | production    | semar-kos-production  | Yes     |
| Production  | Backend    | —                       | production    | semar-kos-production  | No      |
| Production  | MongoDB    | —                       | production    | semar-kos-production  | No      |
| Staging     | Web        | http://localhost:3003   | staging       | semar-kos-staging     | Yes     |
| Staging     | Admin      | http://localhost:3004   | staging       | semar-kos-staging     | Yes     |
| Staging     | Backend    | http://localhost:8001   | staging       | semar-kos-staging     | Yes     |
| Staging     | MongoDB    | —                       | staging       | semar-kos-staging     | No      |

**Catatan**: Production dan Staging backend/MongoDB tidak di-expose ke host (intra-Docker only).

## Docker (Production/Staging)

Production dan staging masing-masing menjalankan full stack (web, admin, backend, MongoDB) dengan network isolation. Backend dan MongoDB tidak di-expose ke host.

```bash
# Setup environment files
cp .env.production.example .env.production
cp .env.staging.example .env.staging

# Start both environments
docker compose --profile production --profile staging up -d --build
```

- Production web: http://localhost:3002
- Production admin: http://localhost:3005
- Staging web: http://localhost:3003
- Staging admin: http://localhost:3004

Stop: `docker compose --profile production --profile staging down`

## Docker (Development)

Dev compose menjalankan 4 services: frontend, admin, backend (FastAPI), dan MongoDB.

### Setup Environment

```bash
# Copy environment file
cp .env.development.example .env.development

# Edit .env.development dengan variabel berikut:
# GOOGLE_MAPS_API_KEY=<google_maps_api_key>
# API_INTERNAL_URL=http://backend_dev:8000
# MONGO_URL=mongodb://mongodb:27017/semar_kos
# JWT_SECRET=<random_secret_key>
# JWT_EXPIRE_MINUTES=60
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD_BCRYPT=<bcrypt_hash>
#
# Generate bcrypt hash:
# docker compose --profile development run --rm backend_dev uv run python -c "from passlib.hash import bcrypt; print(bcrypt.hash('admin123'))"
```

### Start Development

```bash
# Start all 4 services dengan hot reload
docker compose --profile development up -d --build
```

- Frontend: http://localhost:3000
- Admin: http://localhost:3001
- Backend API: http://localhost:8000

### Seed Data

```bash
# Import data dari JSON ke MongoDB
docker compose --profile development run --rm backend_dev uv run python -m app.seed
```

**Catatan**: Dataset bersifat close-source. Jika file data tidak tersedia, seed akan skip dengan pesan "seed skipped: dataset not present".

### Stop

```bash
docker compose --profile development down
```

## CI/CD Workflows

Deployment ke VPS menggunakan GitHub Actions. Terdapat dua workflow terpisah yang deploy ke server berbeda. Masing-masing menggunakan **GitHub Environment** sehingga secret/isolasi deployment terpisah antar environment.

### Staging Deploy
- **Trigger**: Push ke branch `staging` atau manual (`workflow_dispatch`)
- **File**: `.github/workflows/staging.yml`
- **Environment**: `staging`
- **Services**: `web_staging`, `backend_staging`, `admin_staging`
- **Server**: Staging VPS
- **Dir default**: `/opt/semar-kos-staging`
- **Health check**: `https://${STAGING_DOMAIN}`

### Production Deploy
- **Trigger**: Push ke branch `main` atau manual (`workflow_dispatch`)
- **File**: `.github/workflows/production.yml`
- **Environment**: `production`
- **Services**: `web_prod`, `backend_prod`, `admin_prod`
- **Server**: Production VPS (beda server dari staging)
- **Dir default**: `/opt/semar-kos-prod`
- **Health check**: `https://${PRODUCTION_DOMAIN}`

### Setup Environment Secrets

Workflow membaca secret/variable dari **GitHub Environment** terlebih dahulu. Buat environment di repo: **Settings → Environments → New environment**.

**Environment `production`:**
- Semua secret production (SSH_HOST, SSH_USER, SSH_KEY, dll) wajib di-set di sini.
- Ini memastikan production secrets tidak tercampur dengan staging.

**Environment `staging`:**
- Semua secret staging di-set di environment ini.

### Required Secrets & Variables

| Name | Environment | Keterangan |
|------|-------------|------------|
| `SSH_HOST` | production / staging | IP/hostname VPS |
| `SSH_USER` | production / staging | Username SSH |
| `SSH_KEY` | production / staging | Private key SSH |
| `GITHUB_TOKEN` | Auto | Token bawaan GH Actions |
| `GOOGLE_MAPS_API_KEY` | production / staging | API key Google Maps |
| `JWT_SECRET` | production / staging | Secret key JWT |
| `ADMIN_PASSWORD_BCRYPT` | production / staging | Hash bcrypt password admin |
| `PRODUCTION_DOMAIN` | production | Domain production (health check) |
| `STAGING_DOMAIN` | staging | Domain staging (health check) |
| `APP_DIR` | production / staging | Direktori deploy di VPS (optional) |
| `WEB_PORT` | production / staging | Host port web (optional) |
| `ADMIN_PORT` | production / staging | Host port admin (optional) |

## Kontribusi

Terbuka untuk kolaborasi dan atau pull-request, baik dalam pengembangan maupun adanya bug. Untuk kolaborasi harap hubungi creator untuk mendapatkan akses data. Jika terdapat titik kos atau informasi yang kurang benar dan tidak akurat, mohon untuk menghubungi creator.

## Acknowledgement
Terima kasih untuk pihak BEM UNS dan collaborator lainnya dalam menyediakan data.