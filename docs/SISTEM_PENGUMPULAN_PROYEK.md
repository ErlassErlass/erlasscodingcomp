# Sistem Pengumpulan Karya Proyek Peserta - Erlass Competition 2026

Dokumen ini menjelaskan alur pengumpulan karya proyek, spesifikasi berkas, kebijakan revisi, dan penanganan teknis di server.

---

## 📥 1. Alur Pengumpulan Karya oleh Peserta

1. **Akses Portal**:
   Peserta membuka tautan: [https://erlasscompetition.erlass.academy/kumpul-proyek.html](https://erlasscompetition.erlass.academy/kumpul-proyek.html).
2. **Verifikasi Kepesertaan**:
   - Peserta memasukkan **Kode Registrasi** yang diperoleh saat pendaftaran (format: `E-1026-XXXX`).
   - Sistem memvalidasi status verifikasi peserta di database (`status = 'verified'`).
   - Jika terdaftar dan telah diverifikasi, data nama peserta, cabang lomba, dan kategori jenjang akan ditampilkan secara otomatis.
3. **Pengisian Formulir Proyek**:
   - **Judul Karya Proyek**: Nama karya yang diciptakan peserta.
   - **Deskripsi & Cara Main**: Ringkasan cerita, tujuan aplikasi/game, serta panduan tombol kontrol.
   - **Unggah Berkas Proyek**:
     - Kategori Scratch: Berkas berekstensi `.sb3`.
     - Kategori Micro:bit: Berkas berekstensi `.hex`.
     - Batas ukuran berkas maksimal: **50 MB**.
   - **Tautan Video Presentasi**:
     - URL video YouTube (format reguler, `youtu.be`, atau `youtube.com/shorts`) atau tautan pratinjau Google Drive (harus disetel akses *"Siapa saja yang memiliki link"*).
     - Tautan cadangan video (opsional).
4. **Konfirmasi & Penguncian**:
   - Setelah formulir dikirim, sistem menyimpan berkas dan mengunci formulir.
   - Peserta melihat pesan bahwa karya telah berhasil dikumpulkan (Status: *Terkumpul - Versi 1*).

---

## 🔒 2. Kebijakan Kunci Formulir & Izin Revisi

Untuk mencegah perubahan berkas tanpa izin di tengah proses penjurian:
1. **Penguncian Otomatis**: Formulir proyek langsung terkunci setelah karya pertama kali dikirimkan (`allow_revision = 0`).
2. **Permohonan Revisi**:
   - Peserta yang membutuhkan perbaikan (misal berkas salah versi atau video tidak dapat dibuka) menghubungi panitia resmi.
3. **Pemberian Izin Revisi oleh Panitia**:
   - Panitia membuka `admin.html` pada tab **"Pengumpulan Proyek"**.
   - Klik tombol **"Beri Izin Revisi"** pada baris peserta terkait.
   - Panitia dapat menyertakan pesan arahan revisi (contoh: *"Silakan unggah ulang video dengan izin akses dibuka publik"*).
4. **Pengunggahan Ulang oleh Peserta**:
   - Peserta membuka kembali `kumpul-proyek.html` dengan kode registrasinya.
   - Formulir akan terbuka kembali dan menampilkan catatan arahan dari panitia.
   - Setelah diunggah ulang, nomor versi meningkat otomatis (misal: *Versi 2*) dan formulir terkunci kembali.

---

## ⚙️ 3. Penanganan Berkas di Server

1. **Direktori Penyimpanan**:
   Berkas fisik disimpan di direktori server `/var/www/erlass-competition/uploads/projects/`.
2. **Pola Penamaan Berkas di Server**:
   Sistem menyimpan berkas dengan pola:
   `[Cabang]_[KodeReg]_[NamaPeserta].[ext]`
   *(Contoh: `Scratch_E-1026-0605_Azel_Marcello.sb3`)*.
3. **Sanitasi untuk Penjurian (Blind Review)**:
   Saat berkas diakses oleh dewan juri via `penjurian.html` atau diunduh, sistem menyamarkannya menjadi:
   `Proyek_[KodeReg].[ext]`
   *(Contoh: `Proyek_E-1026-0605.sb3`)* tanpa memaparkan nama asli peserta.
4. **Konfigurasi CORS di Nginx Server**:
   Blok konfigurasi Nginx menambahkan header:
   ```nginx
   location ^~ /uploads/projects/ {
       add_header Access-Control-Allow-Origin "*" always;
       add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
       add_header Access-Control-Allow-Headers "Content-Type, Range" always;
       try_files $uri =404;
   }
   ```
   Hal ini memungkinkan engine web runtime eksternal seperti TurboWarp (`turbowarp.org/embed.html`) dan Microsoft MakeCode mengunduh dan menjalankan berkas `.sb3`/`.hex` secara langsung di browser tanpa pemblokiran keamanan lintas-domain.
