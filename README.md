# Erlass Competition 2026 - Portal Kompetisi & Studio Penjurian

Sistem terpadu pendaftaran peserta, pengumpulan karya proyek, manajemen panitia, dan studio penjurian karya objektif (*Blind Review*) untuk **Erlass Competition 2026** (PT. Erlass Prokreatif Indonesia).

---

## Fitur Utama Sistem

### 1. Portal Pendaftaran Peserta (`index.html`)
- **Pencarian Sekolah Nasional Standar**: Terintegrasi langsung dengan basis data 38 provinsi Kemdikbud (NPSN, Jenjang, Wilayah Kota/Kabupaten, Provinsi, dan status Kemitraan terisi otomatis).
- **Auto-Cutoff Pendaftaran**: Pendaftaran publik tertutup otomatis pada **5 November 2026 pukul 23:59:59 WIB** berdasarkan konfigurasi database (`competitions.registration_end`).
- **Dukungan Multi-Cabang & Jenjang**:
  - Scratch Coding (Kelas 1-3 SD, Kelas 4-6 SD)
  - Micro:bit (Kelas 4-6 SD, SMP 7-9)
  - Erboblox Robotics (Kelas 4-6 SD, SMP 7-9)
- **Generasi Kode Registrasi Unik**: Format otomatis `E-1026-XXXX` / `E-1126-XXXX`.

### 2. Portal Pengumpulan Proyek (`kumpul-proyek.html`)
- **Verifikasi Kode Registrasi**: Validasi kepesertaan (`payment_status = 'verified'` atau `is_partner = 1`) sebelum formulir terbuka.
- **Bantuan Lupa ID Peserta (Verifikasi Privat)**: Pemulihan kode registrasi mandiri dengan verifikasi 3 data privat (Nama Lengkap, Tanggal Lahir, dan Nomor WhatsApp terdaftar), dilengkapi pembatas frekuensi (*Rate Limiting* Redis maksimal 5 percobaan per 15 menit).
- **Upload Berkas Proyek**: Validasi ekstensi `.sb3` (Scratch Coding) dan `.hex` (Micro:bit) dengan batas ukuran aman maksimal **50 MB** (khusus Erboblox Robotics tidak mewajibkan upload berkas kode).
- **Integrasi Video Presentasi**: Input tautan video YouTube (reguler, Shorts, `youtu.be`) atau Google Drive preview, dilengkapi input tautan cadangan dan 5 poin pernyataan konfirmasi peserta.
- **Sistem Izin Revisi Mandiri**: Penguncian otomatis setelah karya terkumpul (`allow_revision = 0`, batas pengumpulan baru hingga **21 November 2026**). Revisi karya hanya dapat dilakukan jika panitia memberikan izin revisi melalui dashboard admin.
- **Distribusi Otomatis Antrean Penjurian**: Setiap karya baru otomatis dialokasikan secara merata ke kelompok penilai 1 sampai 4 (*round-robin*).

### 3. Dashboard Panitia & Manajemen (`admin.html`)
- **Triple Tab Management**:
  - Tab 1: **Data Pendaftar** (Metrik peserta, filter cabang/status, verifikasi bukti transfer, bulk delete peserta).
  - Tab 2: **Pengumpulan Proyek** (Daftar karya terkumpul, inspeksi berkas, izin revisi, catatan arahan revisi panitia, ekspor CSV proyek).
  - Tab 3: **Penilaian & Rekap Nilai Juri** (Dashboard eksekutif skor dewan juri: nama asli peserta & sekolah terbuka, filter **Kelompok Juri 1-4**, status penyelesaian `0/2` / `1/2` / `2/2`, rata-rata 5 rubrik resmi 2026 + bonus sensor, total skor akhir, modal popup rincian nilai individual per juri, dan ekspor Berita Acara resmi ke CSV).
- **Unduh Template Peserta Manual**: Tombol *Template Peserta* di header untuk mendapatkan template spreadsheet `.xlsx` & `.csv`.
- **Multi-Event Switching**: Mendukung pengelolaan multi-tahun kompetisi (2026, 2027, dst.) dalam satu database.
- **Manajemen Akun Panitia & Juri**: Dukungan akun `superadmin`, `panitia`, serta 8 Dewan Juri resmi (`juri1` - `juri8`) yang terbagi ke dalam 4 kelompok kerja (`judge_group` 1-4).

### 4. Studio Penjurian Resmi - Blind Review (`penjurian.html`)
- **Pembagian 4 Kelompok Penilaian (Opsi A - 2 Juri per Proyek)**:
  - Total karya yang masuk dibagi secara merata ke 4 kelompok kerja (*round-robin* modulo) sehingga setiap juri memproses 25% total beban karya:
    - **Kelompok 1**: `juri1` (Dewan Juri 1) & `juri2` (Dewan Juri 2)
    - **Kelompok 2**: `juri3` (Dewan Juri 3) & `juri4` (Dewan Juri 4)
    - **Kelompok 3**: `juri5` (Dewan Juri 5) & `juri6` (Dewan Juri 6)
    - **Kelompok 4**: `juri7` (Dewan Juri 7) & `juri8` (Dewan Juri 8)
  - Setiap karya dinilai oleh 2 juri dalam kelompok yang sama; nilai akhir proyek adalah rata-rata kedua juri: `(Nilai_Juri_A + Nilai_Juri_B) / 2`.
- **100% Light Theme & Design Taste Standards**:
  - Tipografi eksekutif: **Plus Jakarta Sans** untuk hirarki judul dan **JetBrains Mono** (`.font-tabular`) untuk angka stabil.
  - Skema warna monokromatik kontras tinggi dengan aksen oranye Erlass (`#ea580c`), tombol taktil (`.btn-tactile`), sorotan preset aktif, dan ergonomi *sticky scroll* untuk layar laptop.
- **Kerahasiaan Mutlak (Strict Blind Review)**:
  - Dewan Juri **tidak dapat melihat** nama murid, nama sekolah, nomor telepon, maupun daerah asal peserta.
  - Kode peserta disamarkan sebagai `Peserta #E-XXXX-XXXX`, berkas disamarkan menjadi `Proyek_E-XXXX-XXXX.[ext]`, dan judul proyek dibersihkan otomatis dari embel-embel nama pembuat.
- **Pratinjau Balok Kode Interaktif**:
  - **Scratch (`.sb3`)**: Engine TurboWarp Embed + tombol Editor Balok Kode + analisis otomatis `ZipArchive` (target, total balok, kostum, suara, rincian per sprite).
  - **Micro:bit (`.hex`)**: Integrasi Microsoft MakeCode Controller Mode (simulator LED 5x5/tombol virtual + kanvas balok kode otomatis dari `.hex`).
  - **Erboblox Robotics**: Integrasi Ichibot Block Studio + pemutar video demonstrasi fisik.
  - **Video Player 16:9**: Player video presentasi tersemat untuk YouTube dan Google Drive.
- **Rubrik Penilaian Resmi 2026 (5 Kriteria Terbobot - Total 100%)**:
  1. Presentasi dan Pemahaman Proyek (**40%**)
  2. Logika dan Cara Kerja Program (**20%**)
  3. Kreativitas dan Pengembangan Ide (**15%**)
  4. Fungsi dan Keberhasilan Proyek (**15%**)
  5. Kesesuaian dengan Tema (**10%**)
  - **Ketentuan Khusus Platform Micro:bit**:
    - Jenjang SD (`Kelas 1-3` & `Kelas 4-6`): Pilihan **Bonus Nilai Sensor Eksternal** (`+0`, `+3` untuk 1 sensor, `+5` untuk >=2 sensor), total nilai akhir dibatasi maksimal `100.00`.
    - Jenjang SMP (`SMP 7-9`): *Checklist* verifikasi wajib minimal 1 sensor eksternal (`technical_passed`).
  - *Tanpa Slider*: Input angka presisi (0-100), tombol penyesuai bertahap (`-` / `+`), tombol preset (`70`, `80`, `85`, `90`, `95`, `100`), kalkulator real-time, predikat mutu (*Istimewa A+*, *Sangat Baik A*, *Baik B*, *Cukup C*, *Perlu Pembinaan D*), serta tombol *"Simpan & Lanjut ke Peserta Berikutnya"*.

### 5. Sistem Import Manual Peserta Susulan (Excel & CSV)
- **Template Excel & CSV Siap Pakai**: Lembar `DATA PESERTA` (dengan validasi dropdown) & `PETUNJUK PENGISIAN`.
- **Script CLI Importer (`scripts/import_peserta.php`)**: Mendukung mode `--dry-run` (simulasi) dan eksekusi simpan database, penomoran `reg_code` berurutan, deteksi otomatis kemitraan dari `partner_schools`/`national_schools`, serta injeksi otomatis ke `project_submissions` dengan alokasi `judge_group` 1-4 bila data proyek diisi.
- **Dokumentasi Lengkap:** [docs/IMPORT_MANUAL_PESERTA.md](docs/IMPORT_MANUAL_PESERTA.md).

---

## Struktur Basis Data

Database: `erlass_competition` (MySQL / MariaDB)

| Tabel | Deskripsi |
| :--- | :--- |
| `competitions` | Konfigurasi event kompetisi, tanggal cutoff pendaftaran (`registration_end`), biaya pendaftaran, dan status aktif. |
| `competition_branches` | Daftar cabang lomba per kompetisi (`Scratch Coding`, `Micro:bit`, `Erboblox Robotics`). |
| `national_schools` | Dataset sekolah nasional Kemdikbud se-Indonesia (NPSN, nama, jenjang, kota/kabupaten, provinsi, flag mitra). |
| `partner_schools` | Daftar sekolah mitra pelanggan Erlass Academy (`school_code`/NPSN, wilayah, status aktif). |
| `registrations` | Data pendaftaran peserta (nama, sekolah, NPSN, wilayah, cabang, kelas, kategori jenjang, status verifikasi, bukti transfer). |
| `admin_users` | Akun pengguna panitia dan juri dengan role `superadmin`, `panitia`, atau `juri`, serta kolom `judge_group` (1-4 untuk juri, `NULL` untuk admin/panitia). Password di-hash dengan BCrypt. |
| `admin_sessions` | Sesi autentikasi aman berbasis token kriptografi 64 karakter. |
| `project_submissions` | Berkas karya peserta, `judge_group` (1-4), judul proyek, sinopsis, link video presentasi, status pengumpulan, versi, dan izin revisi. |
| `project_scores` | Nilai dewan juri per kriteria (Presentasi 40%, Logika 20%, Kreativitas 15%, Fungsi 15%, Tema 10%), `bonus_score` sensor SD, `technical_passed` verifikasi SMP, `total_score`, catatan juri, dan `UNIQUE KEY (submission_id, judge_id)`. |

---

## Hak Akses (Role-Based Access Control)

| Role | Akses Halaman | Hak Istimewa |
| :--- | :--- | :--- |
| `superadmin` | `admin.html`, `penjurian.html` | Akses penuh seluruh data, manajemen akun panitia/juri, pengelolaan event, ekspor data identitas asli, hapus data. |
| `panitia` | `admin.html`, `penjurian.html` | Verifikasi pendaftaran peserta, monitoring pengumpulan karya, pemberian izin revisi karya, monitoring rekapitulasi nilai penuh. |
| `juri` | `penjurian.html` (Khusus) | **Blind Review Only & Terisolasi per Kelompok**. Akses ke `admin.html` diblokir otomatis. Hanya dapat melihat & menilai karya sesuai `judge_group` masing-masing tanpa identitas pribadi peserta. |

---

## Struktur Direktori

```text
/var/www/erlass-competition/
├── index.html                                           # Halaman utama pendaftaran peserta
├── kumpul-proyek.html                                   # Portal pengumpulan karya proyek peserta & pemulihan ID
├── admin.html                                           # Dashboard panitia & administrasi kompetisi
├── penjurian.html                                       # Studio penjurian dewan juri (Blind Review)
├── herobanner.jpeg                                      # Aset visual hero utama
├── template_import_peserta.xlsx                         # Berkas template spreadsheet peserta
├── template_import_peserta.csv                          # Berkas template CSV peserta
├── Data Sekolah Se Indonesia/                           # Dataset CSV sekolah per provinsi
├── api/
│   ├── db.php                                           # Koneksi database & fungsi helper sesi/token
│   ├── public.php                                       # API publik (kompetisi, cari sekolah, daftar, lupa ID, submit proyek)
│   └── admin.php                                        # API admin & penjurian (auth, scoring 40/20/15/15/10, leaderboard, export)
├── css/
│   └── style.css                                        # Styling tambahan aplikasi
├── docs/
│   ├── Juknis_Lomba_Erlass_Competition_2026.pdf
│   ├── Pedoman_Resmi_Rubrik_Penilaian_Erlass_Competition_2026.pdf
│   ├── PANDUAN_PENJURIAN_DAN_BLIND_REVIEW.md
│   ├── SISTEM_PENGUMPULAN_PROYEK.md
│   ├── IMPORT_MANUAL_PESERTA.md
│   └── API_DOCUMENTATION.md
├── downloads/
│   ├── template_import_peserta.xlsx
│   └── template_import_peserta.csv
├── js/
│   ├── app.js                                           # Logika pendaftaran & pencarian sekolah publik
│   ├── kumpul-proyek.js                                 # Logika formulir pengumpulan proyek & pemulihan ID
│   ├── admin.js                                         # Logika dashboard admin panitia
│   └── penjurian.js                                     # Logika studio penjurian juri & kalkulasi rubrik 2026
├── scripts/
│   └── import_peserta.php                               # CLI Importer data peserta manual (Excel/CSV)
└── uploads/
    ├── proofs/                                          # Berkas bukti transfer pembayaran
    └── projects/                                          # Berkas proyek karya peserta (.sb3, .hex)
```

---

## Panduan Akses Cepat

- **Portal Pendaftaran:** [https://erlasscompetition.erlass.academy/](https://erlasscompetition.erlass.academy/)
- **Pengumpulan Proyek:** [https://erlasscompetition.erlass.academy/kumpul-proyek.html](https://erlasscompetition.erlass.academy/kumpul-proyek.html)
- **Dashboard Panitia:** [https://erlasscompetition.erlass.academy/admin.html](https://erlasscompetition.erlass.academy/admin.html)
- **Studio Penjurian Juri:** [https://erlasscompetition.erlass.academy/penjurian.html](https://erlasscompetition.erlass.academy/penjurian.html)
- **Template Excel Peserta:** [https://erlasscompetition.erlass.academy/template_import_peserta.xlsx](https://erlasscompetition.erlass.academy/template_import_peserta.xlsx)
