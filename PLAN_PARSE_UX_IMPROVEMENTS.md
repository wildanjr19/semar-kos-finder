# Parse Cleaning UI/UX Improvement Plan

## Masalah Saat Ini

1. **Progress bar hanya tampil "done", tidak ada preview before/after data** — user harus klik "Review" lalu pindah ke step 3 untuk lihat diff, itupun hanya JSON mentah side-by-side
2. **Status kos di halaman `/kos` tetap "raw"** — parsed/reviewed/rejected tetap 0 setelah selesai cleaning. Root cause: default save option adalah `json` (download file), bukan `db` (import ke database). User tidak sadar harus switch radio button

## Target

- User bisa lihat preview hasil parsing langsung di step 2 tanpa pindah step
- Default save ke database, bukan download JSON
- Diff lebih informatif (highlight field yang berubah, bukan hanya JSON mentah)
- Feedback jelas setelah import: redirect ke `/kos` dengan toast
- Tidak ada lagi kebingungan "kok statusnya ga berubah"

---

## 1. Fix Default Save & Status Problem

**File: `admin/app/actions/parse/page.tsx`**

### 1a. Ubah default save option ke database
Baris ~154:
```
-  const [saveOption, setSaveOption] = useState<'json' | 'db'>('json');
+  const [saveOption, setSaveOption] = useState<'json' | 'db'>('db');
```

### 1b. UI save step — beri perbedaan visual jelas antara dua opsi
Di step 4 (Save), ganti dua radio button dengan dua card pilihan:

```
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│ ● Import ke Database                 │  │ ○ Download JSON file               │
│                                     │  │                                     │
│ ✅ Update kos table langsung        │  │ 📥 Hanya download file              │
│ ✅ Status berubah raw → reviewed    │  │ ⚠️  Tidak update database           │
│ ✅ Bisa langsung lihat di /kos      │  │ ⚠️  Harus import manual nanti       │
│                                     │  │                                     │
│ (Recommended)                       │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
```

Kedua card bisa diklik untuk pilih (ganti radio button).

### 1c. Tampilkan status preview sebelum save
Di bawah pilihan, tampilkan ringkasan apa yang akan terjadi:

```
📊 3 entry akan di-update:
  • 2 entry: raw  →  reviewed
  • 1 entry: sudah reviewed sebelumnya (skip)
```

Ambil dari `stats` + fetch current `data_status` dari API.

### 1d. Tambahkan confirmation modal sebelum DB import
Sebelum `handleSave` untuk `db`, tampilkan modal konfirmasi:

```
┌─────────────────────────────────────────┐
│ Konfirmasi Import ke Database            │
│                                         │
│ 3 data akan ditulis ke koleksi `kos`:    │
│                                         │
│ #1 Kost Putri Melati                    │
│    Status: raw  →  reviewed             │
│                                         │
│ #2 Kost Putra Kenanga                   │
│    Status: raw  →  reviewed             │
│                                         │
│ [Batal]           [Ya, Import ke DB]    │
└─────────────────────────────────────────┘
```

### 1e. Setelah import sukses, redirect ke /kos dengan query param
```ts
// Di handleSave setelah import sukses:
window.location.href = `/kos?imported=${data.updated}`;
```

### 1f. Tampilkan toast/alert di halaman kos
**File: `admin/app/kos/page.tsx`**

Baca `?imported=` dari URL, tampilkan banner sukses di atas tabel:

```tsx
{params.get('imported') && (
  <div className={styles.success}>
    ✅ {params.get('imported')} entry berhasil diimport ke database.
  </div>
)}
```

---

## 2. Inline Preview di Step Parse Progress

**File: `admin/app/actions/parse/page.tsx`**

### 2a. Tambahkan kolom "Preview" di tabel parse progress
Ganti kolom "Preview" yang sekarang hanya berisi tombol "Review" menjadi snippet data:

Saat `parseStatus === 'done'`:
```
┌───┬──────────┬──────────────────┬──────────────────────────────────────┐
│ # │ Status   │ Nama             │ Preview                              │
├───┼──────────┼──────────────────┼──────────────────────────────────────┤
│ 1 │ ✓ Done   │ Kost Putri Ayu   │ 💰 Rp 500rb/bln · Rp 750rb/bln      │
│   │          │                  │ 🛏️ AC, WiFi, Kamar Mandi Dalam       │
│   │          │                  │ 📞 0812xxxx (Budi)                    │
│   │          │                  │ [Review →]                            │
│ 2 │ ✓ Done   │ Kost Putra Jaya  │ 💰 Rp 1.2jt/thn                      │
│   │          │                  │ 🛏️ WiFi, Dapur Bersama                │
│   │          │                  │ [Review →]                            │
└───┴──────────┴──────────────────┴──────────────────────────────────────┘
```

Preview snippet ditampilkan di bawah nama, bukan mengganti tombol Review. Tombol Review tetap di kanan.

### 2b. Expandable row — klik baris untuk lihat quick diff
Klik nama/baris entry untuk expand inline:

```
│ 1 │ ✓ Done  │ Kost Putri Ayu  │ 💰 Rp 500rb/bln ...       │
│   │         │                  │                           │
│ ▼ Expanded detail (klik untuk collapse):                  │
│   ┌──────────────────────┬───────────────────────────────┐│
│   │ Raw:                 │ Cleaned:                      ││
│   │ "AC, KM dalam, ..."  │ • dalam_kamar: [AC, KM dlm]   ││
│   │                      │ • bersama: [WiFi]             ││
│   │                      │ • utilitas: [Listrik]          ││
│   └──────────────────────┴───────────────────────────────┘│
```

### 2c. Summary card di atas progress bar
```
┌────────────────────────────────────────────────────────────┐
│ 📊 Parsing Summary                                         │
│ 3/5 selesai · 1 gagal                                     │
│                                                            │
│ 💰 12 varian harga terekstrak                              │
│ 🛏️ 45 fasilitas item terdeteksi                            │
│ 📋 8 peraturan teridentifikasi                             │
│ 📞 3 kontak WhatsApp tervalidasi                           │
└────────────────────────────────────────────────────────────┘
```

Hitung dari `entries.filter(e => e.clean).flatMap(e => e.clean.harga)` dsb.

---

## 3. Diff yang Lebih Informatif (Step 3 Review)

**File: `admin/app/actions/parse/page.tsx`**

### 3a. Field-by-field diff dengan highlight
Ganti diff panel (raw JSON vs cleaned JSON) dengan perbandingan per field:

```
┌──────────────────────────────────────────────────────────┐
│ Harga                                                     │
├──────────────────────┬───────────────────────────────────┤
│ Raw:                 │ Cleaned:                          │
│ "500rb/bln AC,       │ ✅ Rp 500.000 / bulan (AC)        │
│  750rb/bln non-AC"   │ ✅ Rp 750.000 / bulan (non-AC)    │
│                      │                                   │
│ ❌ "500rb/bln"      │ → 500000 min/max, bulan, tipe: AC │
│ ❌ "750rb/bln"      │ → 750000 min/max, bulan, tipe: N  │
└──────────────────────┴───────────────────────────────────┘
```

Raw text ditampilkan di kiri dengan highlight warna (merah = bagian yang di-parse). Cleaned structured data di kanan dengan warna hijau (berhasil diekstrak).

### 3b. Fasilitas diff
```
┌──────────────────────────────────────────────────────────┐
│ Fasilitas                                                 │
├──────────────────────┬───────────────────────────────────┤
│ Raw: "AC, WiFi,      │ 🛏️ Dalam Kamar: [AC, Kasur]       │
│  Kasur, Dapur, KM    │ 📶 Bersama: [WiFi, Dapur, KM dlm] │
│  dalam, Listrik"     │ ⚡ Utilitas: [Listrik]              │
│                      │                                   │
│ ✅ AC → dalam_kamar  │                                   │
│ ✅ WiFi → bersama    │                                   │
│ ✅ Kasur → dalam_kamar│                                  │
│ ✅ Dapur → bersama   │                                   │
│ ✅ KM dalam → bersama│ ⚠️  "KM dalam" harusnya dalam_kamar│
│ ✅ Listrik → utilitas│                                   │
└──────────────────────┴───────────────────────────────────┘
```

Tampilkan mapping setiap kata dari raw text ke kategori cleaned, dengan indicator warna:
- 🟢 Hijau = mapping benar
- 🟡 Kuning = mapping dipertanyakan (bisa diedit user)
- 🔴 Merah = tidak terdeteksi (user bisa tambah manual)

### 3c. Kontak diff
Tampilkan nomor WA yang sudah dinormalisasi:
```
Raw: "08123456789 (Budi)"  →  Cleaned: nama: Budi, wa: 628123456789
```

---

## 4. Bulk Actions di Review Step

**File: `admin/app/actions/parse/page.tsx`**

### 4a. Bulk approve all parsed
Di sidebar entri list (kiri), tambahkan tombol di atas:

```
[Approve All Parsed (3)] [Reject All Failed (1)]
```

### 4b. Keyboard shortcuts
- `←` / `→` = navigasi antar entry
- `a` = approve current entry
- `r` = reject current entry
- `e` = toggle edit mode

### 4c. Progress di sidebar
Di atas sidebar:

```
Progress review: ████████░░ 4/5
✓ 3 approved · ✕ 1 rejected · ⏳ 1 pending
```

---

## 5. Integrasi Parse Wizard ↔ Kos List

**File: `admin/app/kos/page.tsx` dan `admin/app/actions/parse/page.tsx`**

### 5a. Load step — tampilkan data_status yang sudah ada
Saat load data dari DB di step 1, tampilkan badge status di tabel:

```
┌───┬──────────────────┬────────┬────────────────┬───────────┐
│ # │ Nama             │ Jenis  │ Harga (raw)    │ Status    │
├───┼──────────────────┼────────┼────────────────┼───────────┤
│ □ │ Kost Putri Ayu   │ Putri  │ 500rb/bln...   │ raw       │
│ □ │ Kost Putra Jaya  │ Putra  │ 1.2jt/thn...   │ reviewed  │
│ □ │ Kost Campur Sari │ Campur │ 350rb/mgg...   │ parsed    │
└───┴──────────────────┴────────┴────────────────┴───────────┘
```

### 5b. Warnai preselect — pilih hanya yang raw
Saat "Select All", pilih hanya yang `data_status === 'raw'`. Checkbox untuk yang sudah reviewed: disabled.

### 5c. Tombol re-parse untuk yang sudah reviewed
Di entri yang sudah reviewed, tampilkan tombol "Re-parse" kecil (bukan di-select, tapi klik langsung untuk re-parse satu entry).

### 5d. Kos list page — show counts badge
Di halaman `/kos`, di samping judul, tampilkan ringkasan:

```
Daftar Kos (127 total)
┌────────────────────────────────────────────┐
│ raw: 85  │  parsed: 12  │  reviewed: 8  │  rejected: 2  │
└────────────────────────────────────────────┘
```

Ini sudah ada di status filter (label + count), tapi kurang menonjol. Tambahkan di atas tabel sebagai stat cards.

### 5e. Kos list — auto-refresh setelah kembali dari parse wizard
Deteksi apakah user baru kembali dari `/actions/parse`. Pakai `document.referrer` atau flag di sessionStorage:

```ts
useEffect(() => {
  if (sessionStorage.getItem('just_imported')) {
    sessionStorage.removeItem('just_imported');
    fetchKos();
  }
}, []);
```

---

## 6. File Perubahan

| File | Perubahan |
|------|-----------|
| `admin/app/actions/parse/page.tsx` | 1a, 1b, 1c, 1d, 1e, 2a, 2b, 2c, 3a, 3b, 3c, 4a, 4b, 4c, 5a, 5b, 5c |
| `admin/app/actions/parse/parse.module.css` | Style baru: card pilihan save, preview snippet, expandable row, diff highlight, stat cards |
| `admin/app/kos/page.tsx` | 1f, 5d, 5e |
| `admin/app/kos/kos.module.css` | Style: import success banner, stat cards |

---

## 7. Prioritas Eksekusi

**Fase 1 — Bug Fix (kritis):**
1. 1a — ubah default save ke `db`
2. 1b — UI pilihan save yang jelas
3. 1d — confirmation modal
4. 1e + 1f — redirect + toast ke /kos

**Fase 2 — Preview & Diff (high impact):**
5. 2a — inline preview snippet di tabel parse
6. 3a — field-by-field diff dengan highlight
7. 4a — bulk approve/reject

**Fase 3 — Polish:**
8. 2b — expandable row
9. 5a + 5b — status indicator di load step
10. 4b — keyboard shortcuts
11. 5d — stat cards di /kos
