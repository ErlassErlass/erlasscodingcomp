# Sistem Pengumpulan Karya Proyek Peserta - Erlass Competition 2026

Dokumen ini menjelaskan alur pengumpulan karya proyek, spesifikasi berkas, kebijakan revisi, distribusi penjurian, dan penanganan teknis di server.

---

## 1. Alur Pengumpulan Karya oleh Peserta

1. **Akses Portal**:
   Peserta membuka tautan: [https://erlasscompetition.erlass.academy/kumpul-proyek.html](https://erlasscompetition.erlass.academy/kumpul-proyek.html).
2. **Verifikasi Kepesertaan**:
   - Peserta memasukkan **Kode Registrasi** yang diperoleh saat pendaftaran (format: `E-1026-XXXX` atau `E-1126-XXXX`).
   - Sistem memvalidasi status verifikasi peserta di database (`payment_status = 'verified'` atau `is_partner = 1`).
   - Jika terdaftar dan terverifikasi, data nama peserta, asal sekolah, cabang lomba, dan kategori jenjang ditampilkan otomatis.
   - **Bantuan Lupa ID Peserta (Verifikasi Privat)**:
     - Jika peserta lupa nomor registrasinya, tersedia tombol **"Lupa ID Peserta?"**.
     - Peserta wajib memverifikasi 3 data privat: **Nama Lengkap Siswa**, **Tanggal Lahir**, dan **Nomor WhatsApp yang Terdaftar**.
     - Sistem mencocokkan ketiga parameter dan dilindungi pembatas frekuensi (*Rate Limiting* Redis maksimal 5 percobaan per 15 menit).
     - Jika terverifikasi, ID Peserta ditampilkan bersama nomor telepon tersamar dan dapat langsung diisikan otomatis ke formulir (*auto-fill*).
3. **Pengisian Formulir Proyek**:
   - **Judul Karya Proyek**: Nama karya yang diciptakan peserta.
   - **Deskripsi & Cara Main**: Ringkasan cerita, tujuan aplikasi/alat, serta panduan penggunaan atau kontrol.
   - **Unggah Berkas Proyek**:
     - Kategori Scratch Coding: Berkas wajib berekstensi `.sb3`.
     - Kategori Micro:bit: Berkas wajib berekstensi `.hex`.
     - Kategori Erboblox Robotics: Tidak mewajibkan upload berkas kode (penilaian menggunakan video demonstrasi fisik).
     - Batas ukuran berkas maksimal: **50 MB**.
   - **Tautan Video Presentasi**:
     - URL video YouTube (format reguler, `youtu.be`, atau `youtube.com/shorts`) atau tautan pratinjau Google Drive (harus disetel akses *"Siapa saja yang memiliki link"*).
     - Tautan cadangan video (opsional).
   - **Konfirmasi 5 Poin Pernyataan**: Pernyataan orisinalitas, persetujuan diskualifikasi bila melanggar, video tetap aktif selama penjurian, kelengkapan berkas, dan izin dokumentasi.
4. **Konfirmasi, Penguncian & Distribusi Penjurian**:
   - Pengumpulan karya baru dibuka hingga **21 November 2026 pukul 23:59:59 WIB**.
   - Setelah formulir dikirim, sistem menyimpan berkas, mengunci formulir (`allow_revision = 0`), dan **otomatis menetapkan kelompok juri (`judge_group` 1 sampai 4) secara *round-robin*** agar setiap proyek dinilai secara seimbang oleh 2 dewan juri.
   - Peserta melihat pesan bahwa karya telah berhasil dikumpulkan (Status: *Terkumpul - Versi 1*).

---

## 2. Kebijakan Kunci Formulir & Izin Revisi

Untuk mencegah perubahan berkas tanpa izin di tengah proses penjurian:
1. **Penguncian Otomatis**: Formulir proyek langsung terkunci setelah karya pertama kali dikirimkan (`allow_revision = 0`).
2. **Permohonan Revisi**:
   - Peserta yang membutuhkan perbaikan (misalnya berkas salah versi atau video tidak dapat dibuka) menghubungi panitia resmi.
3. **Pemberian Izin Revisi oleh Panitia**:
   - Panitia membuka `admin.html` pada tab **"Pengumpulan Proyek"**.
   - Klik tombol **"Beri Izin Revisi"** pada baris peserta terkait.
   - Panitia dapat menyertakan pesan arahan revisi (contoh: *"Silakan unggah ulang video dengan izin akses dibuka publik"*).
4. **Pengunggahan Ulang oleh Peserta**:
   - Peserta membuka kembali `kumpul-proyek.html` dengan kode registrasinya.
   - Formulir akan terbuka kembali dan menampilkan catatan arahan dari panitia.
   - Setelah diunggah ulang, nomor versi meningkat otomatis (misalnya *Versi 2*) dan formulir terkunci kembali tanpa mengubah alokasi `judge_group`.

---

## 3. Penanganan Berkas di Server

1. **Direktori Penyimpanan**:
   Berkas fisik disimpan di direktori server `/var/www/erlass-competition/uploads/projects/`.
2. **Pola Penamaan Berkas di Server**:
   Sistem menyimpan berkas dengan pola:
   `[Kategori]_[IDPeserta]_[NamaPeserta].[ext]`
   *(Contoh: `Scratch_E-1026-0605_Azel_Marcello.sb3` atau `Microbit_E-1026-0128_Peserta.hex`)*.
3. **Sanitasi untuk Penjurian (Blind Review)**:
   Saat berkas diakses oleh dewan juri via `penjurian.html` atau di-stream melalui `api/admin.php?action=stream_project_file`, sistem menyamarkannya menjadi:
   `Proyek_[IDPeserta].[ext]`
   *(Contoh: `Proyek_E-1026-0605.sb3`)* tanpa memaparkan nama asli peserta.
4. **Konfigurasi CORS di Nginx Server**:
   Blok konfigurasi Nginx menambahkan header CORS agar engine web runtime eksternal seperti TurboWarp (`turbowarp.org/embed.html`) dan Microsoft MakeCode dapat mengunduh dan menjalankan berkas `.sb3`/`.hex` secara langsung di browser tanpa pemblokiran keamanan lintas-domain:
   ```nginx
   location ^~ /uploads/projects/ {
       add_header Access-Control-Allow-Origin "*" always;
       add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
       add_header Access-Control-Allow-Headers "Content-Type, Range" always;
       try_files $uri =404;
   }
   ```
