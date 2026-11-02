# Panduan Penjurian & Sistem Blind Review - Erlass Competition 2026

Dokumen ini menjelaskan alur operasional dan teknis sistem penilaian karya peserta pada **Erlass Competition 2026**.

---

## 🛡️ 1. Prinsip Dasar Blind Review (Penjurian Tertutup & Objektif)

Untuk memastikan penilaian berjalan secara adil, profesional, dan bebas dari bias subjektif:
1. **Peniadaan Identitas Peserta**:
   - Seluruh identitas pribadi (Nama Siswa, Asal Sekolah, Nomor WhatsApp, Email, dan Kota/Provinsi) **dihapus secara ketat** dari antarmuka juri dan *payload* respons API.
   - Setiap peserta hanya diidentifikasi melalui kode samaran netral, misalnya: `Peserta #E-1026-0605`.
2. **Pembersihan Nama pada Judul & Berkas Karya**:
   - Apabila peserta mencantumkan nama pada judul proyek (contoh: *"Menjaga Lingkungan By Azel Marcello"*), sistem backend secara otomatis membersihkan nama tersebut menjadi *"Menjaga Lingkungan"*.
   - Nama berkas asli disamarkan saat diunduh maupun di-stream menjadi `Proyek_E-1026-0605.sb3`.
3. **Pemisahan Hak Akses**:
   - Akun Dewan Juri (role `juri`) **tidak memiliki akses** ke `admin.html`. Jika mencoba membuka URL admin, browser akan langsung mengalihkan juri ke `penjurian.html`.
   - Endpoint API administratif ditolak dengan status HTTP 403 (*Forbidden*).

---

## 🔑 2. Akses & Login Dewan Juri

1. Buka tautan: [https://erlasscompetition.erlass.academy/penjurian.html](https://erlasscompetition.erlass.academy/penjurian.html)
2. Masukkan **Username** dan **Password** yang telah diterbitkan oleh Sekretariat Panitia.
   - Akun Pengujian Internal: `juri1` / `[PASSWORD_RESMI]`
3. Klik tombol **"Masuk Ruang Penjurian"**.

---

## 🗂️ 3. Navigasi & Carousel Karya Peserta

Setelah berhasil masuk, juri akan melihat bilah navigasi antrian karya di bagian atas:
- **Filter Cabang Lomba**: Pilih *Semua Cabang*, *Scratch Coding*, *Micro:bit*, atau *Erboblox*.
- **Filter Kategori Jenjang**: Pilih *Semua Jenjang*, *Kelas 1-3 SD*, *Kelas 4-6 SD*, atau *SMP*.
- **Status Penilaian**:
  - `Semua`: Menampilkan seluruh karya dalam kategori.
  - `Belum Dinilai`: Memfilter hanya karya yang belum diberikan skor oleh juri yang sedang login.
  - `Sudah Dinilai`: Memfilter karya yang telah dinilai (dapat ditinjau dan diedit kembali sewaktu-waktu).
- **Carousel Tombol `<` dan `>`**: Berpindah antar karya peserta dengan mudah.
- **Indikator Progres Saya**: Menampilkan persentase karya yang telah selesai dinilai dari total antrian (contoh: `8/15 (53%)`).

---

## 💻 4. Pratinjau Balok Kode & Media Karya

Studio penjurian dibagi menjadi dua kolom utama (*Split Screen*):

### Kolom Kiri: Pratinjau Karya (Preview Studio)
Tersedia 3 tab konten interaktif:

#### Tab 1: Pratinjau Balok Kode
- **Scratch Coding (`.sb3`)**:
  - **Player Interaktif Tersemat**: Program game/animasi Scratch berjalan langsung di browser via TurboWarp Embed (`embed.html`) tanpa hambatan CORS.
  - **Tombol "Buka Editor Balok Kode ↗"**: Membuka kanvas Scratch 3.0 visual lengkap di tab baru secara leluasa (juri dapat melihat susunan balok logika, skrip per sprite, kostum, dan audio).
  - **Tombol "Layar Penuh"**: Membuka canvas player dalam ukuran penuh.
  - **Tombol "Unduh Berkas"**: Mengunduh berkas `.sb3` murni untuk dibuka di Scratch Desktop lokal.
  - **Inspeksi Balok Otomatis**: Menampilkan metrik kuantitatif algoritma yang dianalisis otomatis oleh server:
    - Total Target / Objek
    - Total Balok Kode
    - Jumlah Kostum Grafis
    - Jumlah Efek Suara
    - Tabel rincian jumlah balok per sprite objek.
- **Micro:bit (`.hex`)**:
  - Tombol langsung untuk membuka simulator Microsoft MakeCode (`makecode.microbit.org`).
  - Tombol unduh berkas `.hex` murni.

#### Tab 2: Video Presentasi
- Pemutar video responsif rasio 16:9 yang otomatis menyematkan video dari tautan YouTube maupun Google Drive.
- Tautan cadangan video jika tautan utama mengalami kendala izin akses.
- Catatan pengingat panduan penilaian video bagi juri.

#### Tab 3: Sinopsis & Cara Main
- Memuat teks deskripsi konsep karya, latar belakang ide, dan petunjuk cara bermain yang dituliskan oleh peserta.

---

## ⚖️ 5. Rubrik Penilaian Resmi (Terbobot 100%)

### Kolom Kanan: Formulir Penilaian (Scoring Studio)
Sistem menggunakan 5 kriteria resmi tanpa *slider*, mengutamakan kecepatan dan presisi:

| No | Kriteria Penilaian | Bobot | Maksimal Poin | Panduan Asesmen |
| :---: | :--- | :---: | :---: | :--- |
| **1** | **Logika Pemrograman & Algoritma** | **30%** | **30.00 pts** | Kompleksitas logika, struktur loop (perulangan), branching (if/else), variabel, sensor, dan efisiensi susunan balok. |
| **2** | **Kreativitas & Orisinalitas** | **25%** | **25.00 pts** | Keunikan konsep ide, inovasi mekanik *gameplay*, originalitas cerita, dan pemecahan masalah kreatif. |
| **3** | **Kesesuaian Tema & Fungsionalitas** | **20%** | **20.00 pts** | Relevansi karya dengan tema kompetisi, pesan moral/edukasi, kestabilan program (bebas bug/glitch fatal). |
| **4** | **Estetika, Desain UI & Gerak** | **15%** | **15.00 pts** | Kerapian visual grafis, tata letak UI, animasi kehalusan gerak karakter, sinkronisasi audio & efek suara. |
| **5** | **Presentasi & Pemahaman Peserta** | **10%** | **10.00 pts** | Penguasaan konsep di video, artikulasi penjelasan alur program, demonstrasi jalannya aplikasi, dan kepercayaan diri. |

### Cara Menginput Nilai:
1. **Input Angka**: Ketik nilai antara `0` sampai `100` pada kolom angka masing-masing kriteria.
2. **Tombol Penyesuai Cepat (`-` dan `+`)**: Klik `-` untuk mengurangi 1 poin, atau `+` untuk menambah 1 poin.
3. **Pilihan Nilai Preset**: Klik salah satu tombol preset standar (**`70`**, **`80`**, **`85`**, **`90`**, **`95`**, **`100`**) untuk mengisi angka secara instan.
4. **Poin Kontribusi Otomatis**: Di samping judul kriteria akan langsung tertera poin kontribusi terbobot (contoh: nilai `90` pada Logika 30% menghasilkan `27.00 / 30.00 pts`).
5. **Akumulasi Skor Akhir**: Terkalkulasi otomatis di bagian atas (skala `0.00` - `100.00`) beserta predikat mutu:
   - `90.00 - 100.00` : **Istimewa (A+)**
   - `80.00 - 89.99`  : **Sangat Baik (A)**
   - `70.00 - 79.99`  : **Baik (B)**
   - `60.00 - 69.99`  : **Cukup (C)**
   - `< 60.00`        : **Perlu Pembinaan (D)**
6. **Catatan Juri**: Masukkan evaluasi kualitatif atau masukan konstruktif untuk peserta (opsional).
7. **Penyimpanan Nilai**:
   - Klik **"Simpan Penilaian Karya Ini"** untuk menyimpan skor karya saat ini.
   - Klik **"Simpan & Lanjut ke Peserta Berikutnya"** untuk menyimpan dan otomatis berpindah ke karya yang belum dinilai berikutnya.

---

## 🏆 6. Rekapitulasi Nilai & Berita Acara (CSV)

1. Klik tombol **"Rekap & Peringkat"** pada bilah navigasi atas.
2. Muncul modal rekapitulasi yang mengurutkan karya berdasarkan rata-rata skor dewan juri tertinggi (*descending*).
3. Juri dapat memfilter berdasarkan cabang dan jenjang tertentu.
4. Klik **"Unduh Berita Acara (CSV)"** untuk mengunduh rekapitulasi penilaian resmi dalam format berkas *spreadsheet*.

