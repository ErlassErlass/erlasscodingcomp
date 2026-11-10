# Panduan Import Manual Peserta Lomba (Excel / CSV) - Erlass Competition 2026

Dokumen ini menjelaskan prosedur penambahan peserta susulan secara manual ke dalam sistem database **Erlass Competition 2026** menggunakan berkas spreadsheet (Excel/CSV) dan script CLI otomatis.

---

## 1. Latar Belakang & Kebutuhan

Setelah batas waktu pendaftaran publik resmi ditutup (5 November 2026 pukul 23:59 WIB), panitia tetap dapat mendaftarkan peserta tambahan (peserta offline / susulan) secara aman tanpa perlu mengubah status pendaftaran publik atau memodifikasi database secara langsung.

Sistem telah dilengkapi dengan:
1. **Template Excel Resmi (`template_import_peserta.xlsx`)**: Berisi validasi data dropdown dan panduan kolom.
2. **Template CSV Resmi (`template_import_peserta.csv`)**: Alternatif format teks delimitasi koma.
3. **Script CLI Importer (`scripts/import_peserta.php`)**: Skrip otomatisasi validasi, penomoran kode registrasi, verifikasi kemitraan, dan injeksi ke antrean penjurian.

---

## 2. Unduh Berkas Template

Template dapat diunduh langsung melalui browser:
* **Excel (.xlsx)**: [https://erlasscompetition.erlass.academy/template_import_peserta.xlsx](https://erlasscompetition.erlass.academy/template_import_peserta.xlsx)
* **CSV (.csv)**: [https://erlasscompetition.erlass.academy/template_import_peserta.csv](https://erlasscompetition.erlass.academy/template_import_peserta.csv)
* **Dashboard Admin**: Tombol **"Template Peserta"** di bilah navigasi atas [https://erlasscompetition.erlass.academy/admin.html](https://erlasscompetition.erlass.academy/admin.html).

---

## 3. Struktur Kolom Template Excel

Berkas Excel terdiri dari 2 lembar (*sheet*):

### Sheet 1: `DATA PESERTA`
Mulai baris ke-5 adalah baris pengisian data peserta:

| No | Nama Kolom | Status | Keterangan & Format | Contoh |
| :---: | :--- | :---: | :--- | :--- |
| **A** | `No` | Opsional | Nomor urut | `1` |
| **B** | `Nama Lengkap Peserta *` | **Wajib** | Nama lengkap siswa | `Ganendra Alkhalifi` |
| **C** | `Jenis Kelamin *` | **Wajib** | Dropdown: `Laki-laki` atau `Perempuan` | `Laki-laki` |
| **D** | `Tanggal Lahir *` | **Wajib** | Format: `YYYY-MM-DD` | `2014-07-15` |
| **E** | `Usia` | Opsional | Angka tahun usia peserta (dihitung otomatis jika kosong) | `12` |
| **F** | `No WhatsApp / HP *` | **Wajib** | Nomor aktif diawali `08...` | `081298765432` |
| **G** | `Alamat Domisili` | Opsional | Alamat rumah tempat tinggal siswa | `Jl. Raya Condet No. 12` |
| **H** | `Nama Sekolah *` | **Wajib** | Nama resmi sekolah asal | `SDS GLOBAL ISLAMIC SCHOOL` |
| **I** | `NPSN Sekolah` | Opsional | 8 digit angka NPSN | `20104321` |
| **J** | `Wilayah / Kota Sekolah` | Opsional | Kota/Kabupaten asal sekolah | `KOTA JAKARTA TIMUR` |
| **K** | `Kelas *` | **Wajib** | Tingkat kelas (misal: *Kelas 5*, *Kelas 7*) | `Kelas 5` |
| **L** | `Kategori Jenjang *` | **Wajib** | Dropdown: `Kelas 1-3`, `Kelas 4-6`, atau `SMP 7-9` | `Kelas 4-6` |
| **M** | `Cabang Lomba *` | **Wajib** | Dropdown: `Scratch Coding`, `Micro:bit`, atau `Erboblox Robotics` | `Scratch Coding` |
| **N** | `Status Kemitraan *` | **Wajib** | Dropdown: `Mitra` (Pelanggan Erlass/Gratis) atau `Umum` | `Mitra` |
| **O** | `Judul Proyek` | Opsional | Judul karya jika sudah memiliki proyek | `Petualangan Hutan Maya` |
| **P** | `Deskripsi / Sinopsis Proyek` | Opsional | Deskripsi alur game/aplikasi dan cara main | `Game edukasi mengumpulkan sampah` |
| **Q** | `Link Video Demo / YouTube` | Opsional | Tautan video presentasi di YouTube atau Google Drive | `https://youtu.be/sample1` |
| **R** | `Nama Berkas Karya` | Opsional | Nama file karya yang diunggah | `ganendra_proyek.sb3` |

### Sheet 2: `PETUNJUK PENGISIAN`
Berisi referensi detail format dan batasan nilai untuk setiap kolom.

---

## 4. Cara Menjalankan Impor Data ke Server

Setelah file Excel diisi oleh panitia, simpan berkas tersebut di server, lalu jalankan perintah CLI:

### A. Uji Coba Simulasi (Dry-Run / Tanpa Simpan ke Database)
Gunakan opsi `--dry-run` untuk memverifikasi kelengkapan format baris tanpa menyentuh data permanen:
```bash
php /var/www/erlass-competition/scripts/import_peserta.php /path/ke/file_peserta.xlsx --dry-run
```

### B. Eksekusi Simpan Permanen ke Database
Setelah seluruh baris tervalidasi pada mode simulasi, jalankan tanpa argumen `--dry-run`:
```bash
php /var/www/erlass-competition/scripts/import_peserta.php /path/ke/file_peserta.xlsx
```

---

## 5. Alur Otomatisasi Sistem Saat Import

1. **Nomor Registrasi Resmi (`reg_code`)**:
   - Sistem secara otomatis mencari sequence nomor tertinggi di database untuk bulan dan tahun berjalan (misal: `E-1126-XXXX`).
   - Setiap peserta baru mendapatkan nomor berurutan tanpa risiko bentrok (*collision-free*).
2. **Status Pendaftaran Terverifikasi**:
   - Peserta hasil import admin langsung mendapatkan status pembayaran `verified`.
3. **Deteksi Otomatis Kemitraan Sekolah**:
   - Sistem mencocokkan NPSN dan Nama Sekolah dengan tabel `partner_schools` dan `national_schools`.
   - Sekolah mitra otomatis dikenakan tarif Rp 0,-.
4. **Sinkronisasi Langsung ke Portal Penjurian**:
   - Jika kolom `Judul Proyek` atau `Link Video Demo` diisi pada Excel, data tersebut otomatis diinjeksi ke tabel `project_submissions`.
   - Peserta akan **langsung muncul di antrean karya Dewan Juri** pada `penjurian.html` dan siap dinilai secara objektif (*Blind Review*).

