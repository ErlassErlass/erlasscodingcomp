# Erlass Competition 2026 - Portal Kompetisi & Studio Penjurian

Sistem terpadu pendaftaran peserta, pengumpulan karya proyek, manajemen panitia, dan studio penjurian karya objektif (*Blind Review*) untuk **Erlass Competition 2026** (PT. Erlass Prokreatif Indonesia).

---

## 🌟 Fitur Utama Sistem

### 1. Portal Pendaftaran Peserta (`index.html`)
- **Pencarian Sekolah Nasional Standar**: Terintegrasi langsung dengan basis data 38 provinsi Kemdikbud (NPSN, Jenjang, Status Negeri/Swasta, Kabupaten/Kota, dan Provinsi terisi otomatis tanpa input teks manual bebas).
- **Auto-Cutoff Pendaftaran**: Pendaftaran tertutup secara otomatis tepat pada **5 November 2026 pukul 23:59:59 WIB** berdasarkan konfigurasi tanggal dinamis dari database.
- **Dukungan Multi-Cabang & Jenjang**:
  - Scratch Coding (Kelas 1–3 SD, Kelas 4–6 SD)
  - Micro:bit (Kelas 4–6 SD, SMP 7–9)
  - Erboblox Robotics (TK/Playgroup, SD, SMP)
- **Generasi Kode Registrasi Unik**: Format otomatis `E-1026-XXXX`.

### 2. Portal Pengumpulan Proyek (`kumpul-proyek.html`)
- **Verifikasi Kode Registrasi**: Validasi kepesertaan sebelum formulir terbuka.
- **Upload Berkas Proyek**: Validasi ekstensi `.sb3` (Scratch) dan `.hex` (Micro:bit) dengan batas ukuran aman (max 50MB).
- **Integrasi Video Presentasi**: Input link video YouTube (termasuk format shorts & youtu.be) atau Google Drive preview, dilengkapi input tautan cadangan.
- **Sistem Izin Revisi Mandiri**: Penguncian otomatis setelah karya terkumpul. Revisi karya hanya dapat dilakukan jika panitia memberikan izin revisi (*allow revision*) melalui dashboard admin.

### 3. Dashboard Panitia & Manajemen (`admin.html`)
- **Triple Tab Management**:
  - Tab 1: **Data Pendaftar** (Metrik peserta, filter cabang/status, verifikasi bukti transfer, bulk delete peserta).
  - Tab 2: **Pengumpulan Proyek** (Daftar karya terkumpul, inspeksi berkas, izin revisi, catatan arahan revisi panitia, ekspor CSV proyek).
  - Tab 3: **Penilaian & Rekap Nilai Juri** (Dashboard eksekutif skor dewan juri: nama asli peserta & sekolah terbuka, rata-rata 5 rubrik penilaian, total skor akhir, filter cabang/jenjang, modal popup rincian nilai individual per juri, dan ekspor Berita Acara resmi ke CSV).
- **Multi-Event Switching**: Mendukung pengelolaan multi-tahun kompetisi (2026, 2027, dst.) dalam satu database.
- **Manajemen Akun Panitia & Juri**: Dukungan akun superadmin, panitia, serta 8 Dewan Juri resmi (`juri1` - `juri8`).

### 4. Studio Penjurian Resmi - Blind Review (`penjurian.html`)
- **100% Light Theme**: Tampilan bersih, elegan, dan kontras tinggi selaras dengan identitas visual Erlass Academy.
- **Kerahasiaan Mutlak (Strict Blind Review)**:
  - Dewan Juri **tidak dapat melihat** nama murid, nama sekolah, nomor telepon, email, maupun daerah asal peserta.
  - Kode peserta disamarkan sebagai `Peserta #E-1026-XXXX`.
  - Judul proyek otomatis dibersihkan dari embel-embel nama peserta (misal: `"Menjaga Lingkungan By Azel"` -> `"Menjaga Lingkungan"`).
- **Pratinjau Balok Kode Interaktif**:
  - **Scratch (`.sb3`)**: Integrasi engine TurboWarp (`embed.html`) dengan dukungan CORS server.
  - **Tombol Editor Balok Kode ↗**: Membuka kanvas balok Scratch 3.0 visual lengkap di tab baru secara leluasa.
  - **Inspeksi Balok Otomatis (ZipArchive)**: Analisis metrik algoritma instan (Total Objek, Total Balok Kode, Kostum, Audio, dan rincian jumlah balok per sprite).
  - **Micro:bit (`.hex`)**: Dukungan simulator Microsoft MakeCode.
  - **Video Player 16:9**: Player video presentasi tersemat langsung untuk YouTube dan Google Drive.
- **Rubrik Penilaian 5 Kriteria Terbobot (Total 100%)**:
  1. Logika Pemrograman & Algoritma (**30%**)
  2. Kreativitas & Orisinalitas (**25%**)
  3. Kesesuaian Tema & Fungsionalitas (**20%**)
  4. Estetika, Desain UI & Gerak (**15%**)
  5. Presentasi & Pemahaman Peserta di Video (**10%**)
  - *Tanpa Slider*: Menggunakan input angka presisi (0-100), tombol penyesuai bertahap (`-` dan `+`), serta tombol jalan pintas nilai preset (`70`, `80`, `85`, `90`, `95`, `100`).
  - Kalkulator akumulasi real-time dan predikat mutu kualitatif (*Istimewa A+*, *Sangat Baik A*, *Baik B*, dll).
  - Tombol *"Simpan & Lanjut ke Peserta Berikutnya"* untuk efisiensi penilaian.
- **Rekapitulasi & Peringkat (Leaderboard)**:
  - Urutan peringkat berdasarkan rata-rata skor akhir juri.
  - Ekspor Berita Acara Rekap Nilai Juri ke format CSV.

---

## 🏗️ Struktur Basis Data

Database: `erlass_competition` (MySQL / MariaDB)

| Tabel | Deskripsi |
| :--- | :--- |
| `competitions` | Konfigurasi event kompetisi, tanggal cutoff pendaftaran (`registration_end`), biaya pendaftaran, dan status aktif. |
| `registrations` | Data pendaftaran peserta (Nama, Sekolah, NPSN, Wilayah, Cabang, Status Verifikasi, Bukti Transfer). |
| `admin_users` | Akun pengguna panitia dan juri dengan role `superadmin`, `panitia`, atau `juri` (Password di-hash dengan BCrypt). |
| `admin_sessions` | Sesi autentikasi aman berbasis token kriptografi 64 karakter. |
| `project_submissions` | Berkas karya peserta, judul proyek, sinopsis, link video presentasi, status pengumpulan, dan izin revisi. |
| `project_scores` | Nilai dewan juri per kriteria (Logika 30%, Kreatif 25%, Tema 20%, Estetika 15%, Presentasi 10%), total skor terbobot, catatan juri, dan `UNIQUE KEY (submission_id, judge_id)`. |

---

## 👥 Hak Akses (Role-Based Access Control)

| Role | Akses Halaman | Hak Istimewa |
| :--- | :--- | :--- |
| `superadmin` | `admin.html`, `penjurian.html` | Akses penuh seluruh data, manajemen akun panitia/juri, ekspor data identitas asli, hapus data. |
| `panitia` | `admin.html` | Verifikasi pendaftaran peserta, monitoring pengumpulan karya, pemberian izin revisi karya. |
| `juri` | `penjurian.html` (Khusus) | **Blind Review Only**. Akses ke `admin.html` diblokir otomatis. Hanya dapat menilai karya tanpa identitas peserta dan melihat rekapitulasi nilai. |

---

## 📁 Struktur Direktori

```text
/var/www/erlass-competition/
├── index.html                 # Halaman utama pendaftaran peserta
├── kumpul-proyek.html         # Portal pengumpulan karya proyek peserta
├── admin.html                 # Dashboard panitia & administrasi kompetisi
├── penjurian.html             # Studio penjurian dewan juri (Blind Review)
├── herobanner.jpeg            # Aset visual hero utama
├── Data Sekolah Se Indonesia/ # Dataset CSV sekolah per provinsi
├── api/
│   ├── db.php                 # Koneksi database & fungsi helper sesi
│   ├── public.php             # API publik (pendaftaran, pencarian sekolah, submit proyek)
│   └── admin.php              # API admin & penjurian (auth, scoring, leaderboard, export)
├── css/
│   └── style.css              # Styling tambahan aplikasi
├── docs/
│   ├── Juknis_Lomba_Erlass_Competition_2026.pdf
│   ├── PANDUAN_PENJURIAN_DAN_BLIND_REVIEW.md
│   ├── SISTEM_PENGUMPULAN_PROYEK.md
│   └── API_DOCUMENTATION.md
├── js/
│   ├── app.js                 # Logika pendaftaran & pencarian sekolah publik
│   ├── kumpul-proyek.js       # Logika formulir pengumpulan proyek
│   ├── admin.js               # Logika dashboard admin panitia
│   └── penjurian.js           # Logika studio penjurian juri & scoring
└── uploads/
    ├── proofs/                # Berkas bukti transfer pembayaran
    └── projects/              # Berkas proyek karya peserta (.sb3, .hex)
```

---

## 🚀 Panduan Akses Cepat

- **Portal Pendaftaran:** [https://erlasscompetition.erlass.academy/](https://erlasscompetition.erlass.academy/)
- **Pengumpulan Proyek:** [https://erlasscompetition.erlass.academy/kumpul-proyek.html](https://erlasscompetition.erlass.academy/kumpul-proyek.html)
- **Dashboard Panitia:** [https://erlasscompetition.erlass.academy/admin.html](https://erlasscompetition.erlass.academy/admin.html)
- **Studio Penjurian Juri:** [https://erlasscompetition.erlass.academy/penjurian.html](https://erlasscompetition.erlass.academy/penjurian.html)

