# Panduan Penjurian & Sistem Blind Review - Erlass Competition 2026

Dokumen ini menjelaskan alur operasional dan teknis sistem penilaian karya peserta pada **Erlass Competition 2026** berdasarkan Pedoman Resmi Rubrik Penilaian.

---

## 1. Prinsip Dasar Blind Review (Penjurian Tertutup & Objektif)

Untuk memastikan penilaian berjalan secara adil, profesional, dan bebas dari bias subjektif:
1. **Peniadaan Identitas Peserta**:
   - Seluruh identitas pribadi (Nama Siswa, Asal Sekolah, Nomor WhatsApp, Email, dan Kota/Provinsi) **dihapus secara ketat** dari antarmuka juri dan payload respons API.
   - Setiap peserta hanya diidentifikasi melalui kode samaran netral, misalnya: `Peserta #E-1026-0605`.
2. **Pembersihan Nama pada Judul & Berkas Karya**:
   - Apabila peserta mencantumkan nama pada judul proyek (contoh: *"Menjaga Lingkungan By Azel Marcello"*), sistem backend secara otomatis membersihkan nama tersebut menjadi *"Menjaga Lingkungan"*.
   - Nama berkas asli disamarkan saat diunduh maupun di-stream menjadi `Proyek_E-1026-0605.sb3`.
3. **Pemisahan Hak Akses**:
   - Akun Dewan Juri (role `juri`) **tidak memiliki akses** ke `admin.html`. Jika mencoba membuka URL admin, browser akan langsung mengalihkan juri ke `penjurian.html`.
   - Endpoint API administratif ditolak dengan status HTTP 403 (Forbidden).

---

## 2. Pembagian Penilaian 4 Kelompok (2 Juri per Proyek - Opsi A)

Untuk menyeimbangkan beban penilaian terhadap ratusan proyek peserta secara adil dan terukur, total proyek yang masuk dibagi secara otomatis ke dalam **4 kelompok kerja penilai (round-robin)** dengan komposisi **2 dewan juri per proyek**:

| Kelompok Juri | Anggota Dewan Juri | Porsi Beban Kerja | Cakupan Penilaian |
| :---: | :--- | :---: | :--- |
| **Kelompok 1** | **Dewan Juri 1** (`juri1`) &amp; **Dewan Juri 2** (`juri2`) | 25% Proyek | Proyek antrean kelompok 1 |
| **Kelompok 2** | **Dewan Juri 3** (`juri3`) &amp; **Dewan Juri 4** (`juri4`) | 25% Proyek | Proyek antrean kelompok 2 |
| **Kelompok 3** | **Dewan Juri 5** (`juri5`) &amp; **Dewan Juri 6** (`juri6`) | 25% Proyek | Proyek antrean kelompok 3 |
| **Kelompok 4** | **Dewan Juri 7** (`juri7`) &amp; **Dewan Juri 8** (`juri8`) | 25% Proyek | Proyek antrean kelompok 4 |

### Mekanisme Distribusi & Perhitungan:
1. **Penugasan Otomatis**: Setiap pengumpulan proyek baru (melalui portal submit peserta maupun import admin) secara otomatis dialokasikan ke kelompok 1 sampai 4 menggunakan formula modulo round-robin `((id - 1) % 4) + 1`.
2. **Isolasi Antrean**: Setiap akun juri hanya dapat melihat dan menilai proyek yang ditugaskan ke kelompoknya, sehingga fokus dan beban kerja masing-masing juri setara.
3. **Rata-rata 2 Juri**: Setiap karya dinilai oleh 2 juri dalam kelompok yang sama. Nilai akhir proyek dihitung dari rata-rata nilai kedua juri: `(Nilai_Juri_A + Nilai_Juri_B) / 2`.
4. **Indikator Progres di Dashboard Panitia**: Menampilkan status penyelesaian penilaian per karya (`0/2 Juri`, `1/2 Juri`, atau `2/2 Selesai`).

---

## 3. Akses & Akun Dewan Juri (8 Juri Resmi)

1. Buka tautan: [https://erlasscompetition.erlass.academy/penjurian.html](https://erlasscompetition.erlass.academy/penjurian.html)
2. Masukkan **Username** dan **Password** resmi Dewan Juri.
   - Telah disediakan **8 Akun Dewan Juri Aktif**:
     - **Dewan Juri 1**: `juri1` (Kelompok 1)
     - **Dewan Juri 2**: `juri2` (Kelompok 1)
     - **Dewan Juri 3**: `juri3` (Kelompok 2)
     - **Dewan Juri 4**: `juri4` (Kelompok 2)
     - **Dewan Juri 5**: `juri5` (Kelompok 3)
     - **Dewan Juri 6**: `juri6` (Kelompok 3)
     - **Dewan Juri 7**: `juri7` (Kelompok 4)
     - **Dewan Juri 8**: `juri8` (Kelompok 4)
   - Password: Diberikan dan didistribusikan secara privat oleh Sekretariat Panitia (dapat diubah mandiri melalui tombol Ganti Password).
3. Header studio penjurian otomatis menampilkan nama kelompok juri dan mitra penilai dalam kelompok tersebut.

---

## 4. Navigasi & Carousel Karya Peserta

Setelah berhasil masuk, juri akan melihat antrean karya yang ditugaskan ke kelompoknya:
- **Filter Cabang Lomba**: Pilih Semua Cabang, Scratch Coding, Micro:bit, atau Erboblox.
- **Filter Kategori Jenjang**: Pilih Semua Jenjang, Kelas 1-3 SD, Kelas 4-6 SD, atau SMP.
- **Status Penilaian**:
  - `Semua`: Menampilkan seluruh karya dalam kelompok juri.
  - `Belum Dinilai`: Memfilter hanya karya yang belum diberikan skor oleh juri yang sedang login.
  - `Sudah Dinilai`: Memfilter karya yang telah dinilai (dapat ditinjau dan diedit kembali sewaktu-waktu).
- **Carousel Tombol `<` dan `>`**: Berpindah antar karya peserta dengan mudah.
- **Pencarian Cepat**: Cari karya berdasarkan kode peserta atau judul proyek.

---

## 5. Pratinjau Balok Kode & Media Karya

Studio penjurian dibagi menjadi dua kolom utama (Split Screen):

### Kolom Kiri: Pratinjau Karya (Preview Studio)
Tersedia 3 tab konten interaktif:

#### Tab 1: Pratinjau Balok Kode
- **Scratch Coding (`.sb3`)**:
  - **Player Interaktif Tersemat**: Program game/animasi Scratch berjalan langsung di browser via TurboWarp Embed (`embed.html`) tanpa hambatan CORS.
  - **Tombol "Buka Editor Balok Kode"**: Membuka kanvas Scratch 3.0 visual lengkap di tab baru secara leluasa.
  - **Tombol "Layar Penuh"**: Membuka canvas player dalam ukuran penuh.
  - **Tombol "Unduh Berkas"**: Mengunduh berkas `.sb3` murni untuk dibuka di Scratch Desktop lokal.
  - **Inspeksi Balok Otomatis**: Menampilkan metrik kuantitatif algoritma (target, total blok, kostum, suara, dan sebaran blok per sprite).
- **Micro:bit (`.hex`)**:
  - **Simulator & Kanvas Balok MakeCode Terintegrasi (Controller Mode)**: Berkas `.hex` yang diunggah peserta secara otomatis diinjeksi ke engine resmi Microsoft MakeCode (`makecode.microbit.org/?controller=1`).
  - **Sisi Kiri**: Simulator perangkat keras Micro:bit interaktif (LED 5x5, tombol virtual A/B, pin sentuh, dan sensor virtual).
  - **Sisi Kanan**: Kanvas Balok Kode MakeCode utuh (geser, perbesar, loop, percabangan logika, dan variabel).
  - **Tombol "Layar Penuh"**: Memperluas simulator dan kanvas MakeCode ke layar penuh.
  - **Tombol "Unduh Berkas"**: Mengunduh berkas `.hex` murni untuk diuji pada hardware fisik.
- **Erboblox Robotics (`.ichibot` / Video Demo)**:
  - **Studio Balok Robotik Tersemat**: Kanvas pemrograman visual Blockly resmi dari ICHIBOT BLOCK STUDIO tersemat langsung di dalam studio penjurian.
  - **Inspeksi Balok Logika Robot**: Juri dapat meninjau blok pergerakan motor, pembacaan sensor garis, dan generator kode Arduino/C.
  - **Verifikasi Fisik di Tab Video**: Menilai demonstrasi manuver robot fisik, ketepatan sensor, dan perakitan mekanis.

#### Tab 2: Video Presentasi
- Pemutar video responsif rasio 16:9 yang otomatis menyematkan video dari tautan YouTube maupun Google Drive.
- Tautan cadangan video jika tautan utama mengalami kendala izin akses.

#### Tab 3: Sinopsis & Cara Main
- Memuat teks deskripsi konsep karya, latar belakang ide, dan petunjuk cara bermain yang dituliskan oleh peserta.

---

## 6. Rubrik Penilaian Resmi (Pedoman 2026 - Bobot 100%)

### Kolom Kanan: Formulir Penilaian (Scoring Studio)
Sistem menerapkan 5 kriteria terbobot resmi sesuai dokumen Pedoman Penilaian Erlass Competition 2026:

| No | Kriteria Penilaian | Bobot | Maksimal Poin | Sub-Kriteria & Panduan Asesmen |
| :---: | :--- | :---: | :---: | :--- |
| **1** | **Presentasi dan Pemahaman Proyek** | **40%** | **40.00 pts** | Kemampuan menjelaskan konsep dan alur proyek, kejelasan artikulasi dan bahasa yang digunakan, penguasaan materi saat presentasi, kerapian dan struktur penyampaian. |
| **2** | **Logika dan Cara Kerja Program** | **20%** | **20.00 pts** | Logika pemrograman (looping, condition, variable, event), efisiensi dan kerapian blok kode / script, keberhasilan eksekusi tanpa error / bug fatal. |
| **3** | **Kreativitas dan Pengembangan Ide** | **15%** | **15.00 pts** | Keunikan ide / orisinalitas proyek, inovasi dalam pemecahan masalah (problem solving), nilai tambah dan daya tarik karya. |
| **4** | **Fungsi dan Keberhasilan Proyek** | **15%** | **15.00 pts** | Kesesuaian hasil karya dengan tujuan yang direncanakan, proyek dapat beroperasi/berinteraksi dengan baik, kebermanfaatan aplikasi / alat yang dibuat. |
| **5** | **Kesesuaian dengan Tema** | **10%** | **10.00 pts** | Relevansi proyek dengan tema lomba yang ditentukan, keselarasan antara konsep cerita/alat dengan implementasi program. |

### Ketentuan Khusus Platform (Khusus Cabang Micro:bit):
1. **Jenjang SD (Kelas 1-3 & Kelas 4-6) - Bonus Poin Sensor Eksternal**:
   - 0 sensor eksternal (hanya sensor bawaan micro:bit): **+0 poin**
   - 1 sensor eksternal (Ultrasonic, PIR, DHT, Soil Moisture, dll): **+3 poin**
   - 2 atau lebih sensor eksternal: **+5 poin**
   - *Catatan*: Nilai akhir maksimal tetap dibatasi pada 100.00 poin.
2. **Jenjang SMP (Kelas 7-9) - Ketentuan Wajib Sensor Eksternal**:
   - Kategori SMP **wajib** menggunakan minimal 1 sensor eksternal.
   - Tersedia checklist verifikasi kelayakan teknis sensor eksternal pada lembar penilaian.

### Formula Perhitungan Skor:
```
Skor_Terbobot = (Presentasi * 0.40) + (Logika * 0.20) + (Kreativitas * 0.15) + (Fungsi * 0.15) + (Tema * 0.10) + Bonus_Sensor
Nilai_Akhir   = MIN(100.00, ROUND(Skor_Terbobot, 2))
```

### Predikat Mutu Hasil Penilaian:
- `90.00 - 100.00` : **Istimewa (A+)**
- `80.00 - 89.99`  : **Sangat Baik (A)**
- `70.00 - 79.99`  : **Baik (B)**
- `60.00 - 69.99`  : **Cukup (C)**
- `< 60.00`        : **Perlu Pembinaan (D)**

---

## 7. Rekapitulasi Nilai & Berita Acara Dewan Juri (CSV)

1. Klik tombol **"Rekap & Peringkat"** pada bilah navigasi atas studio penjurian.
2. Muncul modal rekapitulasi yang mengurutkan karya berdasarkan rata-rata skor dewan juri tertinggi (descending).
3. Juri dapat memfilter berdasarkan cabang dan jenjang tertentu.
4. Identitas nama dan sekolah peserta **tetap disamarkan secara aman** bagi juri (menampilkan `Peserta #E-XXXX-XXXX`).
5. Klik **"Unduh Berita Acara (CSV)"** untuk mengunduh rekapitulasi penilaian resmi dalam format berkas spreadsheet.

---

## 8. Dashboard Penilaian Eksekutif Panitia & Admin (`admin.html`)

Panitia dan Superadmin memiliki dashboard monitoring terpusat di `admin.html` pada **Tab 3: "Penilaian & Rekap Nilai Juri"**:

1. **Filter Berdasarkan Kelompok Juri**:
   - Panitia dapat memfilter leaderboard berdasarkan: *Semua Kelompok*, *Kelompok 1 (Juri 1 & 2)*, *Kelompok 2 (Juri 3 & 4)*, *Kelompok 3 (Juri 5 & 6)*, atau *Kelompok 4 (Juri 7 & 8)*.
2. **Indikator Status Penyelesaian**:
   - Kolom status penilaian menampilkan: `0/2 Juri`, `1/2 Juri`, atau `2/2 Selesai`.
3. **Rincian Nilai Per Juri**:
   - Klik tombol **"Rincian"** pada baris peserta mana pun untuk melihat lembar skor dari masing-masing juri:
     - Skor 5 kriteria terbobot (Presentasi 40%, Logika 20%, Kreativitas 15%, Fungsi 15%, Tema 10%).
     - Poin bonus sensor eksternal (khusus Micro:bit SD).
     - Status verifikasi sensor eksternal (khusus Micro:bit SMP).
     - Catatan evaluasi kualitatif dan stempel waktu penilaian.
4. **Ekspor Berita Acara Pleno (CSV)**:
   - File CSV mencakup Peringkat, Kode Peserta, Nama Peserta, Asal Sekolah, Cabang, Jenjang, Kelompok Juri, Judul Karya, Jumlah Penilai (Maks 2), Rata-rata 5 Kriteria, Bonus Sensor, dan Nilai Akhir.
