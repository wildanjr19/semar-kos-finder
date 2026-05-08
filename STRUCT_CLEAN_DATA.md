# Rencana Cleaning & Restructuring Data Kos

## Status: Detailed Plan Done — Ready to Build

---

## 1. Masalah Data Mentahan (`data_kost_geo.json`)

### 1.1 Harga — Free Text, Multi Format

```
"13.000.000/tahun (yang pake ac dn kamar mandi dlm)"
"1,950/3 bulan\n3,9jt/ semester (6bulan)\n7,4jt/tahun"
"450.000-600.000/bulan"
"7.000.000/tahun kamar standar, 7.500.000/tahun kamar jumbo"
"5-7 juta/tahun"
"Rp 2,500,000*"
"-"
```

Problem: tidak bisa difilter rentang, tidak bisa di-sort, tidak bisa dikelompokkan per tipe kamar.

### 1.2 Fasilitas — String Comma-Separated, Tidak Terstandarisasi

```
"Listrik, Air, Dapur, Kamar mandi dalam, Lemari, Kasur, Meja belajar, Kulkas, AC, WIFI"
"air, dapur, ada yang bersihin 1 Minggu 3 kali, parkiran mudah, tempat jemuran"
"kamar mandi dalam, lemari, kasur, meja bawa sendiri"
```

Problem: mixed casing, noise text, tidak bisa chip-filter.

### 1.3 Peraturan — Naratif Bebas

```
"Jam malam, Tamu menginap"
"tidak boleh membawa lawan jenis, tidak ada jam malam"
"Kunci Bawa Masing\", Selalu dikunci tiap pulang malam"
```

Problem: tidak bisa toggle-filter.

### 1.4 Narahubung — Inconsistent

```
"https://wa.me/6282006941869 (Mba Silmi)"
"https://wa.me/085390238090 atau https://wa.me/081215558007"
"-"
```

Problem: multiple kontak, kadang kosong.

---

## 2. Struktur Target: Opsi A — Fully Structured

Dipilih karena memberikan kemampuan filtering paling powerful di dashboard admin.

### 2.1 TypeScript Interface

```ts
interface HargaItem {
  min: number;
  max: number;
  periode: "bulanan" | "semesteran" | "tahunan" | "per3bulan" | "mingguan";
  tipe_kamar: string | null;   // "AC, kamar mandi dalam", "standar", "jumbo"
  catatan: string | null;      // "belum include listrik", "kamar 3x3"
}

interface FasilitasCleaned {
  dalam_kamar: string[];  // ["ac", "lemari", "kasur", "meja_belajar", "kamar_mandi_dalam", "kipas_angin", "tv"]
  bersama: string[];      // ["wifi", "kulkas", "dapur", "mesin_cuci", "cctv", "jemuran", "parkir", "musholla"]
  utilitas: string[];     // ["listrik", "air"]
  catatan: string;        // sisa naratif yang tidak bisa dikategoriin
}

interface PeraturanCleaned {
  jam_malam: string | null;          // "23:00", "22:00", "tidak ada", null
  tamu_lawan_jenis: "dilarang" | "terbatas" | "bebas" | null;
  tamu_menginap: boolean | null;
  boleh_hewan: boolean | null;
  lainnya: string[];                  // aturan naratif yang tidak bisa diparse
}

interface KontakItem {
  nama: string;
  nomor_wa: string;   // format 628xxx
  url_wa: string;
}

interface KosClean {
  id: string;
  nama: string;
  jenis_kos: "Putri" | "Putra" | "Campuran";
  alamat: string;
  plus_code: string;
  lat: number;
  lon: number;
  ac_status: "ac" | "non_ac" | "keduanya";
  tipe_pembayaran: string[];
  harga: HargaItem[];
  fasilitas: FasilitasCleaned;
  peraturan: PeraturanCleaned;
  kontak: KontakItem[];
}
```

### 2.2 Normalisasi Value Fasilitas

| Raw | Normalized Key |
|-----|---------------|
| "AC", "Ac", "AC (baru)" | `ac` |
| "WIFI", "WiFi", "wifi gratis" | `wifi` |
| "Kamar mandi dalam", "KM dalam" | `kamar_mandi_dalam` |
| "Kamar mandi luar", "KM luar" | `kamar_mandi_luar` |
| "Kulkas", "Lemari es" | `kulkas` |
| "Mesin cuci" | `mesin_cuci` |
| "Kipas angin", "Kipas", "fan" | `kipas_angin` |
| "Dapur", "dapur bersama" | `dapur` |
| "Parkir", "parkiran luas" | `parkir` |
| "Jemuran", "tempat jemur" | `jemuran` |
| "CCTV", "kamera cctv" | `cctv` |
| "Dispenser" | `dispenser` |
| "Musholla", "mushola" | `musholla` |

---

## 3. Contoh Transformasi

### Dari Raw ke Clean

**RAW:**
```json
{
  "No": "1",
  "Nama kos": "Wisma Azima",
  "Jenis kos": "Putri",
  "Fasilitas": "Listrik, Air, Dapur, Kamar mandi dalam, Kamar mandi luar, Lemari, Kasur, Meja belajar, Kulkas, AC, WIFI",
  "Peraturan": "Jam malam, Tamu menginap",
  "Harga": "13.000.000/tahun (yang pake ac dn kamar mandi dlm)  7.890.000/tahun(km dalem non ac) 6.690.000/tahun (km luar non ac)",
  "Narahubung": "https://6282006941869 (Mba Silmi)",
  "ac_status": "keduanya"
}
```

**CLEAN:**
```json
{
  "id": "1",
  "nama": "Wisma Azima",
  "jenis_kos": "Putri",
  "alamat": "CVV5+QX4, Jl. Antariksa II, Jebres...",
  "plus_code": "",
  "lat": -7.5556175,
  "lon": 110.859961,
  "ac_status": "keduanya",
  "tipe_pembayaran": ["tahunan"],
  "harga": [
    { "min": 13000000, "max": 13000000, "periode": "tahunan", "tipe_kamar": "AC, kamar mandi dalam", "catatan": null },
    { "min": 7890000, "max": 7890000, "periode": "tahunan", "tipe_kamar": "non-AC, kamar mandi dalam", "catatan": null },
    { "min": 6690000, "max": 6690000, "periode": "tahunan", "tipe_kamar": "non-AC, kamar mandi luar", "catatan": null }
  ],
  "fasilitas": {
    "dalam_kamar": ["ac", "lemari", "kasur", "meja_belajar", "kamar_mandi_dalam"],
    "bersama": ["wifi", "kulkas", "dapur"],
    "utilitas": ["listrik", "air"],
    "catatan": "kamar mandi luar juga tersedia"
  },
  "peraturan": {
    "jam_malam": null,
    "tamu_lawan_jenis": null,
    "tamu_menginap": true,
    "boleh_hewan": null,
    "lainnya": ["jam malam"]
  },
  "kontak": [
    { "nama": "Mba Silmi", "nomor_wa": "6282006941869", "url_wa": "https://wa.me/6282006941869" }
  ]
}
```

### Kasus Multi Periode (Kost Orange No.4)

Harga: `"1,950/3 bulan\n3,9jt/ semester (6bulan)\n7,4jt/tahun"`

```json
{
  "harga": [
    { "min": 1950000, "max": 1950000, "periode": "per3bulan", "tipe_kamar": null, "catatan": null },
    { "min": 3900000, "max": 3900000, "periode": "semesteran", "tipe_kamar": null, "catatan": null },
    { "min": 7400000, "max": 7400000, "periode": "tahunan", "tipe_kamar": null, "catatan": null }
  ]
}
```

---

## 4. Strategi Parsing LLM

### 4.1 Pipeline

```
data_kost_geo.json  >  [LLM Parser Script]  >  data_kost_clean.json  >  [Import ke DB]  >  Admin UI
```

### 4.2 Prompt Design

Tiap kos entry dikirim ke LLM dengan prompt:
- Input: raw JSON satu entry
- Output: JSON terstruktur sesuai `KosClean`
- Rules eksplisit untuk normalisasi fasilitas, parsing harga, ekstraksi kontak

### 4.3 Edge Cases

- Harga "-" => `harga: []`
- Harga range ("450.000-600.000/bulan") => min=450000, max=600000
- Harga "3,3jt" => parse: "jt"=x1.000.000, "rb"=x1.000, koma=desimal
- Peraturan kosong ("-", ".", "") => semua field null, `lainnya: []`
- Kontak kosong ("-") => `kontak: []`
- Multiple kontak => array multi-entry
- Fasilitas noise => taro di `catatan`
- lat/long kosong => skip entry

### 4.4 LLM Tooling

Script Python (`src/clean_kos_data.py`):
1. Baca `data_kost_geo.json`
2. Loop per entry, kirim ke LLM API dengan prompt terstruktur
3. Validasi output (schema conformity)
4. Tulis ke `data_kost_clean.json`
5. Log parsing errors untuk review manual

---

## 5. Rencana UI Admin — Filter & View

### 5.1 Sidebar Filter

```
Search: [........................]

Jenis Kos:           AC Status:
[ ] Putri (120)      [ ] AC
[ ] Putra (35)       [ ] Non-AC
[ ] Campuran (3)     [ ] Keduanya

Periode Bayar:       Peraturan:
[ ] Bulanan          [ ] Ada jam malam
[ ] Semesteran       [ ] Tamu lawan jenis bebas
[ ] Tahunan          [ ] Tamu menginap diizinkan
[ ] Per3Bulan        [ ] Hewan diizinkan

Rentang Harga:
[Rp 300rb] ----o---- [Rp 2.5jt]

Fasilitas:
[ ] AC       [ ] WIFI      [ ] KM Dalam
[ ] Kipas    [ ] Kulkas    [ ] Dapur
[ ] TV       [ ] Mesin Cuci [ ] CCTV
[ ] Lemari   [ ] Parkir    [ ] Jemuran
[ ] Meja      [ ] Musholla

[Reset Filters]
```

### 5.2 Filter Logic

| Filter | Query |
|--------|-------|
| Harga min/max | `harga.some(h => h.min <= max && h.max >= min)` |
| Periode | `harga.some(h => h.periode === 'bulanan')` |
| Kamar AC | `harga.some(h => h.tipe_kamar?.includes('AC'))` |
| KM Dalam | `harga.some(h => h.tipe_kamar?.includes('kamar mandi dalam'))` |
| Fasilitas AC | `fasilitas.dalam_kamar.includes('ac')` |
| Fasilitas WIFI | `fasilitas.bersama.includes('wifi')` |
| Jam malam | `peraturan.jam_malam !== null && peraturan.jam_malam !== 'tidak ada'` |
| Tamu menginap | `peraturan.tamu_menginap === true` |

### 5.3 Detail Modal (Update)

Harga ditampilkan grouped by `tipe_kamar`:

```
Kost H&R                                    [Putri] [Non-AC]

Alamat: Belakang UNS, Jl. Sawah Karang...

Harga:
  Standar                       Rp 6.500.000 / tahun

Fasilitas:
  [Listrik] [Air] [WiFi] [Kulkas] [Dapur]
  [Lemari] [Kasur] [KM Dalam]

Peraturan:
  Jam malam: -          Tamu lawan jenis: terbatas
  Tamu menginap: Ya      Hewan: -

Kontak:
  Renata - 088228647100
```

---

## 6. UX/UI Parse & Review Flow (Dashboard Admin)

### 6.1 Konsep

Parsing LLM dilakukan **di dalam dashboard admin**, bukan via script offline. Tujuannya:
- Admin bisa lihat hasil parsing langsung
- Bandingkan raw vs clean side-by-side
- Edit/koreksi hasil yang salah
- Kirim ulang (re-parse) dengan prompt yang disesuaikan
- Parsing bisa berjalan sebagai background task

### 6.2 Halaman: `/actions/parse` — 4 Step Wizard

Halaman tunggal dengan 4 langkah berurutan. State tersimpan di React state, tidak perlu multi-page.

#### Step 1: Load Data Source

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Kos    LLM Data Cleaning                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Source Data:                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ● Load from file (data_kost_geo.json)  158 entri  │  │
│  │ ○ Load from database (kos table)       142 entri   │  │
│  │ ○ Paste JSON manually                             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [Load & Preview]                                        │
│                                                          │
│  ┌─ Preview Table ─────────────────────────────────────┐ │
│  │ #  │ Nama               │ Harga (raw)         │ ... │ │
│  │ 1  │ Wisma Azima        │ 13.000.000/tahun... │     │ │
│  │ 2  │ Kos Bu Isyana...   │ 4.000.000/tahun     │     │ │
│  │ ...                                                  │ │
│  │                              158 entries loaded      │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  [Parse All 158]   [Parse Selected (0)]                  │
└──────────────────────────────────────────────────────────┘
```

#### Step 2: Parse Progress

Setelah klik "Parse All", tabel update dengan status column + progress bar:

```
┌──────────────────────────────────────────────────────────┐
│  ████████████░░░░░░░░  87/158 parsed   ⚠ 2 errors       │
│                                                          │
│  ┌─ Parse Status Table ─────────────────────────────────┐│
│  │ ☐ │ # │ Status    │ Nama             │ Preview      ││
│  │ ☐ │ 1 │ ✓ Done   │ Wisma Azima      │ [+] lihat    ││
│  │ ☐ │ 2 │ ✓ Done   │ Kos Bu Isyana    │ [+] lihat    ││
│  │ ☐ │ 3 │ ⬡ Parsing│ Kos H&R          │ ...          ││
│  │ ☐ │ 4 │ ⚠ Error  │ Kost Orange      │ retry        ││
│  │ ☐ │ 5 │ ⬜ Queue  │ Griya Cendekia   │ -            ││
│  └───────────────────────────────────────────────────────┘│
│                                                          │
│  [Retry Failed (2)]  [Stop Parsing]                      │
└──────────────────────────────────────────────────────────┘
```

#### Step 3: Review — Side-by-Side Diff View

Klik entry → halaman/modal dengan split view raw vs clean.

Layout 3 panel:

```
┌──────────────────────────────────────────────────────────┐
│  ← Back    Review #1: Wisma Azima    [Approve] [Reject]  │
├──────────────────────────────────────┬───────────────────┤
│  Panel Kiri: Entry List             │ Panel Kanan:      │
│  (scrollable, pilih entry)          │ Diff + Edit       │
│                                     │                   │
│  #1  ✓ Wisma Azima        <-aktif  │  ┌ Raw ─────────┐ │
│  #2  ✓ Kos Bu Isyana               │  │ {"No":"1",   │ │
│  #3  ✓ Kos H&R                     │  │ "Harga":...} │ │
│  #4  ⚠ Kost Orange                 │  └──────────────┘ │
│  #5  ✓ Griya Cendekia              │                   │
│  ...                                │  ┌ Cleaned ────┐ │
│                                     │  │ {"id":"1",  │ │
│                                     │  │ harga:[...]}│ │
│                                     │  └──────────────┘ │
│                                     ├───────────────────┤
│                                     │ Human Readable:   │
│                                     │                   │
│                                     │ Harga:            │
│                                     │ AC+KM Dlm 13jt/th │
│                                     │ NonAC+KM Dlm 7.8jt│
│                                     │ NonAC+KM Lr 6.6jt│
│                                     │                   │
│                                     │ Fasilitas:        │
│                                     │ [AC][WiFi][KM Dlm]│
│                                     │                   │
│                                     │ Peraturan:        │
│                                     │ ☑ Tamu menginap   │
│                                     │                   │
│                                     │ Kontak:           │
│                                     │ Mba Silmi-628200..│
│                                     │                   │
│                                     │ [Edit Fields]     │
└──────────────────────────────────────┴───────────────────┘
```

#### Step 4: Save/Export

```
┌──────────────────────────────────────────────────────────┐
│  Summary: 156 approved, 2 rejected, 0 pending            │
│                                                          │
│  ┌─ Save Options ─────────────────────────────────────┐  │
│  │                                                    │  │
│  │  [Save to clean JSON]  →  data_kost_clean.json     │  │
│  │  [Import to Database]  →  overwrite kos table      │  │
│  │  [Export as JSON]      →  download file            │  │
│  │                                                    │  │
│  │  ⚠ Import to DB akan overwrite data existing.      │  │
│  │  ☐ Dry-run (preview only, no actual write)         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [Execute]    [Cancel]                                   │
└──────────────────────────────────────────────────────────┘
```

### 6.3 Component Tree

```
/actions/parse/page.tsx              ← orchestrator, global state
  ├── SourceSelectorStep             ← Step 1
  │   ├── SourceRadioGroup           ← file / DB / paste
  │   └── PreviewTable               ← raw entries preview
  ├── ParseProgressStep              ← Step 2
  │   ├── ProgressBar                ← animated progress
  │   ├── EntryStatusTable           ← table with parse status
  │   └── ParseControls              ← retry/stop buttons
  ├── ReviewPanelStep                ← Step 3 (core)
  │   ├── EntryListSidebar           ← left: scrollable entry list
  │   ├── JsonDiffView               ← raw vs clean JSON split
  │   ├── HumanReadableEditor        ← bottom: editable fields
  │   │   ├── HargaCardEditor        ← add/edit/remove harga items
  │   │   ├── FasilitasChipEditor    ← chip grid with add/remove
  │   │   ├── PeraturanToggleEditor  ← boolean toggles + text
  │   │   └── KontakListEditor       ← add/edit/remove contacts
  │   └── ReviewActions              ← approve/reject/edit nav
  └── SaveStep                       ← Step 4
      ├── SummaryBar                 ← approved/rejected counts
      ├── SaveOptions                ← file / DB / export radios
      └── DryRunPreview              ← optional dry-run output
```

### 6.4 Per-Entry State Shape

```ts
type ParseStatus = 'idle' | 'queued' | 'parsing' | 'done' | 'error';
type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface ParseEntryState {
  index: number;                   // index dalam source array
  raw: RawKosEntry;                // data mentah asli
  clean: KosClean | null;          // hasil parsing (null sebelum diparse)
  parseStatus: ParseStatus;
  parseError: string | null;       // error message kalo gagal
  reviewStatus: ReviewStatus;
  edits: Partial<KosClean> | null; // overlay manual edit (deep merge)
  promptOverride: string | null;   // custom prompt untuk re-parse
}
```

### 6.5 Navigasi & Integrasi

Entry point dari halaman kos list:

```
Header Admin:
  [Kos]  [Master UNS]  [🧹 Parse & Clean]  [Import]  [Logout]
```

Tombol di `/kos` page header:

```
  [+ Tambah Kos]  [Bulk Import]  [🧹 Clean Data]  [Logout]
```

---

## 7. Re-Parse dengan Custom Prompt & Background Task

### 7.1 Masalah

Parsing LLM tidak selalu sempurna di percobaan pertama. Admin perlu:
- Kirim ulang parsing dengan prompt yang disesuaikan
- Tidak harus menunggu — bisa lanjut kerja sambil parsing di background

### 7.2 Re-Parse Flow

```
Admin lihat hasil parsing → Ada field yang salah
  → Klik "Re-parse with Prompt"
  → Textarea muncul berisi prompt tambahan
    Contoh: "Hati-hati parsing KM luar, pastikan masuk ke dalam_kamar"
  → Klik "Re-parse"
  → Entry masuk queue parsing ulang
  → Progress bar update, hasil baru muncul di review
```

### 7.3 Background Task — Job Queue

Arsitektur: simple in-memory job queue via polling. Tidak perlu Redis/worker untuk MVP.

```
┌──────────────┐     POST /api/actions/parse/bulk     ┌───────────────┐
│              │  ─────────────────────────────────>   │               │
│   Admin UI   │     { entries: [...], job_id: null }  │   Backend     │
│   (React)    │  <─────────────────────────────────   │   (FastAPI)   │
│              │     { job_id: "abc123", total: 158 }   │               │
└──────┬───────┘                                       └───────┬───────┘
       │                                                       │
       │  GET /api/actions/parse/jobs/abc123                   │
       │  ─────────────────────────────────>                   │
       │  { job_id, status: "running",                         │
       │    completed: 87, failed: 2, total: 158,              │
       │    results: [...]    // sudah selesai sejauh ini       │
       │  }                                                    │
       │  <─────────────────────────────────                   │
       │                                                       │
       │  Poll tiap 2 detik sampai status: "done"              │
       │                                                       │
```

### 7.4 Job Queue Implementation

```ts
// Backend state (in-memory, per worker process)
interface ParseJob {
  job_id: string;
  status: 'pending' | 'running' | 'done' | 'cancelled';
  total: number;
  completed: number;
  failed: number;
  entries: RawKosEntry[];
  results: Array<{ index: number; clean: KosClean; error: string | null }>;
  created_at: number;
  prompt_overrides?: Record<number, string>;  // custom prompt per index
}
```

**API Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/actions/parse/bulk` | Create job, return `job_id`. Body: `{ entries, prompt_overrides? }` |
| GET | `/api/actions/parse/jobs/:id` | Poll job status + partial results |
| POST | `/api/actions/parse/jobs/:id/cancel` | Cancel running job |
| POST | `/api/actions/parse/entry` | Parse single entry (sync, langsung return) |

### 7.5 UX untuk Background Task

```
┌─ Background Tasks Indicator ─────────────────────────────┐
│  🔄 1 job running: "Parse Kos Data" (87/158)            │
│  ✅ 1 job completed: "Re-parse Kost Orange"             │
│  [View All Jobs]                                        │
└──────────────────────────────────────────────────────────┘
```

- Job progress ditampilkan di navbar atau sidebar persistent
- Admin bisa navigasi bebas (ke `/kos`, `/master-uns`, dll) tanpa kehilangan job
- Kalo page `/actions/parse` dibuka lagi, auto-reconnect ke job yang running
- Notifikasi toast ketika job selesai

### 7.6 Prompt Management

Prompt sistem yang digunakan untuk parsing:

```
Kamu adalah data cleaner untuk data kos. Bersihkan raw JSON menjadi
struktur JSON yang terstandarisasi. Rules:

1. HARGA: Parse jadi array objek dengan min, max (number), periode,
   tipe_kamar (string|null), catatan (string|null).
   - "jt" = kali 1.000.000, "rb" = kali 1.000
   - Koma sebagai pemisah desimal
   - "450.000-600.000/bulan" => min=450000, max=600000
   - Parentheses "(AC, km dalam)" => jadi tipe_kamar

2. FASILITAS: Kategorikan jadi dalam_kamar, bersama, utilitas
   - Normalisasi key: lihat tabel mapping
   - Teks yang tidak bisa dikategorikan => catatan

3. PERATURAN: Ekstrak boolean flags + string array
   - jam_malam: ekstrak waktu atau "tidak ada"
   - tamu_lawan_jenis: "dilarang"/"terbatas"/"bebas"
   - tamu_menginap: boolean
   - boleh_hewan: boolean
   - Sisanya => lainnya[]

4. KONTAK: Ekstrak nomor WA + nama dari string narahubung
   - Format nomor: 628xxx
   - Multiple kontak => array

Output: JSON valid sesuai schema, TANPA markdown, TANPA komentar.
```

Admin bisa override prompt ini via textarea di UI:

```
┌─ Custom Prompt Override (optional) ───────────────────┐
│                                                        │
│  [ ] Use default prompt                                │
│  [●] Append custom instructions:                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Tolong lebih teliti untuk kos dengan multiple    │  │
│  │ tipe kamar. Pastikan "kamar mandi luar" masuk    │  │
│  │ ke dalam_kamar, bukan di catatan.                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Prompt overrides bisa per-entry atau global.          │
└────────────────────────────────────────────────────────┘
```

Prompt custom disimpan per entry di `ParseEntryState.promptOverride`. Kalo null, pakai default.

---

## 8. Integrasi ke Frontend

### 8.1 Arsitektur Data Flow

```
                                    ┌──────────────────┐
                                    │   Frontend App    │
                                    │  (Next.js :3000)  │
                                    │                   │
                                    │  Map.tsx          │
                                    │  fetch("/api/kos")│
                                    └────────┬──────────┘
                                             │
                                    ┌────────▼──────────┐
                                    │  /api/kos route.ts │
                                    │  (frontend proxy)  │
                                    └────────┬──────────┘
                                             │ proxy
┌──────────────────┐              ┌────────▼──────────┐
│  Admin App       │              │   Backend API      │
│  (Next.js :3001) │              │  (FastAPI :8000)   │
│                  │              │                    │
│  Save clean →    │──import──→   │  /api/kos (GET)    │
│  to DB           │              │  /api/admin/kos/*  │
└──────────────────┘              └────────────────────┘
```

### 8.2 Strategi

Clean data hasil parsing disimpan ke **backend database** (via admin API). Frontend mengonsumsi dari backend yang sama.

**Kenapa DB, bukan JSON file:**
- Backend sudah ada, API `/api/kos` sudah dipakai frontend
- Admin bisa edit/update data via dashboard
- Filtering server-side lebih efisien (nanti bisa ditambah query params)
- Satu source of truth

### 8.3 Update Frontend Type

File `frontend/components/Map.tsx` perlu update interface `Kos` dan `RawKos`:

```ts
// Sebelum (flat string fields)
type Kos = {
  nama: string;
  harga: string;        // free text
  fasilitas: string;    // comma-separated
  peraturan: string;    // free text
  narahubung: string;   // raw
  // ...
};

// Sesudah (structured)
type KosClean = {
  nama: string;
  harga: HargaItem[];           // array objek
  fasilitas: FasilitasCleaned;  // kategorisasi
  peraturan: PeraturanCleaned;  // boolean + array
  kontak: KontakItem[];         // array objek
  // ...
};
```

### 8.4 Frontend Map Popup Update

Popup di `Map.tsx` harus dirender dari data clean:

**Harga** — dari `harga[]`, grouped by `tipe_kamar`:
```tsx
{harga.map((h) => (
  <div key={...}>
    {h.tipe_kamar && <span>{h.tipe_kamar}</span>}
    <span>Rp {h.min.toLocaleString()} / {h.periode}</span>
    {h.catatan && <small>{h.catatan}</small>}
  </div>
))}
```

**Fasilitas** — dari `fasilitas.dalam_kamar[]` + `fasilitas.bersama[]`:
```tsx
{fasilitas.dalam_kamar.map(f => <Chip label={f} />)}
{fasilitas.bersama.map(f => <Chip label={f} />)}
```

**Peraturan** — dari flags:
```tsx
{peraturan.jam_malam && <Chip icon="⏰" label={peraturan.jam_malam} />}
{peraturan.tamu_menginap && <Chip icon="🛏" label="Tamu menginap" />}
```

**Kontak** — dari array:
```tsx
{kontak.map(k => (
  <a href={k.url_wa} target="_blank">
    {k.nama} — {k.nomor_wa}
  </a>
))}
```

### 8.5 Backward Compatibility

Selama transisi, frontend harus bisa handle **kedua** format (raw string & clean structure). Strategy:

```ts
// Helper: detect format
function isCleanData(item: any): boolean {
  return Array.isArray(item.harga);  // clean = harga is array
}

// Fallback render
if (isCleanData(kos)) {
  renderCleanHarga(kos.harga);
} else {
  renderRawHarga(kos.harga); // old free-text
}
```

Field yang berubah dari string ke objek: `harga`, `fasilitas`, `peraturan`, `narahubung` → `kontak`.

---

## 9. Penanda Cleaned vs Uncleaned Data

### 9.1 Konsep

Data kos harus punya status yang menunjukkan sudah/belum dibersihkan. Status ini dipakai di admin dashboard (badge + filter) dan bisa juga dipakai frontend (misal hide yang masih raw).

### 9.2 Status Levels

```
┌────────┐    Parse     ┌──────────┐    Review    ┌──────────┐
│  Raw   │─────────────→│  Parsed  │─────────────→│ Reviewed │
│ (default)│             │ (LLM done)│             │ (approved)│
└────────┘              └──────────┘              └──────────┘
     │                                                 │
     │                    ┌──────────┐                 │
     └──────────────────→│  Rejected │←────────────────┘
                          │ (skip)   │
                          └──────────┘
```

```ts
type DataStatus = 'raw' | 'parsed' | 'reviewed' | 'rejected';
```

- **raw**: Data mentah, belum pernah diparse
- **parsed**: Sudah diparse LLM, tapi belum direview/di-approve admin
- **reviewed**: Sudah direview dan di-approve admin (data dianggap clean)
- **rejected**: Diparse tapi ditolak — entry ini tidak akan ditampilkan di frontend

### 9.3 Implementasi — DB Field & File Approach

**Di Database (kos table — backend FastAPI):**

Tambahkan kolom:

```sql
ALTER TABLE kos ADD COLUMN data_status TEXT DEFAULT 'raw';
ALTER TABLE kos ADD COLUMN parsed_data JSONB;      -- clean data jika sudah diparse
ALTER TABLE kos ADD COLUMN last_parsed_at TIMESTAMP;
ALTER TABLE kos ADD COLUMN reviewed_at TIMESTAMP;
ALTER TABLE kos ADD COLUMN reviewed_by TEXT;
```

Schema backend:
- `data_status` = menandakan status data
- `parsed_data` = menyimpan hasil parsing clean sebagai JSON (bisa null jika belum diparse)
- Kolom existing (`nama`, `harga`, dll) tetap ada sebagai raw data
- Ketika ditampilkan di frontend, query decide: ambil dari `parsed_data` (jika reviewed) atau dari kolom raw (jika masih raw)

**Di JSON File (static backup):**

```
public/data/
  data_kost_geo.json          ← raw data (sekarang existing)
  data_kost_clean.json        ← clean output (target baru)
  data_kost_clean_v2.json     ← revisi berikutnya (versioned)
```

File JSON dipakai sebagai backup/export, bukan sebagai primary source.

### 9.4 Admin UI — Status Badge

Di tabel list `/kos`:

```
┌──────┬─────────────────────┬─────────┬──────────┬───────┐
│ ☐    │ Nama                │ Jenis   │ Status   │ ...   │
├──────┼─────────────────────┼─────────┼──────────┼───────┤
│ ☐    │ Wisma Azima         │ Putri   │ Reviewed │       │
│ ☐    │ Kos Bu Isyana       │ Putri   │ Parsed   │       │
│ ☐    │ Griya Cendekia Muda │ Putri   │ Raw      │       │
│ ☐    │ Kost Orange         │ Putri   │ Rejected │       │
└──────┴─────────────────────┴─────────┴──────────┴───────┘
```

Badge style:
```css
.raw { bg: #F1F5F9, text: #64748B, label: "Raw" }
.parsed { bg: #FEF3C7, text: #92400E, label: "Parsed" }
.reviewed { bg: #DCFCE7, text: #166534, label: "Reviewed" }
.rejected { bg: #FEE2E2, text: #991B1B, label: "Rejected" }
```

### 9.5 Filter by Status

Di sidebar filter admin (nambah section):

```
Data Status:
  [ ] Raw (15)
  [ ] Parsed (12)
  [ ] Reviewed (130)
  [ ] Rejected (1)
```

### 9.6 Frontend Behavior

Frontend hanya menampilkan kos dengan `data_status: 'reviewed'`:

```ts
// Di backend /api/kos endpoint
// Query: SELECT * FROM kos WHERE data_status = 'reviewed'
// ATAU: fallback ke raw data jika belum ada reviewed
```

Transitional period: frontend bisa pilih:
- **Strict mode**: Hanya reviewed (filter out yang belum clean)
- **Fallback mode**: Prioritaskan reviewed, tapi fallback ke raw jika kosong (menghindari empty result)

Rekomendasi: start dengan fallback mode, switch ke strict setelah semua data selesai dibersihkan.

### 9.7 State Diagram Detail

```
ENTRY LIFECYCLE:

  [Data masuk via import] ──→ data_status: "raw"
       │
       ▼
  [Diparse LLM] ──→ data_status: "parsed"
       │              parsed_data: { clean JSON }
       ├── [Admin approve] ──→ data_status: "reviewed"
       │                        reviewed_at: now, reviewed_by: user
       │
       ├── [Admin reject]  ──→ data_status: "rejected"
       │                        (tidak muncul di frontend)
       │
       ├── [Re-parse]      ──→ data_status: "parsed"
       │                        parsed_data: overwrite with new
       │
       └── [Edit manual]   ──→ data_status: "reviewed"
                                parsed_data: apply manual edits
```

---

## 10. Parsing Engine — Implementation Spec (`parse_engine.py`)

### 10.1 File: `backend/app/parse_engine.py`

Module Python yang bertanggung jawab untuk parsing satu entry raw → clean via LLM.

### 10.2 Dependencies (tambah ke `pyproject.toml`)

```toml
"openai>=1.0,<2.0",   # OpenAI-compatible client
```

### 10.3 Environment Variables (tambah ke `.env`)

```bash
# LLM API Configuration (OpenAI-compatible)
LLM_API_KEY=your_api_key_here
LLM_API_BASE=https://api.openai.com/v1    # or openrouter, together, etc.
LLM_MODEL=gpt-4o                          # or gpt-4-turbo, deepseek-chat, etc.
LLM_MAX_TOKENS=4096
LLM_TEMPERATURE=0.1                       # low temp for deterministic output
```

### 10.4 Config Loader

```python
# backend/app/config.py — tambahkan:
class Settings(BaseSettings):
    # ... existing fields ...
    llm_api_key: str = Field(alias="LLM_API_KEY", default="")
    llm_api_base: str = Field(alias="LLM_API_BASE", default="https://api.openai.com/v1")
    llm_model: str = Field(alias="LLM_MODEL", default="gpt-4o")
    llm_max_tokens: int = Field(alias="LLM_MAX_TOKENS", default=4096)
    llm_temperature: float = Field(alias="LLM_TEMPERATURE", default=0.1)
```

### 10.5 Core Function Signature

```python
# backend/app/parse_engine.py

from openai import AsyncOpenAI
import json
from app.config import load_config

async def parse_single_entry(
    raw_entry: dict,
    custom_prompt: str | None = None,
) -> dict:
    """
    Parse satu raw kos entry → KosClean dict via LLM.

    Args:
        raw_entry: dict dengan field-field raw (No, Nama kos, Harga, ...)
        custom_prompt: instruksi tambahan untuk override prompt default

    Returns:
        dict sesuai struktur KosClean

    Raises:
        ValueError: jika LLM response tidak valid
        RuntimeError: jika LLM API error
    """
    ...
```

### 10.6 Full System Prompt

Prompt ini adalah kunci akurasi. Harus eksplisit dengan contoh.

```
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
```

### 10.7 Validation & Retry Logic

```python
from pydantic import BaseModel, ValidationError

class ParsedKosClean(BaseModel):
    """Schema untuk validasi output LLM."""
    id: str
    nama: str
    jenis_kos: Literal["Putri", "Putra", "Campuran"]
    alamat: str
    plus_code: str
    lat: float
    lon: float
    ac_status: Literal["ac", "non_ac", "keduanya"]
    tipe_pembayaran: list[str]
    harga: list[HargaItemModel]
    fasilitas: FasilitasModel
    peraturan: PeraturanModel
    kontak: list[KontakItemModel]

async def parse_with_retry(
    raw_entry: dict,
    custom_prompt: str | None = None,
    max_retries: int = 2,
) -> dict:
    """
    Parse dengan retry jika validasi gagal.
    Retry dengan prompt diperbaiki oleh LLM.
    """
    for attempt in range(max_retries + 1):
        raw_response = await call_llm(raw_entry, custom_prompt)
        try:
            parsed = json.loads(raw_response)
            validated = ParsedKosClean.model_validate(parsed)
            return validated.model_dump()
        except (json.JSONDecodeError, ValidationError) as e:
            if attempt == max_retries:
                raise ValueError(f"LLM response invalid after {max_retries} retries: {e}")
            # Retry with error feedback in prompt
            custom_prompt = (custom_prompt or "") + f"\nPrevious error: {e}. Fix it."
    raise RuntimeError("Unreachable")
```

### 10.8 LLM Call Implementation

```python
async def call_llm(raw_entry: dict, custom_prompt: str | None = None) -> str:
    config = load_config()
    client = AsyncOpenAI(api_key=config.llm_api_key, base_url=config.llm_api_base)

    system_prompt = SYSTEM_PROMPT  # prompt lengkap dari section 10.6
    if custom_prompt:
        system_prompt += f"\n\nINSTRUKSI TAMBAHAN DARI ADMIN:\n{custom_prompt}"

    user_message = f"Parse this raw JSON:\n{json.dumps(raw_entry, indent=2)}"

    response = await client.chat.completions.create(
        model=config.llm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=config.llm_temperature,
        max_tokens=config.llm_max_tokens,
    )
    return response.choices[0].message.content.strip()
```

---

## 11. LLM Configuration Panel (Admin Dashboard)

### 11.1 Konsep

Admin harus bisa mengonfigurasi koneksi LLM langsung dari dashboard, tanpa perlu edit file `.env` manual. Konfigurasi termasuk **Test Connection** button untuk verifikasi sebelum parsing.

### 11.2 Lokasi

Panel ini ada di **Step 0** halaman `/actions/parse` — ditampilkan sebagai collapsible section di atas wizard. Atau sebagai tab terpisah "Settings" di sidebar.

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Kos    LLM Data Cleaning                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ⚙️ LLM Configuration                        [Expand ▼]  │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  API Base URL:                                     │  │
│  │  ┌────────────────────────────────────────────────┐│  │
│  │  │ https://api.openai.com/v1                     ││  │
│  │  └────────────────────────────────────────────────┘│  │
│  │                                                    │  │
│  │  API Key:                                          │  │
│  │  ┌────────────────────────────────────────────────┐│  │
│  │  │ sk-••••••••••••••••••••••••••••••••          ││  │
│  │  └────────────────────────────────────────────────┘│  │
│  │  [👁 Show]                                         │  │
│  │                                                    │  │
│  │  Model:                                            │  │
│  │  ┌────────────────────────────────────────────────┐│  │
│  │  │ gpt-4o                                  ▼      ││  │
│  │  └────────────────────────────────────────────────┘│  │
│  │  (atau select dengan preset: OpenAI, OpenRouter,   │  │
│  │   DeepSeek, Together AI, custom)                   │  │
│  │                                                    │  │
│  │  Max Tokens:      Temperature:                     │  │
│  │  [ 4096      ]    [ 0.1        ]                   │  │
│  │                                                    │  │
│  │  [🧪 Test Connection]                              │  │
│  │                                                    │  │
│  │  ┌─ Test Result ─────────────────────────────────┐ │  │
│  │  │ ✅ Connected successfully!                     │ │  │
│  │  │    Model: gpt-4o                               │ │  │
│  │  │    Latency: 340ms                              │ │  │
│  │  │    Tokens: prompt=12, completion=8             │ │  │
│  │  └───────────────────────────────────────────────┘ │  │
│  │                                                    │  │
│  │  [Save Configuration]                              │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ─── Step 1: Load Data Source ───                        │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘
```

### 11.3 Component State

```ts
interface LlmConfig {
  api_base: string;      // default: "https://api.openai.com/v1"
  api_key: string;        // masked saat ditampilkan
  model: string;          // default: "gpt-4o"
  max_tokens: number;     // default: 4096
  temperature: number;    // default: 0.1
}

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message: string;
  latency_ms: number | null;
  model: string | null;
}
```

### 11.4 Model Presets

Dropdown untuk memilih preset memudahkan admin:

```ts
const MODEL_PRESETS = [
  { label: 'OpenAI GPT-4o', base: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { label: 'OpenAI GPT-4.1', base: 'https://api.openai.com/v1', model: 'gpt-4.1' },
  { label: 'OpenRouter (any)', base: 'https://openrouter.ai/api/v1', model: '' },
  { label: 'DeepSeek V3', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'Groq LLaMA 3', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b' },
  { label: 'Custom...', base: '', model: '' },
];
```

Saat preset dipilih, `api_base` dan `model` terisi otomatis. Admin tinggal isi `api_key`.

### 11.5 API Endpoints

**Backend: `/api/admin/actions/llm/test`**

Menerima config LLM, kirim request test kecil, return hasil:

```
POST /api/admin/actions/llm/test
Body: { api_base, api_key, model, max_tokens, temperature }

Response 200:
{
  "status": "ok",
  "model": "gpt-4o",
  "latency_ms": 340,
  "usage": { "prompt_tokens": 12, "completion_tokens": 8 }
}

Response 4xx/5xx:
{
  "status": "error",
  "error": "Invalid API key",
  "latency_ms": 520
}
```

**Backend: `/api/admin/actions/llm/config`**

GET/POST untuk read/write LLM config (opsional — bisa juga disimpan di client localStorage atau backend env).

Kalau disimpan di backend, tambah field `llm_config` di model. Atau simpel: override per-request (yang dikirim dari UI langsung).

### 11.6 Test Connection Implementation

```python
# backend/app/routers/admin_actions.py — tambahan:

from pydantic import BaseModel

class LlmTestRequest(BaseModel):
    api_base: str
    api_key: str
    model: str
    max_tokens: int = 4096
    temperature: float = 0.1

@router.post("/llm/test")
async def test_llm_connection(req: LlmTestRequest, _username=Depends(require_auth)):
    """
    Test LLM connection with given config.
    Sends a simple "Say hello" prompt and returns latency + model info.
    """
    import time
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=req.api_key, base_url=req.api_base)

    start = time.monotonic()
    try:
        response = await client.chat.completions.create(
            model=req.model,
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
        # Extract meaningful error from OpenAI exception
        if hasattr(e, 'body') and e.body:
            error_msg = e.body.get('message', error_msg)
        return {
            "status": "error",
            "error": error_msg,
            "latency_ms": latency_ms,
        }
```

### 11.7 LLM Config Persistence

Untuk menyimpan konfigurasi LLM agar tidak perlu diisi ulang tiap kali:

**Opsi A: localStorage (client-side, simpel)**
```ts
// Simpan di browser admin
localStorage.setItem('llm_config', JSON.stringify(config));
// Load saat page mount
const saved = localStorage.getItem('llm_config');
```

**Opsi B: Backend (shared, lebih aman)**
```python
# Simpan di env/DB backend
# GET /api/admin/actions/llm/config → return current config (masked api_key)
# POST /api/admin/actions/llm/config → save new config
```

Rekomendasi: **Opsi A untuk MVP** (tidak perlu backend persistence). API key tetap aman karena hanya disimpan di localStorage browser admin, dikirim via HTTPS ke backend hanya saat parse/test.

### 11.8 UI Flow

```
Admin buka /actions/parse
  → Expand "LLM Configuration" panel
  → Pilih preset (OpenAI / OpenRouter / Custom)
  → Isi API key
  → Klik "Test Connection"
  → Lihat hasil: ✅ sukses atau ❌ error (invalid key, timeout, wrong URL)
  → Jika sukses, klik "Save Configuration"
  → Config tersimpan di localStorage
  → Lanjut ke Step 1: Load Data Source
  → Saat parse triggered (Step 2), config dikirim bersama request
```

---

## 12. Background Job Queue — Implementation Spec

### 12.1 File: `backend/app/job_queue.py`

In-memory job queue untuk batch parsing. Tidak perlu Redis.

### 12.2 Data Structures

```python
import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from collections.abc import Callable, Awaitable

@dataclass
class Job:
    job_id: str
    status: str  # "pending" | "running" | "done" | "cancelled"
    total: int
    completed: int = 0
    failed: int = 0
    results: list[dict] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)
    created_at: str = ""
    prompt_overrides: dict[int, str] | None = None
    _task: asyncio.Task | None = None

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "total": self.total,
            "completed": self.completed,
            "failed": self.failed,
            "results": self.results,
            "errors": self.errors,
            "created_at": self.created_at,
        }

# In-memory store — hilang saat restart. Acceptable untuk MVP.
_jobs: dict[str, Job] = {}
_lock = asyncio.Lock()
```

### 12.3 Public API

```python
def create_job(
    entries: list[dict],
    prompt_overrides: dict[int, str] | None = None,
) -> Job:
    """Create new job, start processing in background. Returns job immediately."""
    job_id = uuid.uuid4().hex[:12]
    job = Job(
        job_id=job_id,
        status="pending",
        total=len(entries),
        prompt_overrides=prompt_overrides,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    _jobs[job_id] = job
    # Start background task
    job._task = asyncio.create_task(_run_job(job, entries))
    return job

async def get_job(job_id: str) -> Job | None:
    """Get job by ID."""
    return _jobs.get(job_id)

async def cancel_job(job_id: str) -> bool:
    """Cancel running job."""
    async with _lock:
        job = _jobs.get(job_id)
        if job and job.status in ("pending", "running"):
            if job._task:
                job._task.cancel()
            job.status = "cancelled"
            return True
    return False

def cleanup_old_jobs(max_age_seconds: int = 3600) -> None:
    """Remove completed/cancelled jobs older than max_age_seconds."""
    now = datetime.now(timezone.utc)
    to_remove = []
    for job_id, job in _jobs.items():
        if job.status in ("done", "cancelled"):
            created = datetime.fromisoformat(job.created_at)
            if (now - created).total_seconds() > max_age_seconds:
                to_remove.append(job_id)
    for job_id in to_remove:
        del _jobs[job_id]
```

### 12.4 Internal Job Runner

```python
from app.parse_engine import parse_single_entry

async def _run_job(job: Job, entries: list[dict]) -> None:
    """Process all entries sequentially in background."""
    job.status = "running"

    for idx, entry in enumerate(entries):
        async with _lock:
            if job.status == "cancelled":
                return

        try:
            custom = None
            if job.prompt_overrides and idx in job.prompt_overrides:
                custom = job.prompt_overrides[idx]

            result = await parse_single_entry(entry, custom_prompt=custom)

            async with _lock:
                job.results.append({
                    "index": idx,
                    "raw": entry,
                    "clean": result,
                    "error": None,
                })
                job.completed += 1
        except asyncio.CancelledError:
            async with _lock:
                job.status = "cancelled"
            return
        except Exception as e:
            async with _lock:
                job.errors.append({
                    "index": idx,
                    "raw": entry,
                    "error": str(e),
                })
                job.failed += 1

    async with _lock:
        job.status = "done"
```

### 12.5 API Routes Specification

File: `backend/app/routers/admin_actions.py` (replace existing stub)

```python
"""Admin action parsing endpoints with background job support."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import require_auth
from app.job_queue import create_job, get_job, cancel_job
from app.parse_engine import parse_single_entry

router = APIRouter(prefix="/api/admin/actions", tags=["admin-actions"])


class ParseEntryRequest(BaseModel):
    """Single entry parse request."""
    entry: dict
    custom_prompt: str | None = None


class ParseBulkRequest(BaseModel):
    """Bulk parse request — creates background job."""
    entries: list[dict]
    prompt_overrides: dict[int, str] | None = None  # index → prompt


@router.post("/parse/entry")
async def parse_entry(req: ParseEntryRequest, _username=Depends(require_auth)):
    """Parse single entry synchronously (blocking, return langsung)."""
    try:
        result = await parse_single_entry(req.entry, req.custom_prompt)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": str(e)})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/parse/bulk")
async def parse_bulk(req: ParseBulkRequest, _username=Depends(require_auth)):
    """Start background batch parse job. Returns job_id immediately."""
    if not req.entries:
        raise HTTPException(status_code=400, detail={"error": "No entries provided"})
    job = create_job(req.entries, req.prompt_overrides)
    return {
        "job_id": job.job_id,
        "status": job.status,
        "total": job.total,
    }


@router.get("/parse/jobs/{job_id}")
async def get_parse_job(job_id: str, _username=Depends(require_auth)):
    """Poll job status and partial results."""
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"error": "Job not found"})
    return job.to_dict()


@router.post("/parse/jobs/{job_id}/cancel")
async def cancel_parse_job(job_id: str, _username=Depends(require_auth)):
    """Cancel a running parse job."""
    ok = await cancel_job(job_id)
    if not ok:
        raise HTTPException(status_code=404, detail={"error": "Job not found or not running"})
    return {"status": "cancelled"}
```

### 12.6 Startup Cleanup

```python
# backend/app/main.py — tambahkan di lifespan:
import asyncio

async def cleanup_loop():
    """Periodic cleanup of old jobs every 10 minutes."""
    while True:
        await asyncio.sleep(600)
        from app.job_queue import cleanup_old_jobs
        cleanup_old_jobs()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    cleanup_task = asyncio.create_task(cleanup_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        await close_db()
```

### 12.7 Admin UI Polling Logic

```ts
// admin/app/actions/parse/page.tsx — polling hook

function useJobPoller(jobId: string | null) {
  const [job, setJob] = useState<JobState | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    const poll = async () => {
      const res = await fetch(`/api/actions/parse/jobs/${jobId}`);
      const data = await res.json();
      if (!cancelled) {
        setJob(data);
        if (data.status === 'running' || data.status === 'pending') {
          setTimeout(poll, 2000); // poll every 2s
        }
      }
    };
    poll();

    return () => { cancelled = true; };
  }, [jobId]);

  return job;
}
```

### 12.8 Background Task Indicator Component

Komponen kecil yang ditampilkan di navbar admin:

```tsx
// admin/components/BackgroundTaskIndicator.tsx

function BackgroundTaskIndicator() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  // Poll GET /api/actions/parse/jobs?active=true
  // Tampilkan chip kecil: "🔄 Parsing... 87/158" atau "✅ Done 158 entries"
  // Bisa diklik untuk kembali ke /actions/parse
}
```

Ditempatkan di `admin/app/layout.tsx` Nav component.

---

## 13. Rencana Eksekusi (Updated FINAL)

### Phase 1: Backend Core (Python)
1. **[ ] Tambah LLM dependency** — `openai` ke `pyproject.toml`
2. **[ ] Tambah LLM config** — `LLM_API_KEY`, `LLM_API_BASE`, `LLM_MODEL` ke config.py
3. **[ ] Bikin `backend/app/parse_engine.py`** — `parse_single_entry()`, `call_llm()`, `parse_with_retry()`, full system prompt
4. **[ ] Bikin `backend/app/job_queue.py`** — Job dataclass, `create_job()`, `get_job()`, `cancel_job()`, `_run_job()`
5. **[ ] Replace `backend/app/routers/admin_actions.py`** — endpoint parse/entry, parse/bulk, parse/jobs/:id, parse/jobs/:id/cancel
6. **[ ] Tambah cleanup loop** di `main.py` lifespan
7. **[ ] Test parse single entry** — kirim 1 raw entry, verify output clean

### Phase 2: Admin UI (Next.js)
8. **[ ] Bikin LLM Config panel** — API base URL, API key, model, preset dropdown, test connection
9. **[ ] Bikin backend endpoint `/api/actions/parse/llm/test`** — test LLM connection
10. **[ ] Upgrade `/actions/parse/page.tsx`** — 4-step wizard: Load, Parse, Review, Save
11. **[ ] Bikin polling hook** — `useJobPoller()` untuk monitor background job
12. **[ ] Bikin BackgroundTaskIndicator** — chip di navbar admin
13. **[ ] Bikin inline editors** — HargaCardEditor, FasilitasChipEditor, PeraturanToggleEditor, KontakListEditor
14. **[ ] Bikin SaveOptions** — save to file, import to DB, export JSON

### Phase 3: Data Model Update
15. **[ ] Tambah field di Kos model** — `data_status`, `parsed_data`, `last_parsed_at`, `reviewed_at`, `reviewed_by`
16. **[ ] Update KosOut schema** — include new fields
17. **[ ] Update `/kos` list page** — status badge + filter by data_status
18. **[ ] Update `/api/kos` endpoint** — optional filter by data_status

### Phase 4: Frontend Integration
19. **[ ] Update `Map.tsx` Kos type` — support both raw string and clean structure
20. **[ ] Update `Map.tsx` popup render` — structured harga cards, fasilitas chips, peraturan toggles, kontak links
21. **[ ] Backward compatibility layer` — detect raw vs clean, render accordingly

### Phase 5: Run & Verify
22. **[ ] Generate clean data` — parse all 158 entries via admin dashboard
23. **[ ] Review & approve` — periksa hasil, approve yang benar
24. **[ ] Import to DB` — save reviewed data with data_status field
25. **[ ] Test frontend` — buka peta, klik kos, pastikan popup tampil clean
